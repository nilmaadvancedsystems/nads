// O faturamento dos clientes (Heverton, 20/10/2026: "relação de faturamento dos clientes"; o usuário decidiu em
// 21/10/2026: é a receita de cada cliente). Uma linha por cliente, com o faturamento de cada mês do período, o total e a
// variação do último mês contra o anterior, e de onde veio cada número. A fonte, na ordem combinada:
//   1. o PGDAS/DAS (a receita bruta declarada): o nads ainda não guarda (fica de fora até ter);
//   2. as notas emitidas no SIEG: siegSaidas/{codigo}_{AAAA-MM}, a soma das NF-e e NFC-e emitidas no mês, sem as
//      canceladas (o robô grava quando a etapa do Fiscal pede; a NFS-e não entra: ela só existe nos XMLs do mês, que
//      são pesados para ler de todos os clientes);
//   3. o SINTEGRA e o balancete: não ficam no banco por mês (fica de fora).
// Sem dado, a célula fica vazia: nada é inventado.
import type { NotasSieg, SaidasSieg } from './index';

export type PeriodoDoFaturamento = 'mes' | 'ano' | '12m';
export const PERIODOS_DO_FATURAMENTO: readonly { valor: PeriodoDoFaturamento; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês' }, { valor: 'ano', rotulo: 'Ano' }, { valor: '12m', rotulo: 'Últimos 12 meses' },
];

/** de onde veio o número */
export const FONTE_SIEG = 'SIEG · NF-e/NFC-e emitidas';
export const FONTE_SIEG_CURTA = 'SIEG';

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** as competências do período (da mais antiga para a mais nova): o mês; o ano inteiro (até o mês escolhido); os 12 meses até ele */
export function competenciasDoPeriodo(periodo: PeriodoDoFaturamento, competencia: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m) return [];
  const ano = Number(m[1]), mes = Number(m[2]);
  if (periodo === 'mes') return [competencia];
  if (periodo === 'ano') return Array.from({ length: mes }, (_, i) => ano + '-' + doisDigitos(i + 1));
  return Array.from({ length: 12 }, (_, i) => { const d = new Date(ano, mes - 12 + i, 1); return d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1); });
}

/** o faturamento do mês pelas saídas do SIEG (null = o robô não trouxe o mês) */
export function faturamentoDasSaidas(s: SaidasSieg | null | undefined): number | null {
  if (!s) return null;
  return Math.round(s.series.reduce((t, x) => t + (Number(x.valor) || 0), 0) * 100) / 100;
}

export interface ValorDoFaturamento { valor: number; fonte: string }
export interface EmpresaDoFaturamento { codigo: number; nome: string; regime: string }
export interface LinhaDoFaturamento extends EmpresaDoFaturamento {
  /** por competência: o valor e a fonte, ou null (sem dado) */
  meses: Record<string, ValorDoFaturamento | null>;
  /** a soma dos meses com dado (null = nenhum mês com dado) */
  total: number | null;
  /** o último mês com dado contra o mês anterior a ele (em %; null = sem os dois) */
  variacao: number | null;
  /** as fontes usadas na linha */
  fontes: string[];
}

/** as linhas do relatório (pelo código; as sem dado em nenhum mês ficam, vazias, a não ser com soComDado) */
export function linhasDoFaturamento(empresas: readonly EmpresaDoFaturamento[], competencias: readonly string[],
  saidasDoMes: (competencia: string) => ReadonlyMap<string, SaidasSieg>, soComDado = false): LinhaDoFaturamento[] {
  return empresas.map(e => {
    const meses: Record<string, ValorDoFaturamento | null> = {};
    for (const c of competencias) {
      const v = faturamentoDasSaidas(saidasDoMes(c).get(String(e.codigo)));
      meses[c] = v == null ? null : { valor: v, fonte: FONTE_SIEG_CURTA };
    }
    const comDado = competencias.filter(c => meses[c]);
    const total = comDado.length ? Math.round(comDado.reduce((t, c) => t + (meses[c] as ValorDoFaturamento).valor, 0) * 100) / 100 : null;
    const ultimo = comDado[comDado.length - 1];
    const i = ultimo ? competencias.indexOf(ultimo) : -1;
    const anterior = i > 0 ? meses[competencias[i - 1]] : null;
    const variacao = ultimo && anterior && anterior.valor > 0 ? Math.round((((meses[ultimo] as ValorDoFaturamento).valor - anterior.valor) / anterior.valor) * 1000) / 10 : null;
    return { ...e, meses, total, variacao, fontes: comDado.length ? [FONTE_SIEG] : [] };
  }).filter(l => !soComDado || l.total != null)
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.codigo - b.codigo);
}

// ---------- o faturamento detalhado de um cliente (22/10/2026: "quando eu clique no cliente abra um faturamento detalhado") ----------

/** um mês do detalhe: a NF-e e a NFC-e separadas, quantas notas, quantas canceladas, o total e a variação */
export interface MesDoDetalhe {
  competencia: string;
  nfe: number | null; nfce: number | null;
  notas: number; canceladas: number;
  total: number | null;
  /** contra o mês anterior com dado (em %) */
  variacao: number | null;
}

const doisCentavos = (v: number) => Math.round(v * 100) / 100;

/** os meses do cliente pelas saídas do SIEG (modelo 55 = NF-e, 65 = NFC-e; o valor já vem sem as canceladas) */
export function mesesDoDetalhe(competencias: readonly string[], saidasDoMes: (competencia: string) => SaidasSieg | null | undefined): MesDoDetalhe[] {
  let anterior: number | null = null;
  return competencias.map(c => {
    const s = saidasDoMes(c);
    if (!s) { return { competencia: c, nfe: null, nfce: null, notas: 0, canceladas: 0, total: null, variacao: null }; }
    const soma = (modelo: string) => { const ss = s.series.filter(x => String(x.modelo) === modelo); return ss.length ? doisCentavos(ss.reduce((t, x) => t + (Number(x.valor) || 0), 0)) : null; };
    const canceladas = s.series.reduce((t, x) => t + x.canceladas.length, 0);
    const notas = s.series.reduce((t, x) => t + x.numeros.length, 0) - canceladas;
    const total = faturamentoDasSaidas(s);
    const variacao = total != null && anterior != null && anterior > 0 ? Math.round(((total - anterior) / anterior) * 1000) / 10 : null;
    if (total != null) anterior = total;
    return { competencia: c, nfe: soma('55'), nfce: soma('65'), notas, canceladas, total, variacao };
  });
}

/** as notas emitidas do mês (o "Baixar XMLs"): para quem vendeu e por CFOP, sem as canceladas */
export interface ResumoDasEmitidas {
  quantidade: number; canceladas: number; valor: number;
  porCliente: { nome: string; doc: string; valor: number; notas: number }[];
  porCfop: { cfop: string; valor: number }[];
}

export function resumoDasEmitidas(n: NotasSieg): ResumoDasEmitidas {
  const vendas = n.emitidas.filter(x => x.tipo === 'NF-e' || x.tipo === 'NFC-e');
  const validas = vendas.filter(x => !x.cancelada);
  const clientes = new Map<string, { nome: string; doc: string; valor: number; notas: number }>();
  const cfops = new Map<string, number>();
  for (const x of validas) {
    const doc = String(x.destinatario?.doc || '');
    const nome = String(x.destinatario?.nome || '').trim() || 'Consumidor (sem identificação)';
    const k = doc || nome;
    const c = clientes.get(k) || { nome, doc, valor: 0, notas: 0 };
    c.valor += x.valor || 0; c.notas++;
    clientes.set(k, c);
    if (x.itens?.length) for (const i of x.itens) cfops.set(i.cfop || '—', (cfops.get(i.cfop || '—') || 0) + (i.valor || 0));
    else cfops.set(x.cfop || '—', (cfops.get(x.cfop || '—') || 0) + (x.valor || 0));
  }
  return {
    quantidade: validas.length,
    canceladas: vendas.length - validas.length,
    valor: doisCentavos(validas.reduce((t, x) => t + (x.valor || 0), 0)),
    porCliente: [...clientes.values()].map(c => ({ ...c, valor: doisCentavos(c.valor) })).sort((a, b) => b.valor - a.valor),
    porCfop: [...cfops.entries()].map(([cfop, valor]) => ({ cfop, valor: doisCentavos(valor) })).sort((a, b) => b.valor - a.valor),
  };
}

/** "set/26" */
export function mesCurto(c: string): string {
  const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const m = /^(\d{4})-(\d{2})$/.exec(c);
  return m ? NOMES[Number(m[2]) - 1] + '/' + m[1].slice(2) : c;
}

/** a planilha: cód., cliente, regime, um mês por coluna, o total, a variação e a fonte */
export function planilhaDoFaturamento(linhas: readonly LinhaDoFaturamento[], competencias: readonly string[]): { cabecalho: string[]; linhas: (string | number | null)[][] } {
  return {
    cabecalho: ['Cód.', 'Cliente', 'Regime', ...competencias.map(mesCurto), 'Total', 'Variação (%)', 'Fonte'],
    linhas: linhas.map(l => [l.codigo, l.nome, l.regime, ...competencias.map(c => l.meses[c]?.valor ?? null), l.total, l.variacao, l.fontes.join('; ')]),
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const brl = (n: number | null) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** o documento para imprimir (A4 deitado; o cabeçalho da tabela se repete em cada página) */
export function htmlDoFaturamento(p: { titulo: string; linhas: readonly LinhaDoFaturamento[]; competencias: readonly string[] }): string {
  const cs = p.competencias;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.titulo)}</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  :root{color-scheme:light}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#000;font-size:7.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:13pt;margin:0 0 1mm}
  p{margin:0 0 3mm;color:#444}
  table{width:100%;border-collapse:collapse}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th{background:#000;color:#fff;font-weight:700;padding:1mm;text-align:right}
  th.t{text-align:left}
  td{border-bottom:.2mm solid #999;padding:.8mm 1mm;text-align:right;white-space:nowrap}
  td.t{text-align:left;max-width:70mm;overflow:hidden;text-overflow:ellipsis}
  td.total{font-weight:700}
</style></head><body>
<h1>${esc(p.titulo)}</h1>
<p>Fonte: ${esc(FONTE_SIEG)} (sem as canceladas; a NFS-e não entra). Célula vazia: o mês não tem dado no nads.</p>
<table><thead><tr><th class="t">Cód.</th><th class="t">Cliente</th><th class="t">Regime</th>${cs.map(c => `<th>${esc(mesCurto(c))}</th>`).join('')}<th>Total</th><th>Var. %</th></tr></thead>
<tbody>${p.linhas.map(l => `<tr><td class="t">${l.codigo}</td><td class="t">${esc(l.nome)}</td><td class="t">${esc(l.regime)}</td>${cs.map(c => `<td>${brl(l.meses[c]?.valor ?? null)}</td>`).join('')}<td class="total">${brl(l.total)}</td><td>${l.variacao == null ? '' : String(l.variacao).replace('.', ',')}</td></tr>`).join('')}</tbody></table>
</body></html>`;
}

/**
 * A curva ABC dos compradores (23/10/2026, o painel do faturamento detalhado: "procura referências… e usa como base"):
 * do maior ao menor, o acumulado em % do total; A até 80%, B até 95%, C o resto (o que passa da linha entra na classe
 * dela). E a concentração: quanto o maior e os 5 maiores pesam.
 */
export type ClasseAbc = 'A' | 'B' | 'C';
export interface CurvaAbc<T> {
  linhas: (T & { pct: number; acumulado: number; classe: ClasseAbc })[];
  porClasse: Record<ClasseAbc, { clientes: number; valor: number; pct: number }>;
  maior: number;
  cinco: number;
}
export function curvaAbc<T extends { valor: number }>(itens: readonly T[]): CurvaAbc<T> {
  const total = itens.reduce((s, x) => s + Math.round(x.valor * 100), 0) / 100;
  const ordem = [...itens].sort((a, b) => b.valor - a.valor);
  let antes = 0;
  const linhas = ordem.map(x => {
    const pct = total ? (x.valor / total) * 100 : 0;
    const classe: ClasseAbc = antes < 80 ? 'A' : antes < 95 ? 'B' : 'C';
    antes += pct;
    return { ...x, pct: Math.round(pct * 10) / 10, acumulado: Math.round(antes * 10) / 10, classe };
  });
  const porClasse = { A: { clientes: 0, valor: 0, pct: 0 }, B: { clientes: 0, valor: 0, pct: 0 }, C: { clientes: 0, valor: 0, pct: 0 } };
  for (const l of linhas) { const c = porClasse[l.classe]; c.clientes++; c.valor = Math.round((c.valor + l.valor) * 100) / 100; }
  for (const c of Object.values(porClasse)) c.pct = total ? Math.round((c.valor / total) * 1000) / 10 : 0;
  const soma = (n: number) => (total ? Math.round((ordem.slice(0, n).reduce((s, x) => s + x.valor, 0) / total) * 1000) / 10 : 0);
  return { linhas, porClasse, maior: soma(1), cinco: soma(5) };
}
