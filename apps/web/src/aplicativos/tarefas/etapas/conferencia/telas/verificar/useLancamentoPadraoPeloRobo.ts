// O botão Vitor do "Lançamento fora do padrão" (17/11/2026, Vitor: "quero fazer um robo que corrige isso... basicamente mudar os
// lancamentos automaticos para o padrao"; "pode colocar na linha do cabecalho"). Cada natureza com notas fora do padrão vira um
// pedido (os CFOPs dela, o padrão e só as competências dessas notas); o robô do PC do Vitor filtra os CFOPs na grade do Alterdata
// Fiscal e troca o "Lanc. Cont. Vl. Contábil" de TODAS as notas filtradas. Em dois cliques: o primeiro é o ENSAIO (o robô só filtra e conta, nada muda); com a contagem igual
// à do nads em todos os pares, o segundo corrige de verdade. Corrigidas no Alterdata, as notas ficam marcadas como corrigidas aqui.
import { conferencia as c, formatos } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { cancelarPedidoDoFiscal, ouvirLancamentosPadrao, pedirLancamentoPadrao, roboDePcDoUsuario, type PedidoDoPadrao } from '../../../../dados/notasDoFiscal.firestore';
import { useEsperaDoPc } from '../../../../dados/useEsperaDoPc';

const ANDANDO = ['pendente', 'pendentePc', 'trabalhando'];
const MARCADOS = new Set<string>();

/**
 * Um pedido ao robô, por natureza (17/11/2026, Vitor regravou com uma nota só: "seleciona so os cfops daquela natureza e troca TODOS
 * pelo lancamento automatico padrao informado no nads"; "selecionar apenas as competencias"): os CFOPs das notas fora do padrão, o
 * padrão, e o período só das competências delas (competencia a ate). esperado: todas as notas desses CFOPs nesse período (o robô
 * troca todas); bloqueio: o mesmo CFOP pedindo dois padrões (não dá para pôr "igual em tudo").
 */
export interface ParDoPadrao { chave: string; tipo: c.TipoNotaFiscal; cfops: string[]; atual: string; padrao: string; itens: c.Divergencia[]; competencia: string; ate: string; esperado: number; bloqueio: string }

const mesDaData = (d: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(d) ? d.slice(6) + '-' + d.slice(3, 5) : '');
const semZeros = (l: string) => String(l || '').trim().replace(/^0+/, '');

export function paresDoPadrao(fiscais: readonly { tipo: c.TipoNotaFiscal; r: c.ForaDoPadraoFiscal }[], meses: readonly string[], notas: Record<c.TipoNotaFiscal, readonly c.Nota[]>): ParDoPadrao[] {
  const noPeriodo = (data: string) => !meses.length || meses.includes(mesDaData(data));
  const r: ParDoPadrao[] = [];
  for (const { tipo, r: f } of fiscais) {
    for (const g of f.pendentes) {
      const porPadrao = new Map<string, c.Divergencia[]>();
      for (const d of g.itens) {
        if (!noPeriodo(d.nota.data)) continue;
        const atual = String(d.nota.lanc || '').trim();
        const padrao = formatos.lancComZeros(d.padrao, d.nota.lanc);
        if (!/^\d+$/.test(atual) || !/^\d+$/.test(padrao) || semZeros(atual) === semZeros(padrao)) continue;
        porPadrao.set(padrao, [...(porPadrao.get(padrao) || []), d]);
      }
      const cfopsDe = (ds: c.Divergencia[]) => [...new Set(ds.map(d => d.nota.cfop))].sort();
      for (const [padrao, itens] of porPadrao) {
        const cfops = cfopsDe(itens);
        const outros = [...porPadrao.entries()].filter(([p]) => p !== padrao).flatMap(([, ds]) => cfopsDe(ds));
        const dividido = cfops.filter(cf => outros.includes(cf));
        const ms = [...new Set(itens.map(d => mesDaData(d.nota.data)))].filter(Boolean).sort();
        const competencia = ms[0] || '', ate = ms[ms.length - 1] || '';
        const esperado = (notas[tipo] || []).filter(n => cfops.includes(n.cfop) && mesDaData(n.data) >= competencia && mesDaData(n.data) <= ate).length;
        r.push({
          chave: tipo + '|' + g.key + '|' + padrao, tipo, cfops, atual: String(itens[0].nota.lanc || '').trim(), padrao, itens, competencia, ate, esperado,
          bloqueio: dividido.length ? 'o CFOP ' + dividido.join(', ') + ' tem notas para padrões diferentes: corrija nota a nota' : '',
        });
      }
    }
  }
  return r;
}

export function useLancamentoPadraoPeloRobo(o: { codigo: number | null; empresa: string; meses: readonly string[]; fiscais: readonly { tipo: c.TipoNotaFiscal; r: c.ForaDoPadraoFiscal }[]; notas: Record<c.TipoNotaFiscal, readonly c.Nota[]>; marcar: (t: c.TipoNotaFiscal, d: c.Divergencia, marcado: boolean) => void }) {
  const doPc = roboDePcDoUsuario();
  const meses = [...o.meses].sort();
  const pares = paresDoPadrao(o.fiscais, meses, o.notas).filter(p => p.competencia && p.esperado > 0);
  const disponivel = !!doPc && !!o.codigo && pares.length > 0;
  const [pedidos, setPedidos] = useState<PedidoDoPadrao[]>([]);
  const [falha, setFalha] = useState('');
  const [pedindo, setPedindo] = useState(false);
  const marcar = useRef(o.marcar);
  marcar.current = o.marcar;
  useEffect(() => {
    if (!disponivel || !o.codigo) return;
    return ouvirLancamentosPadrao(o.codigo, setPedidos, e => setFalha(e.message));
  }, [disponivel, o.codigo]);

  const doPar = (p: ParDoPadrao, ensaio: boolean) => pedidos.find(x => x.ensaio === ensaio && x.status !== 'cancelado' && x.padrao === p.padrao
    && x.cfops.join(',') === p.cfops.join(',') && x.competencia === p.competencia && x.ate === p.ate) || null;
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
  const ensaioOk = (s: typeof situacoes[number]) => !s.par.bloqueio && !!s.ensaio && s.ensaio.status === 'pronto' && s.ensaio.achadas === s.par.esperado && s.ensaio.esperado === s.par.esperado;
  const pendentesDeVerdade = situacoes.filter(s => !s.par.bloqueio && !(s.real && (s.real.status === 'pronto' || ANDANDO.includes(s.real.status))));
  const prontoParaCorrigir = !andando && pendentesDeVerdade.length > 0 && pendentesDeVerdade.every(ensaioOk);
  const notasACorrigir = pendentesDeVerdade.reduce((t, s) => t + s.par.esperado, 0);
  const foraDoPadrao = pendentesDeVerdade.reduce((t, s) => t + s.par.itens.length, 0);
  const mesCurto = (m: string) => m.slice(5) + '/' + m.slice(0, 4);
  const rotulo = (p: ParDoPadrao) => (p.tipo === 'entradas' ? 'Entradas' : 'Saídas') + ' · CFOP ' + p.cfops.join(', ') + ' · ' + (p.competencia === p.ate ? mesCurto(p.competencia) : mesCurto(p.competencia) + ' a ' + mesCurto(p.ate)) + ' → ' + p.padrao;
  const avisos = situacoes.flatMap(s => {
    const r: { tom: 'ok' | 'erro' | 'info'; texto: string }[] = [];
    const e = s.ensaio;
    if (s.par.bloqueio) { r.push({ tom: 'info', texto: rotulo(s.par) + ': ' + s.par.bloqueio }); return r; }
    if (s.real?.status === 'erro') r.push({ tom: 'erro', texto: rotulo(s.par) + ': o robô não corrigiu: ' + s.real.erro.replace(/\s*\(tela \d+x\d+;[\s\S]*$/, '') });
    else if (s.real?.status === 'pronto') r.push({ tom: 'ok', texto: rotulo(s.par) + ': ' + s.real.alteradas + ' nota(s) corrigida(s) no Alterdata' });
    else if (e?.status === 'erro') r.push({ tom: 'erro', texto: rotulo(s.par) + ': o ensaio não deu: ' + e.erro.replace(/\s*\(tela \d+x\d+;[\s\S]*$/, '') });
    else if (e?.status === 'pronto' && !ensaioOk(s)) r.push({ tom: 'erro', texto: rotulo(s.par) + ': o Alterdata tem ' + e.achadas + ' nota(s) nesses CFOPs e o nads ' + s.par.esperado + ': não vou corrigir' });
    else if (e?.status === 'pronto') r.push({ tom: 'info', texto: rotulo(s.par) + ': ' + e.achadas + ' nota(s) conferidas no ensaio (' + s.par.itens.length + ' fora do padrão)' });
    return r;
  });

  async function pedir(ensaio: boolean) {
    if (!disponivel || !o.codigo || pedindo || andando) return;
    setPedindo(true); setFalha('');
    try {
      const alvo = ensaio ? situacoes.filter(s => !s.par.bloqueio && !ensaioOk(s) && !(s.real && s.real.status === 'pronto')) : pendentesDeVerdade;
      for (const s of alvo) {
        await pedirLancamentoPadrao({ codigo: o.codigo, empresa: o.empresa, competencia: s.par.competencia, ate: s.par.ate, cfops: s.par.cfops, atual: s.par.atual, padrao: s.par.padrao, esperado: s.par.esperado, ensaio });
      }
    } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); } finally { setPedindo(false); }
  }

  return {
    disponivel, rotulo: doPc?.rotulo || '', andando, pedindo, pct, espera, falha, avisos, prontoParaCorrigir, notasACorrigir, foraDoPadrao,
    /** nada a pedir: todas as naturezas bloqueadas (corrigir nota a nota) */
    soBloqueados: pares.length > 0 && pares.every(p => !!p.bloqueio),
    ensaiar: () => pedir(true),
    corrigir: () => pedir(false),
    cancelar: () => { for (const x of andandoLista) void cancelarPedidoDoFiscal(x.id).catch((e: unknown) => setFalha(e instanceof Error ? e.message : String(e))); },
  };
}
