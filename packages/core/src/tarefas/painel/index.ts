// O painel de cada tarefa do Fiscal (Vitor, 06/10/2026: "quero fazer uma checklist disfarçada, com tabelinha, gráfico
// para evitar de ficar sem graça; o que pode ser importado coloque para importar"): a partir das notas importadas na
// Conferência (as mesmas do Contábil) e da contagem do SIEG, os números que cada tarefa confere — por CFOP, por dia, as
// retenções e a composição da receita. Puro: a tela só desenha.
import { descDoCfop } from '../../conferencia/regras/cfop';
import type { Nota, NotaServico } from '../../conferencia/tipos';

/** As notas da Conferência que o painel usa (a empresa inteira; o painel filtra pela competência). */
export interface NotasDoPainel { entradas: Nota[]; saidas: Nota[]; tomados: NotaServico[]; prestados: NotaServico[] }

/** A natureza da operação pelo CFOP, para a base de cálculo (ST, devolução, remessa…). */
export type ClasseDoCfop = 'venda' | 'st' | 'servico' | 'devolucao' | 'remessa' | 'ativo' | 'outras';

export const CLASSES: Record<ClasseDoCfop, string> = {
  venda: 'Venda', st: 'Com ST', servico: 'Serviço', devolucao: 'Devolução', remessa: 'Remessa', ativo: 'Ativo e uso/consumo', outras: 'Outras',
};

/** A classe de um CFOP pelos 3 últimos dígitos (a tabela CFOP: x401–x409 ST, x201–x211 e x410–x413 devolução…). */
export function classeDoCfop(cfop: string): ClasseDoCfop {
  const c = String(cfop || '').replace(/\D/g, '');
  if (c.length !== 4) return 'outras';
  const r = Number(c.slice(1));
  if ((r >= 201 && r <= 211) || (r >= 410 && r <= 413) || r === 503 || r === 553 || r === 555 || r === 556 || (r >= 660 && r <= 662)) return 'devolucao';
  if (r >= 401 && r <= 409) return 'st';
  if (r === 933 || (r >= 301 && r <= 303) || (r >= 351 && r <= 357)) return 'servico';
  if (r >= 101 && r <= 125) return 'venda';
  if (r >= 551 && r <= 557) return 'ativo';
  if (r >= 901 && r <= 949) return 'remessa';
  return 'outras';
}

const mesDe = (comp: string) => String(comp || '').slice(0, 7);
const doPeriodo = <T extends { comp: string }>(lista: readonly T[], meses: readonly string[]) => lista.filter(n => meses.includes(mesDe(n.comp)));
const centavos = (v: number) => Math.round(v * 100) / 100;
const soma = (xs: readonly { valor: number }[]) => centavos(xs.reduce((t, x) => t + (Number(x.valor) || 0), 0));

export interface LinhaPorCfop { cfop: string; desc: string; classe: ClasseDoCfop; qtd: number; valor: number; notas: Nota[] }
export interface DiaDoMes { dia: number; valor: number; qtd: number }
export interface ResumoDeNotas { qtd: number; total: number; porCfop: LinhaPorCfop[]; porDia: DiaDoMes[]; semConta: number; comConta: boolean }

/** As notas do período: quantas, o total, por CFOP (do maior valor ao menor) e por dia do mês. */
export function resumoDeNotas(notas: readonly Nota[], meses: readonly string[]): ResumoDeNotas {
  const doMes = doPeriodo(notas, meses);
  const cfops = new Map<string, LinhaPorCfop>();
  const dias = new Map<number, DiaDoMes>();
  for (const n of doMes) {
    const v = Number(n.valor) || 0;
    const l = cfops.get(n.cfop) || { cfop: n.cfop, desc: descDoCfop(n.cfop, n.desc), classe: classeDoCfop(n.cfop), qtd: 0, valor: 0, notas: [] };
    l.qtd++; l.valor = centavos(l.valor + v); l.notas.push(n);
    cfops.set(n.cfop, l);
    const dia = Number(String(n.data || '').split('/')[0]) || 0;
    if (dia) {
      const d = dias.get(dia) || { dia, valor: 0, qtd: 0 };
      d.qtd++; d.valor = centavos(d.valor + v);
      dias.set(dia, d);
    }
  }
  const ultimo = meses.length === 1 ? new Date(Number(meses[0].slice(0, 4)), Number(meses[0].slice(5, 7)), 0).getDate() : 31;
  return {
    // o relatório por item repete a nota em várias linhas: conta cada nota uma vez
    qtd: new Set(doMes.map(n => n.numero + '|' + n.nome + '|' + n.data)).size,
    total: soma(doMes),
    porCfop: [...cfops.values()].sort((a, b) => b.valor - a.valor),
    porDia: Array.from({ length: ultimo }, (_, i) => dias.get(i + 1) || { dia: i + 1, valor: 0, qtd: 0 }),
    semConta: doMes.filter(n => !n.conta).length,
    comConta: doMes.some(n => n.conta),
  };
}

export interface FatiaDaComposicao { classe: ClasseDoCfop; rotulo: string; valor: number; pct: number }

/** A composição por classe de CFOP (com os serviços prestados, se vierem), com a fatia de cada uma. */
export function composicao(notas: readonly Nota[], meses: readonly string[], prestados: readonly NotaServico[] = []): FatiaDaComposicao[] {
  const por = new Map<ClasseDoCfop, number>();
  for (const n of doPeriodo(notas, meses)) { const k = classeDoCfop(n.cfop); por.set(k, (por.get(k) || 0) + (Number(n.valor) || 0)); }
  const serv = soma(doPeriodo(prestados, meses));
  if (serv) por.set('servico', (por.get('servico') || 0) + serv);
  const total = [...por.values()].reduce((t, v) => t + v, 0);
  return [...por.entries()].filter(([, v]) => v > 0).map(([k, v]) => ({
    classe: k, rotulo: CLASSES[k], valor: centavos(v), pct: total ? Math.round((v / total) * 1000) / 10 : 0,
  })).sort((a, b) => b.valor - a.valor);
}

export interface LinhaDeRetencao { nome: string; numero: string; tipo: 'Tomado' | 'Prestado'; valor: number; retido: number }
export interface ResumoDeRetencao { total: number; qtd: number; linhas: LinhaDeRetencao[] }

/** As retenções do período (ISS, INSS ou IRRF) nos serviços tomados e prestados, da maior para a menor. */
export function retencoes(tomados: readonly NotaServico[], prestados: readonly NotaServico[], meses: readonly string[], qual: 'issRet' | 'inss' | 'irrf'): ResumoDeRetencao {
  const linhas: LinhaDeRetencao[] = [];
  const juntar = (lista: readonly NotaServico[], tipo: LinhaDeRetencao['tipo']) => {
    for (const n of doPeriodo(lista, meses)) {
      const retido = Number(n[qual]) || 0;
      if (retido > 0) linhas.push({ nome: n.nome, numero: n.numero, tipo, valor: Number(n.valor) || 0, retido });
    }
  };
  juntar(tomados, 'Tomado');
  juntar(prestados, 'Prestado');
  linhas.sort((a, b) => b.retido - a.retido);
  return { total: centavos(linhas.reduce((t, l) => t + l.retido, 0)), qtd: linhas.length, linhas };
}

/** Os serviços do período: quantos, o total e o ISS. */
export function resumoDeServicos(lista: readonly NotaServico[], meses: readonly string[]) {
  const doMes = doPeriodo(lista, meses);
  return { qtd: doMes.length, total: soma(doMes), iss: centavos(doMes.reduce((t, n) => t + (Number(n.iss) || 0), 0)) };
}

/** Quantas notas de cada tipo há no período (para o "Importado" e o "Importar" de cada tarefa). */
export function importadoNoPeriodo(n: NotasDoPainel, meses: readonly string[]) {
  return {
    entradas: doPeriodo(n.entradas, meses).length,
    saidas: doPeriodo(n.saidas, meses).length,
    tomados: doPeriodo(n.tomados, meses).length,
    prestados: doPeriodo(n.prestados, meses).length,
  };
}

export interface LinhaInterestadual { nome: string; ufCfop: string; qtd: number; valor: number }
export interface ResumoInterestadual { qtd: number; total: number; linhas: LinhaInterestadual[] }

/**
 * As entradas de fora do estado (CFOP 2xxx) do período, por fornecedor (Processos do Fiscal, ROT-09: o ICMS das notas
 * recebidas — Antecipação, ST e DIFAL — começa por elas). Do maior valor ao menor; os CFOPs de cada fornecedor juntos.
 */
export function interestaduais(entradas: readonly Nota[], meses: readonly string[]): ResumoInterestadual {
  const fora = doPeriodo(entradas, meses).filter(n => String(n.cfop || '').startsWith('2'));
  const por = new Map<string, LinhaInterestadual>();
  for (const n of fora) {
    const l = por.get(n.nome) || { nome: n.nome, ufCfop: '', qtd: 0, valor: 0 };
    l.qtd++; l.valor = centavos(l.valor + (Number(n.valor) || 0));
    if (!l.ufCfop.split(', ').includes(n.cfop)) l.ufCfop = l.ufCfop ? l.ufCfop + ', ' + n.cfop : n.cfop;
    por.set(n.nome, l);
  }
  return { qtd: fora.length, total: soma(fora), linhas: [...por.values()].sort((a, b) => b.valor - a.valor) };
}

export interface LinhaFiscal { ncm: string; cst: string; cest: string; itens: number; valor: number; notas: Nota[] }
export interface ResumoFiscal { temColunas: boolean; linhas: LinhaFiscal[] }

/**
 * Os itens do período por NCM, CST e CEST (Vitor, 07/10/2026: "Entrada/Saída: CST, CEST, NCM, valor"), do maior valor ao
 * menor. temColunas = o relatório trouxe ao menos uma das colunas (sem elas, a tela pede o relatório com elas).
 */
export function porNcmCstCest(notas: readonly Nota[], meses: readonly string[]): ResumoFiscal {
  const doMes = doPeriodo(notas, meses);
  const temColunas = doMes.some(n => n.ncm || n.cst || n.cest);
  if (!temColunas) return { temColunas, linhas: [] };
  const por = new Map<string, LinhaFiscal>();
  for (const n of doMes) {
    const k = (n.ncm || '') + '|' + (n.cst || '') + '|' + (n.cest || '');
    const l = por.get(k) || { ncm: n.ncm || '', cst: n.cst || '', cest: n.cest || '', itens: 0, valor: 0, notas: [] };
    l.itens++; l.valor = centavos(l.valor + (Number(n.valor) || 0)); l.notas.push(n);
    por.set(k, l);
  }
  return { temColunas, linhas: [...por.values()].sort((a, b) => b.valor - a.valor) };
}

export interface ServicoNaVerificacao {
  tipo: 'Tomado' | 'Prestado'; numero: string; nome: string; nbs: string; descricao: string; valor: number;
  /** a soma das retenções da nota */
  retido: number;
  /** quais (ex.: ISS 50,00) */
  retencoes: { imposto: string; valor: number }[];
}

const RETENCOES: ['issRet' | 'inss' | 'irrf' | 'pis' | 'cofins' | 'csll', string][] = [['issRet', 'ISS'], ['inss', 'INSS'], ['irrf', 'IRRF'], ['pis', 'PIS'], ['cofins', 'COFINS'], ['csll', 'CSLL']];

/**
 * Os serviços do período com o que a nota retém (Vitor, 07/10/2026: "Serviços: NBS, descrição, valor, retidos; ler da NF
 * se tem alguma retenção"): primeiro as que retêm, da maior retenção para a menor; depois as outras, pelo valor.
 */
export function servicosComRetencoes(tomados: readonly NotaServico[], prestados: readonly NotaServico[], meses: readonly string[]): ServicoNaVerificacao[] {
  const linha = (n: NotaServico, tipo: ServicoNaVerificacao['tipo']): ServicoNaVerificacao => {
    const retencoes = RETENCOES.map(([k, imposto]) => ({ imposto, valor: Number(n[k]) || 0 })).filter(r => r.valor > 0);
    return {
      tipo, numero: n.numero, nome: n.nome, nbs: n.nbs || '', descricao: n.descricao || '', valor: Number(n.valor) || 0,
      retido: centavos(retencoes.reduce((t, r) => t + r.valor, 0)), retencoes,
    };
  };
  return [...doPeriodo(tomados, meses).map(n => linha(n, 'Tomado')), ...doPeriodo(prestados, meses).map(n => linha(n, 'Prestado'))]
    .sort((a, b) => b.retido - a.retido || b.valor - a.valor);
}
