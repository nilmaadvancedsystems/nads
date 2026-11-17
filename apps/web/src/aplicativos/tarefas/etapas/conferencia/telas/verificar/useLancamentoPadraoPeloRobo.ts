// O botão Vitor do "Lançamento fora do padrão" (17/11/2026, Vitor: "quero fazer um robo que corrige isso... basicamente mudar os
// lancamentos automaticos para o padrao"; "pode colocar na linha do cabecalho"). As notas pendentes viram pares (o tipo, o lançamento
// atual e o padrão, com os CFOPs delas); para cada par o robô do PC do Vitor filtra a grade do Alterdata Fiscal e troca o
// "Lanc. Cont. Vl. Contábil". Em dois cliques: o primeiro é o ENSAIO (o robô só filtra e conta, nada muda); com a contagem igual
// à do nads em todos os pares, o segundo corrige de verdade. Corrigidas no Alterdata, as notas ficam marcadas como corrigidas aqui.
import { conferencia as c, formatos } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { cancelarPedidoDoFiscal, ouvirLancamentosPadrao, pedirLancamentoPadrao, roboDePcDoUsuario, type PedidoDoPadrao } from '../../../../dados/notasDoFiscal.firestore';
import { useEsperaDoPc } from '../../../../dados/useEsperaDoPc';

const ANDANDO = ['pendente', 'pendentePc', 'trabalhando'];
const MARCADOS = new Set<string>();

export interface ParDoPadrao { chave: string; tipo: c.TipoNotaFiscal; cfops: string[]; atual: string; padrao: string; itens: c.Divergencia[] }

const mesDaData = (d: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(d) ? d.slice(6) + '-' + d.slice(3, 5) : '');

export function paresDoPadrao(fiscais: readonly { tipo: c.TipoNotaFiscal; r: c.ForaDoPadraoFiscal }[], meses: readonly string[]): ParDoPadrao[] {
  const m = new Map<string, ParDoPadrao>();
  for (const { tipo, r } of fiscais) {
    for (const g of r.pendentes) {
      for (const d of g.itens) {
        if (meses.length && !meses.includes(mesDaData(d.nota.data))) continue;
        const atual = String(d.nota.lanc || '').trim();
        const padrao = formatos.lancComZeros(d.padrao, d.nota.lanc);
        if (!/^\d+$/.test(atual) || !/^\d+$/.test(padrao) || atual === padrao) continue;
        const chave = tipo + '|' + atual + '|' + padrao;
        const p = m.get(chave) || { chave, tipo, cfops: [], atual, padrao, itens: [] };
        if (!p.cfops.includes(d.nota.cfop)) p.cfops.push(d.nota.cfop);
        p.itens.push(d);
        m.set(chave, p);
      }
    }
  }
  return [...m.values()].map(p => ({ ...p, cfops: p.cfops.sort() }));
}

export function useLancamentoPadraoPeloRobo(o: { codigo: number | null; empresa: string; meses: readonly string[]; fiscais: readonly { tipo: c.TipoNotaFiscal; r: c.ForaDoPadraoFiscal }[]; marcar: (t: c.TipoNotaFiscal, d: c.Divergencia, marcado: boolean) => void }) {
  const doPc = roboDePcDoUsuario();
  const meses = [...o.meses].sort();
  const competencia = meses[0] || '', ate = meses[meses.length - 1] || '';
  const pares = paresDoPadrao(o.fiscais, meses);
  const disponivel = !!doPc && !!o.codigo && !!competencia && pares.length > 0;
  const [pedidos, setPedidos] = useState<PedidoDoPadrao[]>([]);
  const [falha, setFalha] = useState('');
  const [pedindo, setPedindo] = useState(false);
  const marcar = useRef(o.marcar);
  marcar.current = o.marcar;
  useEffect(() => {
    if (!disponivel || !o.codigo) return;
    return ouvirLancamentosPadrao(o.codigo, setPedidos, e => setFalha(e.message));
  }, [disponivel, o.codigo]);

  const doPar = (p: ParDoPadrao, ensaio: boolean) => pedidos.find(x => x.ensaio === ensaio && x.status !== 'cancelado' && x.atual === p.atual && x.padrao === p.padrao
    && x.cfops.join(',') === p.cfops.join(',') && x.competencia === competencia && x.ate === ate) || null;
  const situacoes = pares.map(p => ({ par: p, ensaio: doPar(p, true), real: doPar(p, false) }));

  // corrigidas no Alterdata: marca as notas do par como corrigidas aqui (uma vez por pedido)
  useEffect(() => {
    for (const s of situacoes) {
      const r = s.real;
      if (!r || r.status !== 'pronto' || r.alteradas <= 0 || MARCADOS.has(r.id)) continue;
      MARCADOS.add(r.id);
      for (const d of s.par.itens) marcar.current(s.par.tipo, d, true);
    }
  });

  const todos = situacoes.flatMap(s => [s.ensaio, s.real]).filter((x): x is PedidoDoPadrao => !!x);
  const andandoLista = todos.filter(x => ANDANDO.includes(x.status));
  const andando = andandoLista.length > 0;
  const pct = andando ? Math.round(andandoLista.reduce((t, x) => t + x.pct, 0) / andandoLista.length) : 0;
  const espera = useEsperaDoPc(andandoLista.find(x => x.status === 'pendentePc') || null, true);
  // o ensaio vale quando acabou e achou no Alterdata exatamente as notas que o nads tem agora
  const ensaioOk = (s: typeof situacoes[number]) => !!s.ensaio && s.ensaio.status === 'pronto' && s.ensaio.achadas === s.par.itens.length && s.ensaio.esperado === s.par.itens.length;
  const pendentesDeVerdade = situacoes.filter(s => !(s.real && (s.real.status === 'pronto' || ANDANDO.includes(s.real.status))));
  const prontoParaCorrigir = !andando && pendentesDeVerdade.length > 0 && pendentesDeVerdade.every(ensaioOk);
  const notasACorrigir = pendentesDeVerdade.reduce((t, s) => t + s.par.itens.length, 0);
  const rotulo = (p: ParDoPadrao) => (p.tipo === 'entradas' ? 'Entradas' : 'Saídas') + ' · CFOP ' + p.cfops.join(', ') + ' · ' + p.atual + ' → ' + p.padrao;
  const avisos = situacoes.flatMap(s => {
    const r: { tom: 'ok' | 'erro' | 'info'; texto: string }[] = [];
    const e = s.ensaio;
    if (s.real?.status === 'erro') r.push({ tom: 'erro', texto: rotulo(s.par) + ': o robô não corrigiu: ' + s.real.erro.replace(/\s*\(tela \d+x\d+;[\s\S]*$/, '') });
    else if (s.real?.status === 'pronto') r.push({ tom: 'ok', texto: rotulo(s.par) + ': ' + s.real.alteradas + ' nota(s) corrigida(s) no Alterdata' });
    else if (e?.status === 'erro') r.push({ tom: 'erro', texto: rotulo(s.par) + ': o ensaio não deu: ' + e.erro.replace(/\s*\(tela \d+x\d+;[\s\S]*$/, '') });
    else if (e?.status === 'pronto' && !ensaioOk(s)) r.push({ tom: 'erro', texto: rotulo(s.par) + ': o Alterdata tem ' + e.achadas + ' nota(s) assim e o nads ' + s.par.itens.length + ': não vou corrigir' });
    else if (e?.status === 'pronto') r.push({ tom: 'info', texto: rotulo(s.par) + ': ' + e.achadas + ' nota(s) conferidas no ensaio' });
    return r;
  });

  async function pedir(ensaio: boolean) {
    if (!disponivel || !o.codigo || pedindo || andando) return;
    setPedindo(true); setFalha('');
    try {
      const alvo = ensaio ? situacoes.filter(s => !ensaioOk(s) && !(s.real && s.real.status === 'pronto')) : pendentesDeVerdade;
      for (const s of alvo) {
        await pedirLancamentoPadrao({ codigo: o.codigo, empresa: o.empresa, competencia, ate, cfops: s.par.cfops, atual: s.par.atual, padrao: s.par.padrao, esperado: s.par.itens.length, ensaio });
      }
    } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); } finally { setPedindo(false); }
  }

  return {
    disponivel, rotulo: doPc?.rotulo || '', andando, pedindo, pct, espera, falha, avisos, prontoParaCorrigir, notasACorrigir,
    ensaiar: () => pedir(true),
    corrigir: () => pedir(false),
    cancelar: () => { for (const x of andandoLista) void cancelarPedidoDoFiscal(x.id).catch((e: unknown) => setFalha(e instanceof Error ? e.message : String(e))); },
  };
}
