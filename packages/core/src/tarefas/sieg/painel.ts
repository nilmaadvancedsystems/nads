// O painel do que o SIEG traz para a empresa no mês (31/10/2026: "faz uma visualização mais completa, e também puxe entrada
// saída etc, tudo que de para puxar do sieg"): as notas do resumo do "Baixar XMLs do SIEG" (siegNotas) separadas em saídas,
// entradas, serviços prestados, serviços tomados e CT-e, cada lista com os totais (quantidade, valor, ICMS, ICMS-ST, IPI,
// retenções) e o resumo por CFOP, por CST e por NBS. As canceladas aparecem na lista e não entram nas somas.
import type { ItemDoXml, NotaDoSieg, NotasSieg } from './index';

const centavos = (v: number) => Math.round((Number(v) || 0) * 100);
const reais = (c: number) => c / 100;
/** dd/mm/aaaa → aaaammdd (para ordenar) */
const ordemDaData = (d: string) => d.split('/').reverse().join('');

export type AbaDoSieg = 'saidas' | 'entradas' | 'prestados' | 'tomados' | 'ctes';
export const ABAS_DO_SIEG: readonly { id: AbaDoSieg; rotulo: string }[] = [
  { id: 'saidas', rotulo: 'Saídas' }, { id: 'entradas', rotulo: 'Entradas' },
  { id: 'prestados', rotulo: 'Serviços prestados' }, { id: 'tomados', rotulo: 'Serviços tomados' }, { id: 'ctes', rotulo: 'CT-e' },
];

/** Uma nota na lista de uma aba: a outra parte (o destinatário nas saídas, o emitente nas entradas) e os impostos dela. */
export interface LinhaDaNotaSieg {
  /** a posição da nota na lista de origem (emitidas ou recebidas): a NFS-e não tem chave */
  id: string;
  chave: string; tipo: NotaDoSieg['tipo']; numero: string; serie: string; data: string;
  nome: string; doc: string; valor: number;
  icms: number; st: number; ipi: number;
  retencoes: { imposto: string; valor: number }[];
  /** NFS-e: o NBS e a descrição do serviço */
  nbs: string; descricao: string;
  cfops: string[];
  cancelada: boolean;
}

/** Uma linha do resumo por CFOP, CST ou NBS. */
export interface GrupoDoSieg { codigo: string; notas: number; itens: number; valor: number; icms: number; st: number; ipi: number }

export interface ResumoDaAba {
  aba: AbaDoSieg;
  /** as notas, as mais novas primeiro */
  linhas: LinhaDaNotaSieg[];
  /** sem as canceladas */
  quantidade: number;
  canceladas: number;
  /** o valor das canceladas (11/11/2026: "quero que tenha na tela a informação do valor de notas canceladas"); fora do `valor` */
  valorCanceladas: number;
  valor: number;
  icms: number; st: number; ipi: number;
  /** as retenções somadas por imposto (NFS-e) */
  retencoes: { imposto: string; valor: number }[];
  retido: number;
  porCfop: GrupoDoSieg[];
  porCst: GrupoDoSieg[];
  porNbs: GrupoDoSieg[];
  /** quantas NF-e da lista vieram sem itens (o resumo passou do tamanho): o CFOP e o CST ficam incompletos */
  semItens: number;
}

export interface PainelDoSieg {
  abas: Record<AbaDoSieg, ResumoDaAba>;
  /** o total de notas (sem as canceladas) de todas as abas */
  total: number;
}

interface PecaDoGrupo { codigo: string; chave: string; item: ItemDoXml | null; valor: number }

const soma = (itens: ItemDoXml[], campo: 'icms' | 'st' | 'ipi') => itens.reduce((s, i) => s + centavos(i[campo] || 0), 0);

function agrupar(pecas: PecaDoGrupo[]): GrupoDoSieg[] {
  const mapa = new Map<string, { notas: Set<string>; itens: number; valor: number; icms: number; st: number; ipi: number }>();
  for (const l of pecas) {
    const g = mapa.get(l.codigo) || { notas: new Set<string>(), itens: 0, valor: 0, icms: 0, st: 0, ipi: 0 };
    g.notas.add(l.chave);
    g.itens++;
    g.valor += centavos(l.valor);
    if (l.item) { g.icms += centavos(l.item.icms || 0); g.st += centavos(l.item.st || 0); g.ipi += centavos(l.item.ipi || 0); }
    mapa.set(l.codigo, g);
  }
  return [...mapa.entries()]
    .map(([codigo, g]) => ({ codigo, notas: g.notas.size, itens: g.itens, valor: reais(g.valor), icms: reais(g.icms), st: reais(g.st), ipi: reais(g.ipi) }))
    .sort((a, b) => b.valor - a.valor || a.codigo.localeCompare(b.codigo));
}

function resumir(aba: AbaDoSieg, origem: { n: NotaDoSieg; id: string }[], lado: 'emitidas' | 'recebidas'): ResumoDaAba {
  const linhas: LinhaDaNotaSieg[] = origem.map(({ n, id }) => {
    const itens = n.itens || [];
    const outra = lado === 'emitidas' ? n.destinatario : n.emitente;
    return {
      id, chave: n.chave, tipo: n.tipo, numero: n.numero, serie: n.serie, data: n.data,
      nome: outra.nome, doc: outra.doc, valor: Number(n.valor) || 0,
      icms: n.tipo === 'CT-e' ? Number(n.icms) || 0 : reais(soma(itens, 'icms')), st: reais(soma(itens, 'st')), ipi: reais(soma(itens, 'ipi')),
      retencoes: (n.retencoes || []).map(r => ({ imposto: r.imposto, valor: Number(r.valor) || 0 })),
      nbs: n.nbs || '', descricao: n.descricao || '',
      cfops: n.tipo === 'CT-e' ? (n.cfop ? [n.cfop] : []) : [...new Set(itens.map(i => i.cfop).filter(Boolean))].sort(),
      cancelada: !!n.cancelada,
    };
  }).sort((a, b) => ordemDaData(b.data).localeCompare(ordemDaData(a.data)) || b.numero.localeCompare(a.numero, 'pt-BR', { numeric: true }));
  const valem = origem.filter(o => !o.n.cancelada);
  const porCfop: PecaDoGrupo[] = [];
  const porCst: PecaDoGrupo[] = [];
  const porNbs: PecaDoGrupo[] = [];
  let semItens = 0;
  for (const { n, id } of valem) {
    const valor = Number(n.valor) || 0;
    if (n.tipo === 'NFS-e') { porNbs.push({ codigo: n.nbs || 'Sem NBS', chave: id, item: null, valor }); continue; }
    if (n.tipo === 'CT-e') { porCfop.push({ codigo: n.cfop || 'Sem CFOP', chave: id, item: { ncm: '', cfop: n.cfop || '', cst: '', cest: '', valor, icms: n.icms }, valor }); continue; }
    if (!(n.itens || []).length) { semItens++; continue; }
    for (const i of n.itens || []) {
      porCfop.push({ codigo: i.cfop || 'Sem CFOP', chave: id, item: i, valor: i.valor });
      porCst.push({ codigo: i.cst || 'Sem CST', chave: id, item: i, valor: i.valor });
    }
  }
  const imposto = new Map<string, number>();
  for (const { n } of valem) for (const r of n.retencoes || []) imposto.set(r.imposto, (imposto.get(r.imposto) || 0) + centavos(r.valor));
  const vivas = linhas.filter(l => !l.cancelada);
  const total = (campo: 'valor' | 'icms' | 'st' | 'ipi') => reais(vivas.reduce((s, l) => s + centavos(l[campo]), 0));
  return {
    aba, linhas, quantidade: vivas.length, canceladas: linhas.length - vivas.length,
    valorCanceladas: reais(linhas.filter(l => l.cancelada).reduce((s, l) => s + centavos(l.valor), 0)),
    valor: total('valor'), icms: total('icms'), st: total('st'), ipi: total('ipi'),
    retencoes: [...imposto.entries()].map(([i, v]) => ({ imposto: i, valor: reais(v) })).sort((a, b) => b.valor - a.valor),
    retido: reais([...imposto.values()].reduce((s, v) => s + v, 0)),
    porCfop: agrupar(porCfop), porCst: agrupar(porCst), porNbs: agrupar(porNbs), semItens,
  };
}

/**
 * Tudo que o resumo dos XMLs do mês diz da empresa: saídas (NF-e e NFC-e emitidas), entradas (NF-e e NFC-e recebidas),
 * serviços prestados (NFS-e emitidas), serviços tomados (NFS-e recebidas) e CT-e (os recebidos e os emitidos).
 */
export function painelDoSieg(x: NotasSieg): PainelDoSieg {
  const emitidas = x.emitidas.map((n, i) => ({ n, id: 'e' + i }));
  const recebidas = x.recebidas.map((n, i) => ({ n, id: 'r' + i }));
  const mercadoria = (n: NotaDoSieg) => n.tipo === 'NF-e' || n.tipo === 'NFC-e';
  const abas: Record<AbaDoSieg, ResumoDaAba> = {
    saidas: resumir('saidas', emitidas.filter(o => mercadoria(o.n)), 'emitidas'),
    entradas: resumir('entradas', recebidas.filter(o => mercadoria(o.n)), 'recebidas'),
    prestados: resumir('prestados', emitidas.filter(o => o.n.tipo === 'NFS-e'), 'emitidas'),
    tomados: resumir('tomados', recebidas.filter(o => o.n.tipo === 'NFS-e'), 'recebidas'),
    // o CT-e recebido mostra a transportadora (o emitente)
    ctes: resumir('ctes', [...recebidas, ...emitidas].filter(o => o.n.tipo === 'CT-e'), 'recebidas'),
  };
  return { abas, total: Object.values(abas).reduce((s, a) => s + a.quantidade, 0) };
}

/** A nota de volta, pelo id da linha (para abrir o espelho). */
export function notaDaLinha(x: NotasSieg, id: string): NotaDoSieg | null {
  const lista = id[0] === 'e' ? x.emitidas : x.recebidas;
  return lista[Number(id.slice(1))] || null;
}

/** A busca da tabela: número, data, nome ou CNPJ, CFOP, e o valor (com ou sem pontos e vírgula). */
export function linhaCombina(l: LinhaDaNotaSieg, busca: string): boolean {
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  if ([l.numero, l.data, l.nome, l.doc, l.nbs, l.descricao, l.cfops.join(' ')].join(' ').toLowerCase().includes(q)) return true;
  const digitos = q.replace(/\D/g, '');
  return !!digitos && l.valor.toFixed(2).replace('.', '').includes(digitos);
}
