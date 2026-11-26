// O Rateio de frete para fora da tela (25/11/2026: "Exportar planilha" e "Imprimir"): o que está na tela, pelo CT-e ou
// digitado, numa planilha de uma aba e numa folha A4. Os dois saem das mesmas tabelas (relatorioDoRateio): o cabeçalho
// (a empresa, a competência e o CT-e ou "digitado"), os totais (produtos, frete e desconto), as notas do CT-e com o frete
// de cada uma, o rateio pelas tributações (valor, IPI, %, frete, desconto e base) e, como a planilha "RATEIO - FRETE" do
// Fiscal, os NCMs do ST com a alíquota e o ICMS; cada tabela com a linha de soma. Puro: a tela manda o que mostra.
import * as XLSX from 'xlsx';
import type { AgruparPor, LinhaComIcms, Rateio, RateioDoCte } from './rateio';

export type CelulaDoRateio = string | number;
/** como a coluna sai: texto, dinheiro (1.234,56) ou porcentagem (o número já em %, 12,5 = 12,50%) */
export type FormatoDaColuna = 'texto' | 'valor' | 'pct';

export interface TabelaDoRateio {
  titulo: string;
  colunas: readonly { rotulo: string; formato: FormatoDaColuna }[];
  linhas: CelulaDoRateio[][];
  /** a linha de soma (o "Total"); vazio onde não se soma */
  soma: CelulaDoRateio[];
}

export interface RelatorioDoRateio {
  titulo: string;
  /** rótulo e valor: a empresa, a competência e o CT-e (ou "Digitado") */
  cabecalho: [string, CelulaDoRateio][];
  totais: [string, number][];
  tabelas: TabelaDoRateio[];
  /** o nome do arquivo, sem a extensão */
  nome: string;
}

export interface EntradaDoRelatorioDoRateio {
  empresa?: { codigo: number; nome: string } | null;
  /** AAAA-MM */
  competencia?: string;
  /** o CT-e rateado; sem ele, o rateio digitado à mão */
  cte?: { numero: string; transportadora: string; data: string; valor: number } | null;
  agrupar?: AgruparPor;
  rateio: Rateio;
  /** o detalhe de cada linha do rateio, na mesma ordem (os CFOPs da tributação ou as tributações do CFOP) */
  detalhes?: readonly string[];
  /** as NF-e que o CT-e leva, com o frete de cada uma */
  notas?: RateioDoCte['notas'];
  /** os cartões "pelos NCMs" da tela (o ST; pelo CT-e, também o aberto pelo clique) */
  ncms?: readonly { titulo: string; linhas: readonly LinhaComIcms[]; icms: number }[];
}

const centavos = (v: number) => Math.round(v * 100) / 100;
const somar = (xs: readonly number[]) => centavos(xs.reduce((t, x) => t + x, 0));
/** AAAA-MM → MM/AAAA */
const mesAno = (c: string) => (/^\d{4}-\d{2}$/.test(c) ? c.slice(5) + '/' + c.slice(0, 4) : c);
/** o que não pode ir no nome de um arquivo */
const paraArquivo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

/** As tabelas do rateio, na ordem da tela: é o que a planilha e a folha mostram. */
export function relatorioDoRateio(e: EntradaDoRelatorioDoRateio): RelatorioDoRateio {
  const r = e.rateio;
  const cte = e.cte || null;
  const cabecalho: [string, CelulaDoRateio][] = [];
  if (e.empresa) cabecalho.push(['Empresa', e.empresa.codigo + ' · ' + e.empresa.nome]);
  if (e.empresa && e.competencia) cabecalho.push(['Competência', mesAno(e.competencia)]);
  if (cte) cabecalho.push(['CT-e', cte.numero], ['Transportadora', cte.transportadora], ['Data do CT-e', cte.data], ['Valor do CT-e', cte.valor]);
  else cabecalho.push(['Origem', 'Digitado (sem o XML)']);

  const tabelas: TabelaDoRateio[] = [];
  const notas = e.notas || [];
  if (cte && notas.length) {
    tabelas.push({
      titulo: 'Notas transportadas',
      colunas: [{ rotulo: 'Número', formato: 'texto' }, { rotulo: 'Emitente', formato: 'texto' }, { rotulo: 'Produtos', formato: 'valor' }, { rotulo: '%', formato: 'pct' }, { rotulo: 'Frete', formato: 'valor' }],
      linhas: notas.map(n => [n.numero, n.emitente, n.produtos, n.pct, n.frete]),
      soma: ['Total', '', somar(notas.map(n => n.produtos)), notas.reduce((t, n) => t + n.pct, 0), somar(notas.map(n => n.frete))],
    });
  }

  const porCfop = !!cte && e.agrupar === 'cfop';
  const detalhes = e.detalhes || [];
  const comDetalhe = detalhes.some(Boolean);
  const comDetalheSe = <T,>(x: T): T[] => (comDetalhe ? [x] : []);
  tabelas.push({
    titulo: porCfop ? 'Pelos CFOPs' : 'Pelas tributações',
    colunas: [
      { rotulo: porCfop ? 'CFOP' : 'Tributação', formato: 'texto' },
      ...comDetalheSe({ rotulo: porCfop ? 'Tributações' : 'CFOPs', formato: 'texto' as const }),
      { rotulo: 'Valor', formato: 'valor' }, { rotulo: 'IPI', formato: 'valor' }, { rotulo: '%', formato: 'pct' },
      { rotulo: 'Frete', formato: 'valor' }, { rotulo: 'Desconto', formato: 'valor' }, { rotulo: 'Base de cálculo', formato: 'valor' },
    ],
    linhas: [
      ...r.linhas.map((l, i) => [l.rotulo, ...comDetalheSe(detalhes[i] || ''), l.valor, l.ipi, l.pct, l.frete, l.desconto, l.base]),
      ...(r.foraDaLista ? [['Fora das linhas', ...comDetalheSe(''), r.foraDaLista.valor, '', (r.foraDaLista.valor * 100) / r.total, r.foraDaLista.frete, r.foraDaLista.desconto, '']] : []),
    ],
    soma: ['Total', ...comDetalheSe(''), r.total, r.soma.ipi, r.foraDaLista ? 100 : r.soma.pct, r.frete, r.desconto, r.soma.base],
  });

  for (const c of e.ncms || []) {
    const ls = c.linhas;
    tabelas.push({
      titulo: c.titulo + ' · pelos NCMs',
      colunas: [
        { rotulo: 'NCM', formato: 'texto' }, { rotulo: 'Valor', formato: 'valor' }, { rotulo: 'IPI', formato: 'valor' }, { rotulo: '%', formato: 'pct' },
        { rotulo: 'Frete', formato: 'valor' }, { rotulo: 'Base de cálculo', formato: 'valor' }, { rotulo: 'Alíquota', formato: 'pct' }, { rotulo: 'ICMS', formato: 'valor' },
      ],
      linhas: ls.map(l => [l.rotulo, l.valor, l.ipi, l.pct, l.frete, l.base, l.aliquota, l.icms]),
      soma: ['Total', somar(ls.map(l => l.valor)), somar(ls.map(l => l.ipi)), ls.reduce((t, l) => t + l.pct, 0), somar(ls.map(l => l.frete)), somar(ls.map(l => l.base)), '', c.icms],
    });
  }

  const nome = paraArquivo(['Rateio de frete', e.empresa ? String(e.empresa.codigo) : '', cte ? 'CT-e ' + cte.numero : 'digitado', e.empresa && e.competencia ? e.competencia : ''].filter(Boolean).join(' '));
  return {
    titulo: 'Rateio de frete',
    cabecalho,
    totais: [['Total dos produtos', r.total], ['Frete', r.frete], ['Desconto', r.desconto]],
    tabelas,
    nome,
  };
}

// ---------- a planilha ----------

const FORMATO_DO_XLSX: Record<Exclude<FormatoDaColuna, 'texto'>, string> = { valor: '#,##0.00', pct: '0.00"%"' };

/** A planilha (uma aba, "Rateio"): o cabeçalho e os totais em rótulo e valor; depois cada tabela com título, colunas e soma. */
export function planilhaDoRateio(rel: RelatorioDoRateio): Uint8Array {
  const linhas: CelulaDoRateio[][] = [];
  const formatos = new Map<string, string>();
  const por = (r: number, c: number, f: FormatoDaColuna | undefined) => { if (f && f !== 'texto') formatos.set(XLSX.utils.encode_cell({ r, c }), FORMATO_DO_XLSX[f]); };
  linhas.push([rel.titulo], []);
  for (const [rotulo, valor] of rel.cabecalho) { if (typeof valor === 'number') por(linhas.length, 1, 'valor'); linhas.push([rotulo, valor]); }
  linhas.push([], ['Totais']);
  for (const [rotulo, valor] of rel.totais) { por(linhas.length, 1, 'valor'); linhas.push([rotulo, valor]); }
  for (const t of rel.tabelas) {
    linhas.push([], [t.titulo], t.colunas.map(c => c.rotulo));
    for (const l of [...t.linhas, t.soma]) {
      l.forEach((v, c) => { if (typeof v === 'number') por(linhas.length, c, t.colunas[c]?.formato); });
      linhas.push(l);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  for (const [endereco, z] of formatos) { const cel = ws[endereco] as XLSX.CellObject | undefined; if (cel && cel.t === 'n') cel.z = z; }
  const colunas = Math.max(2, ...rel.tabelas.map(t => t.colunas.length));
  ws['!cols'] = Array.from({ length: colunas }, (_, i) => ({ wch: i === 0 ? 24 : i === 1 ? 34 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rateio');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

// ---------- a folha para imprimir ----------

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const num = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** a célula como a tela mostra: 1.234,56; 12,50% */
export function textoDaCelula(v: CelulaDoRateio, f: FormatoDaColuna): string {
  if (typeof v !== 'number') return v;
  return f === 'pct' ? num(v) + '%' : f === 'valor' ? num(v) : String(v);
}

/**
 * A folha A4 em pé: a logo (se vier) e o título, o cabeçalho em duas colunas, os totais em três caixas e as tabelas com o
 * cabeçalho preto (repete na página seguinte) e a linha de soma em negrito.
 */
export function htmlDoRateio(rel: RelatorioDoRateio, opcoes: { logo?: { definicao: string; uso: string }; emitidoEm?: Date } = {}): string {
  const dado = ([rotulo, valor]: [string, CelulaDoRateio]) => `<div><span>${esc(rotulo)}</span><b>${esc(textoDaCelula(valor, 'valor'))}</b></div>`;
  const tabela = (t: TabelaDoRateio) => {
    const cls = (i: number) => (t.colunas[i]?.formato === 'texto' ? ' class="t"' : '');
    const linha = (l: CelulaDoRateio[]) => l.map((v, i) => `<td${cls(i)}>${esc(textoDaCelula(v, t.colunas[i]?.formato ?? 'texto'))}</td>`).join('');
    return `<section class="bloco"><h2>${esc(t.titulo)}</h2><table>
<thead><tr>${t.colunas.map((c, i) => `<th${cls(i)}>${esc(c.rotulo)}</th>`).join('')}</tr></thead>
<tbody>${t.linhas.map(l => `<tr>${linha(l)}</tr>`).join('\n')}</tbody>
<tfoot><tr>${linha(t.soma)}</tr></tfoot></table></section>`;
  };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(rel.nome)}</title>
<style>
  @page{size:A4 portrait;margin:10mm}
  :root{color-scheme:light}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#000;font-size:8.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .topo{display:flex;align-items:center;justify-content:space-between;gap:8mm;margin-bottom:3mm;padding-bottom:2mm;border-bottom:.4mm solid #000}
  .topo .logo svg{height:13mm;width:auto;display:block}
  h1{font-size:15pt;margin:0}
  .dados{display:grid;grid-template-columns:1fr 1fr;gap:1mm 6mm;margin:2mm 0 3mm}
  .dados div{display:flex;gap:2mm}
  .dados span{color:#444;min-width:26mm}
  .totais{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-bottom:2mm}
  .totais div{border:.3mm solid #000;padding:1.5mm 2mm}
  .totais span{display:block;color:#444}
  .totais b{font-size:11pt}
  .bloco{margin-top:4mm}
  h2{font-size:9pt;margin:0 0 1.5mm;padding:1mm 1.5mm;background:#000;color:#fff;letter-spacing:.03em}
  table{width:100%;border-collapse:collapse}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th{border-bottom:.4mm solid #000;font-weight:700;padding:1mm;text-align:right;white-space:nowrap}
  td{border-bottom:.2mm solid #999;padding:.9mm 1mm;text-align:right;white-space:nowrap}
  .t{text-align:left}
  td.t{white-space:normal}
  tfoot td{font-weight:700;border-top:.4mm solid #000;border-bottom:0}
  .pe{margin-top:6mm;color:#444;font-size:7.5pt;display:flex;justify-content:space-between}
</style></head><body>
${opcoes.logo ? opcoes.logo.definicao : ''}<div class="topo"><h1>${esc(rel.titulo)}</h1>${opcoes.logo ? `<span class="logo">${opcoes.logo.uso}</span>` : ''}</div>
<div class="dados">${rel.cabecalho.map(dado).join('')}</div>
<div class="totais">${rel.totais.map(([rotulo, v]) => `<div><span>${esc(rotulo)}</span><b>${num(v)}</b></div>`).join('')}</div>
${rel.tabelas.map(tabela).join('\n')}
<div class="pe"><span>A base de cálculo é valor + IPI + frete − desconto; o ICMS é a base × a alíquota do NCM.</span>${opcoes.emitidoEm ? `<span>Emitido em ${opcoes.emitidoEm.toLocaleDateString('pt-BR')}</span>` : ''}</div>
</body></html>`;
}
