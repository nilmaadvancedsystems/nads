// O resultado por conta (22/10/2026, refeito no mesmo dia: "quero melhorar a aba de resultados" — o ano mês a mês,
// agrupar pelo plano, ver os lançamentos, exportar e o período): as entradas e as saídas do Caixa em colunas (os meses
// do ano, ou o período contra o anterior e o mesmo do ano passado), somadas pela árvore do plano de contas (cada grupo
// com o subtotal dos de baixo). Puro: sem banco e sem tela.
import { xlsxDeLinhas, type CelulaDoDemonstrativo } from './demonstrativo';
import { compararCodigos, type ContaDoPlano, type LancamentoDeCaixa, type TipoDeLancamento } from './index';

const emCentavos = (v: number) => Math.round(v * 100);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const p2 = (n: number) => String(n).padStart(2, '0');
const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** uma coluna do resultado: o rótulo e o período (de e ate inclusive, AAAA-MM-DD) */
export interface ColunaDoResultado { chave: string; rotulo: string; de: string; ate: string }

export type PeriodoDoResultado = 'mes' | 'trimestre' | 'ano';

/** as 12 colunas do ano (jan a dez) */
export function colunasDoAno(ano: number): ColunaDoResultado[] {
  return MESES.map((m, i) => ({ chave: ano + '-' + p2(i + 1), rotulo: m, de: `${ano}-${p2(i + 1)}-01`, ate: `${ano}-${p2(i + 1)}-${p2(ultimoDia(ano, i + 1))}` }));
}

/** o período (mês, trimestre ou ano) que contém o mês de referência (AAAA-MM), deslocado em n períodos para trás */
function periodo(tipo: PeriodoDoResultado, ref: string, voltar: number): ColunaDoResultado {
  const ano = Number(ref.slice(0, 4)), mes = Number(ref.slice(5, 7));
  if (tipo === 'ano') {
    const a = ano - voltar;
    return { chave: String(a), rotulo: String(a), de: `${a}-01-01`, ate: `${a}-12-31` };
  }
  const tamanho = tipo === 'trimestre' ? 3 : 1;
  const inicio = tipo === 'trimestre' ? Math.floor((mes - 1) / 3) * 3 : mes - 1;
  const total = ano * 12 + inicio - voltar * tamanho;
  const a = Math.floor(total / 12), m = (total % 12) + 1;
  const fim = m + tamanho - 1;
  const rotulo = tipo === 'trimestre' ? `${Math.floor((m - 1) / 3) + 1}º tri/${a}` : `${MESES[m - 1]}/${a}`;
  return { chave: tipo + a + '-' + p2(m), rotulo, de: `${a}-${p2(m)}-01`, ate: `${a}-${p2(fim)}-${p2(ultimoDia(a, fim))}` };
}

/** o comparativo: o período, o anterior e o mesmo período do ano passado */
export function colunasComparativas(tipo: PeriodoDoResultado, ref: string): ColunaDoResultado[] {
  const atual = periodo(tipo, ref, 0);
  const anterior = periodo(tipo, ref, 1);
  const anoPassado = tipo === 'ano' ? periodo('ano', ref, 1) : periodo(tipo, String(Number(ref.slice(0, 4)) - 1) + ref.slice(4), 0);
  // no ano, o anterior e o ano passado são o mesmo: fica só um
  return tipo === 'ano' ? [atual, anterior] : [atual, anterior, anoPassado];
}

/** uma linha do resultado: uma conta do plano (ou "Sem conta"), com os valores por coluna e as de baixo */
export interface LinhaDoResultado {
  /** o id da conta ('' = sem conta) */
  conta: string;
  codigo: string;
  rotulo: string;
  /** 0 na raiz */
  fundo: number;
  /** por coluna, em reais (o da conta e o de todas as de baixo) */
  valores: number[];
  total: number;
  filhos: LinhaDoResultado[];
}

export interface Resultado {
  colunas: ColunaDoResultado[];
  entradas: LinhaDoResultado[];
  saidas: LinhaDoResultado[];
  totais: { entradas: number[]; saidas: number[]; resultado: number[] };
}

/** as linhas de um tipo (entradas ou saídas), pela árvore do plano; só as contas com movimento nas colunas */
function arvore(lancamentos: readonly LancamentoDeCaixa[], plano: readonly ContaDoPlano[], colunas: readonly ColunaDoResultado[], tipo: TipoDeLancamento): LinhaDoResultado[] {
  const porId = new Map(plano.map(c => [c.id, c]));
  const soma = new Map<string, number[]>();
  const somar = (id: string, i: number, v: number) => { const x = soma.get(id) || colunas.map(() => 0); x[i] += v; soma.set(id, x); };
  for (const l of lancamentos) {
    if (l.tipo !== tipo) continue;
    const i = colunas.findIndex(c => l.data >= c.de && l.data <= c.ate);
    if (i < 0) continue;
    const v = emCentavos(l.valor);
    // a conta e todos os grupos de cima (o pai, o pai do pai…)
    let c = l.conta ? porId.get(l.conta) : undefined;
    if (!c) { somar('', i, v); continue; }
    const vistos = new Set<string>();
    while (c && !vistos.has(c.id)) { vistos.add(c.id); somar(c.id, i, v); c = c.pai ? porId.get(c.pai) : undefined; }
  }
  const linha = (c: ContaDoPlano | null, fundo: number): LinhaDoResultado => {
    const valores = (soma.get(c?.id ?? '') || colunas.map(() => 0)).map(x => x / 100);
    const filhos = c ? plano.filter(f => f.pai === c.id && soma.has(f.id)).sort((a, b) => compararCodigos(a.codigo, b.codigo)).map(f => linha(f, fundo + 1)) : [];
    return { conta: c?.id ?? '', codigo: c?.codigo ?? '', rotulo: c ? c.codigo + ' ' + c.descricao : 'Sem conta', fundo, valores, total: valores.reduce((s, x) => s + emCentavos(x), 0) / 100, filhos };
  };
  const raizes = plano.filter(c => (!c.pai || !porId.has(c.pai)) && soma.has(c.id)).sort((a, b) => compararCodigos(a.codigo, b.codigo)).map(c => linha(c, 0));
  if (soma.has('')) raizes.push(linha(null, 0));
  return raizes;
}

/** o resultado nas colunas: as entradas e as saídas pela árvore do plano e os totais (entradas − saídas) */
export function resultadoEmColunas(lancamentos: readonly LancamentoDeCaixa[], plano: readonly ContaDoPlano[], colunas: readonly ColunaDoResultado[]): Resultado {
  const entradas = arvore(lancamentos, plano, colunas, 'E');
  const saidas = arvore(lancamentos, plano, colunas, 'S');
  const totalDe = (ls: LinhaDoResultado[]) => colunas.map((_, i) => ls.reduce((s, l) => s + emCentavos(l.valores[i]), 0) / 100);
  const e = totalDe(entradas), s = totalDe(saidas);
  return { colunas: [...colunas], entradas, saidas, totais: { entradas: e, saidas: s, resultado: e.map((x, i) => (emCentavos(x) - emCentavos(s[i])) / 100) } };
}

/** a variação de a sobre b, em % com uma casa (null quando b é zero) */
export const variacao = (a: number, b: number) => (b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null);

/** os lançamentos de uma conta e das de baixo ('' = os sem conta), de um tipo, entre de e ate, por data */
export function lancamentosDaConta(lancamentos: readonly LancamentoDeCaixa[], plano: readonly ContaDoPlano[], conta: string, tipo: TipoDeLancamento, de: string, ate: string): LancamentoDeCaixa[] {
  const porId = new Map(plano.map(c => [c.id, c]));
  const dentro = (id: string | undefined): boolean => {
    if (!conta) return !id || !porId.has(id);
    const vistos = new Set<string>();
    for (let c = id ? porId.get(id) : undefined; c && !vistos.has(c.id); c = c.pai ? porId.get(c.pai) : undefined) { if (c.id === conta) return true; vistos.add(c.id); }
    return false;
  };
  return lancamentos.filter(l => l.tipo === tipo && l.data >= de && l.data <= ate && dentro(l.conta)).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

/** a planilha do resultado (aba "Resultado"): as contas com o recuo da árvore, as colunas, o total (no ano) e os totais */
export function planilhaDoResultado(r: Resultado, titulo: string, comTotal: boolean): Uint8Array {
  const linhas: CelulaDoDemonstrativo[][] = [[titulo], [], ['Conta', ...r.colunas.map(c => c.rotulo), ...(comTotal ? ['Total'] : [])]];
  const soma = (vs: number[]) => vs.reduce((s, x) => s + emCentavos(x), 0) / 100;
  const descer = (ls: LinhaDoResultado[]) => { for (const l of ls) { linhas.push(['  '.repeat(l.fundo) + l.rotulo, ...l.valores, ...(comTotal ? [l.total] : [])]); descer(l.filhos); } };
  const bloco = (nome: string, ls: LinhaDoResultado[], totais: number[]) => {
    linhas.push([nome]);
    descer(ls);
    linhas.push(['Total de ' + nome.toLowerCase(), ...totais, ...(comTotal ? [soma(totais)] : [])], []);
  };
  bloco('Entradas', r.entradas, r.totais.entradas);
  bloco('Saídas', r.saidas, r.totais.saidas);
  linhas.push(['Resultado (entradas − saídas)', ...r.totais.resultado, ...(comTotal ? [soma(r.totais.resultado)] : [])]);
  return xlsxDeLinhas(linhas, 'Resultado', [44, ...r.colunas.map(() => 14), ...(comTotal ? [16] : [])]);
}
