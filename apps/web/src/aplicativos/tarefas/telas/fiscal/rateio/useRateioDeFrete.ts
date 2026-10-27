// ViewModel do Rateio de frete (Fiscal › Rateio de frete; Heverton, 22/10/2026: a planilha "RATEIO - FRETE"). O frete vem
// do CT-e (23/10/2026: "preciso que o rateio seja da CTE não da nota dos produtos que vão ser transportados"), de cima para
// baixo: (1) a empresa e o mês; (2) os CT-e recebidos no mês numa tabela com busca (número, data, transportadora, valor,
// ICMS e quantas notas leva); clicar escolhe; (3) o valor do CT-e (editável na linha), as NF-e que ele transporta (as
// chaves do próprio CT-e; o CT-e baixado antes do resumo 5 não as tem, e a pessoa marca as notas) e o valor do CT-e pelas
// notas e pelas tributações dos itens; clicar numa tributação abre o frete dela pelos NCMs. Sem XML, "digite os valores"
// faz a planilha à mão. As contas: core tarefas.sieg.rateioDoCte e ratear (em centavos, a soma bate com o CT-e).
import { empresas as emp, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useRepo, useSieg } from '../../../dados/repo';

const r = t.sieg;
export type Fonte = 'cte' | 'manual';
type Campo = 'total' | 'frete' | 'desconto';

/** "1.234,56", "1234.56" ou "1234,5" → número (vazio = 0). */
export function numero(texto: string): number {
  const s = String(texto || '').trim().replace(/\s|R\$/g, '');
  if (!s) return 0;
  const v = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(v) ? v : 0;
}
/** dd/mm/aaaa → aaaammdd (para ordenar) */
const ordemDaData = (d: string) => d.split('/').reverse().join('');
/** quantas linhas as tabelas de escolher mostram de cada vez (o resto pela busca) */
const NA_TABELA = 12;

interface LinhaDigitada { rotulo: string; valor: string; ipi: string }
const LINHAS_INICIAIS: LinhaDigitada[] = [{ rotulo: '', valor: '', ipi: '' }, { rotulo: '', valor: '', ipi: '' }];

export function useRateioDeFrete() {
  const repo = useRepo();
  const sieg = useSieg();
  const [fonte, setFonte] = useState<Fonte>('cte');
  // a empresa aberta em Minhas empresas (27/10/2026) chega já escolhida, pelo endereço (?empresa=código)
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState<number | null>(() => Number(params.get('empresa')) || null);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [competencia, setCompetencia] = useState(() => competenciasDaTela(1)[0]);
  const [buscaDoCte, setBuscaDoCte] = useState('');
  const [chave, setChave] = useState('');
  // as NF-e marcadas à mão (de qual CT-e; sem marcar, as que o CT-e referencia)
  const [marcadas, setMarcadas] = useState<{ de: string; chaves: string[] } | null>(null);
  const [escolhendoNotas, setEscolhendoNotas] = useState(false);
  const [buscaDaNota, setBuscaDaNota] = useState('');
  const [agrupar, setAgrupar] = useState<t.sieg.AgruparPor>('tributacao');
  const [aberto, setAberto] = useState('');
  // a nota aberta no espelho (23/10/2026: "conferir as danfe direto pelo app")
  const [vendo, setVendo] = useState('');
  // o que a pessoa mudou nos valores (de qual CT-e; outro CT-e volta aos dele)
  const [mudados, setMudados] = useState<{ de: string } & Partial<Record<Campo, number>>>({ de: '' });
  const [digitadas, setDigitadas] = useState<LinhaDigitada[]>(LINHAS_INICIAIS);

  // (1) a empresa
  const empresas = repo.listarEmpresas().filter(e => e.codigo != null);
  const empresa = codigo != null ? empresas.find(e => e.codigo === codigo) || null : null;
  const q = busca.trim();
  const achadas = q ? emp.buscarEmpresas(empresas, q).slice(0, 8) : [];
  const recomecar = () => { setChave(''); setAberto(''); setBuscaDoCte(''); setEscolhendoNotas(false); setBuscaDaNota(''); };

  // (2) os CT-e recebidos no mês, sem os cancelados, os mais novos primeiro
  const doSieg = empresa ? sieg.notas(String(empresa.codigo), competencia) : null;
  const recebidas = doSieg?.dados?.recebidas || [];
  const nfes = recebidas.filter(n => (n.tipo === 'NF-e' || n.tipo === 'NFC-e') && !n.cancelada && (n.itens || []).length);
  const porChave = new Map(nfes.map(n => [n.chave, n]));
  const ctes = recebidas.filter(n => n.tipo === 'CT-e' && !n.cancelada).sort((a, b) => ordemDaData(b.data).localeCompare(ordemDaData(a.data)));
  const qc = buscaDoCte.trim().toLowerCase();
  const achadosCtes = ctes.filter(n => !qc || [n.numero, n.data, n.emitente.nome, n.emitente.doc].join(' ').toLowerCase().includes(qc));

  // (3) o CT-e escolhido, as notas que ele leva e o rateio
  const cte = fonte === 'cte' ? ctes.find(n => n.chave === chave) || null : null;
  const referenciadas = cte?.nfes || [];
  const faltam = referenciadas.filter(k => !porChave.has(k));
  const chavesDasNotas = cte ? (marcadas?.de === cte.chave ? marcadas.chaves : referenciadas.filter(k => porChave.has(k))) : [];
  const notasDoCte = chavesDasNotas.map(k => porChave.get(k)).filter((n): n is t.sieg.NotaDoSieg => !!n);

  const deAgora = fonte === 'cte' ? chave : 'manual';
  const mudado = mudados.de === deAgora ? mudados : { de: deAgora };
  const valor = (k: Campo) => mudado[k] ?? (k === 'frete' && cte ? cte.valor : 0);
  const doCte = cte ? r.rateioDoCte(cte, notasDoCte, agrupar, valor('frete')) : null;
  const linhas: (t.sieg.LinhaParaRatear & { id: string; detalhe: string })[] = fonte === 'cte'
    ? (doCte?.grupos || []).map(g => ({ id: g.id, rotulo: g.rotulo, detalhe: g.detalhe, valor: g.valor, ipi: g.ipi }))
    : digitadas.map((l, i) => ({ id: String(i), rotulo: l.rotulo.trim() || 'Linha ' + (i + 1), detalhe: '', valor: numero(l.valor), ipi: numero(l.ipi) })).filter(l => l.valor > 0);
  const rateio = doCte ? doCte.rateio : r.ratear({ total: valor('total') || null, frete: valor('frete'), desconto: valor('desconto'), linhas });

  // o detalhe pelos NCMs: só pelo CT-e (à mão não há NCM)
  const iAberto = linhas.findIndex(l => l.id === aberto);
  const grupoAberto = doCte && iAberto >= 0 ? doCte.grupos[iAberto] : null;
  const ncms = grupoAberto ? r.rateioDosNcms(grupoAberto, rateio.linhas[iAberto].frete, 0) : null;

  // a lista para marcar as notas (todas as NF-e de entrada do mês, as marcadas primeiro)
  const marcada = new Set(chavesDasNotas);
  const qn = buscaDaNota.trim().toLowerCase();
  const paraMarcar = nfes
    .filter(n => !qn || [n.numero, n.data, n.emitente.nome, n.emitente.doc].join(' ').toLowerCase().includes(qn))
    .sort((a, b) => Number(marcada.has(b.chave)) - Number(marcada.has(a.chave)) || ordemDaData(b.data).localeCompare(ordemDaData(a.data)));

  return {
    exemplos: sieg.exemplos,
    fonte,
    digitar: () => { setFonte('manual'); setAberto(''); },
    voltarAsNotas: () => { setFonte('cte'); setAberto(''); },
    // a empresa
    empresa: empresa ? { codigo: empresa.codigo as number, nome: empresa.nome } : null,
    busca, setBusca: (v: string) => { setBusca(v); setAtivo(0); }, achadas, ativo, setAtivo,
    mover(d: number) { setAtivo(i => Math.max(0, Math.min(achadas.length - 1, i + d))); },
    escolher(e: { codigo: number | null }) { setCodigo(e.codigo); setBusca(''); recomecar(); },
    escolherDestacado() { const e = achadas[ativo]; if (e) { setCodigo(e.codigo); setBusca(''); recomecar(); } },
    trocarEmpresa() { setCodigo(null); recomecar(); },
    competencia, setCompetencia: (c: string) => { setCompetencia(c); recomecar(); },
    rotuloCompetencia: t.rotuloCompetencia(competencia),
    // os CT-e
    carregando: !!empresa && !!doSieg && !doSieg.carregadas,
    semXml: !!empresa && !!doSieg?.carregadas && !doSieg.dados,
    quantosCtes: ctes.length,
    buscaDoCte, setBuscaDoCte,
    ctes: achadosCtes.slice(0, NA_TABELA).map(n => ({
      chave: n.chave, numero: n.numero + (n.serie ? '/' + n.serie : ''), data: n.data, transportadora: n.emitente.nome,
      valor: n.valor, icms: n.icms || 0, notas: n.nfes ? n.nfes.length : null,
    })),
    ctesFora: Math.max(0, achadosCtes.length - NA_TABELA),
    escolherCte: (c: string) => { setChave(c); setAberto(''); setEscolhendoNotas(false); setBuscaDaNota(''); },
    trocarCte: () => { setChave(''); setAberto(''); setEscolhendoNotas(false); },
    cte: cte ? {
      chave: cte.chave, titulo: 'CT-e ' + cte.numero, data: cte.data, transportadora: cte.emitente.nome, valor: cte.valor, icms: cte.icms || 0,
      /** o CT-e não diz as notas (baixado antes do resumo 5): a pessoa marca */
      semNotas: !cte.nfes,
      /** as chaves que o CT-e cita e não estão nas NF-e de entrada do mês no SIEG */
      faltam: faltam.length,
    } : null,
    /** o espelho da nota (a chave, as partes, os itens e os totais) */
    vendo: vendo ? recebidas.find(n => n.chave === vendo) || null : null,
    verNota: (c: string) => setVendo(c),
    fecharNota: () => setVendo(''),
    // as notas do CT-e
    notasDoCte: doCte ? doCte.notas : [],
    escolhendoNotas: escolhendoNotas || (!!cte && !notasDoCte.length),
    alternarEscolherNotas: () => setEscolhendoNotas(v => !v),
    buscaDaNota, setBuscaDaNota,
    paraMarcar: paraMarcar.slice(0, NA_TABELA).map(n => ({ chave: n.chave, numero: n.numero, data: n.data, emitente: n.emitente.nome, valor: n.valor, marcada: marcada.has(n.chave), doCte: referenciadas.includes(n.chave) })),
    paraMarcarFora: Math.max(0, paraMarcar.length - NA_TABELA),
    marcar: (k: string) => {
      if (!cte) return;
      const atual = new Set(chavesDasNotas);
      if (atual.has(k)) atual.delete(k); else atual.add(k);
      setMarcadas({ de: cte.chave, chaves: [...atual] });
      setAberto('');
    },
    mudouNotas: !!cte && marcadas?.de === cte.chave,
    voltarNotas: () => { setMarcadas(null); setAberto(''); },
    // o resultado
    agrupar, setAgrupar: (a: t.sieg.AgruparPor) => { setAgrupar(a); setAberto(''); },
    total: valor('total'), frete: valor('frete'), desconto: valor('desconto'),
    mudar: (k: Campo, texto: string) => setMudados({ ...mudado, [k]: numero(texto) }),
    mudouValores: mudado.total !== undefined || mudado.frete !== undefined || mudado.desconto !== undefined,
    voltarValores: () => setMudados({ de: deAgora }),
    linhas: rateio.linhas.map((l, i) => ({ ...l, id: linhas[i].id, detalhe: linhas[i].detalhe })),
    rateio,
    aberto, abrir: (id: string) => setAberto(a => (a === id ? '' : id)),
    grupoAberto: grupoAberto ? grupoAberto.rotulo : '', ncms,
    // à mão
    digitadas,
    mudarDigitada: (i: number, k: keyof LinhaDigitada, v: string) => setDigitadas(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l))),
    novaLinha: () => setDigitadas(ls => [...ls, { rotulo: '', valor: '', ipi: '' }]),
    tirarLinha: (i: number) => setDigitadas(ls => (ls.length > 1 ? ls.filter((_, j) => j !== i) : LINHAS_INICIAIS)),
  };
}

export type VmRateioDeFrete = ReturnType<typeof useRateioDeFrete>;
