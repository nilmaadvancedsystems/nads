// A Projeção do Fator R para fora da tela (26/11/2026): Exportar Excel e Imprimir, como o Rateio de frete. As duas saem da
// mesma tabela (relatorioDoFatorR): o cabeçalho (a empresa, o CNPJ, o ano da projeção e o Fator R de hoje) e uma linha por
// mês, com a receita, a folha, de onde veio cada uma, o fator do mês, a RBT12, a FS12, o Fator R do PA, o Anexo e a folha que
// falta para 28%. Puro: a tela manda o que mostra.
import * as XLSX from 'xlsx';
import { FATOR_R_EM_PCT, type FatorRDoPa, type FonteDoValor, type LinhaDoFatorR } from './projecao';

export type CelulaDoFatorR = string | number;
export type FormatoDaColunaDoFatorR = 'texto' | 'valor' | 'pct';

export interface RelatorioDoFatorR {
  titulo: string;
  cabecalho: [string, string][];
  colunas: readonly { rotulo: string; formato: FormatoDaColunaDoFatorR }[];
  linhas: CelulaDoFatorR[][];
  /** o Anexo de cada linha (para colorir na folha); null sem receita */
  anexos: ('III' | 'V' | null)[];
  /** o nome do arquivo, sem a extensão */
  nome: string;
}

export const ROTULO_DA_FONTE: Record<FonteDoValor, string> = { pgdas: 'PGDAS-D', pdf: 'PDF do PGDAS-D', digitado: 'Digitado' };
/** 'aaaa-mm' → 'mm/aaaa' */
export const mesAno = (c: string) => (/^\d{4}-\d{2}$/.test(c) ? c.slice(5) + '/' + c.slice(0, 4) : c);
const paraArquivo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
const num = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface EntradaDoRelatorioDoFatorR {
  empresa: { codigo: number; nome: string; cnpj?: string };
  ano: number;
  linhas: readonly LinhaDoFatorR[];
  /** o Fator R do PA de agora (o "Fator R - banco de dados" da planilha) */
  hoje?: FatorRDoPa | null;
}

export function relatorioDoFatorR(e: EntradaDoRelatorioDoFatorR): RelatorioDoFatorR {
  const cabecalho: [string, string][] = [['Empresa', e.empresa.codigo + ' · ' + e.empresa.nome]];
  if (e.empresa.cnpj) cabecalho.push(['CNPJ', e.empresa.cnpj]);
  cabecalho.push(['Projeção', String(e.ano)]);
  if (e.hoje && e.hoje.fator != null) {
    cabecalho.push(['Fator R do PA ' + mesAno(e.hoje.pa), num(e.hoje.fator) + '% · Anexo ' + e.hoje.anexo + ' (' + mesAno(e.hoje.de) + ' a ' + mesAno(e.hoje.ate) + ')']);
  }
  const vazio = (v: number | null | undefined): CelulaDoFatorR => (v == null ? '' : v);
  return {
    titulo: 'Projeção do Fator R ' + e.ano,
    cabecalho,
    colunas: [
      { rotulo: 'PA', formato: 'texto' }, { rotulo: 'Receita do mês', formato: 'valor' }, { rotulo: 'Origem', formato: 'texto' },
      { rotulo: 'Folha do mês', formato: 'valor' }, { rotulo: 'Origem', formato: 'texto' }, { rotulo: 'Fator do mês', formato: 'pct' },
      { rotulo: 'RBT12', formato: 'valor' }, { rotulo: 'FS12', formato: 'valor' }, { rotulo: 'Fator R', formato: 'pct' },
      { rotulo: 'Anexo', formato: 'texto' }, { rotulo: 'Folha que falta (' + num(FATOR_R_EM_PCT).replace(',00', '') + '%)', formato: 'valor' },
    ],
    linhas: e.linhas.map(l => [
      mesAno(l.competencia), vazio(l.receita?.valor), l.receita ? ROTULO_DA_FONTE[l.receita.fonte] : '',
      vazio(l.folha?.valor), l.folha ? ROTULO_DA_FONTE[l.folha.fonte] : '', vazio(l.fatorDoMes),
      l.rbt12, l.fs12, vazio(l.fator), l.anexo || '', vazio(l.folhaQueFalta),
    ]),
    anexos: e.linhas.map(l => l.anexo),
    nome: paraArquivo('Projeção Fator R ' + e.ano + ' ' + e.empresa.codigo),
  };
}

// ---------- a planilha ----------

const FORMATO_DO_XLSX: Record<Exclude<FormatoDaColunaDoFatorR, 'texto'>, string> = { valor: '#,##0.00', pct: '0.00"%"' };

/** A planilha (uma aba, "Fator R"): o título, o cabeçalho em rótulo e valor e a tabela dos meses. */
export function planilhaDoFatorR(rel: RelatorioDoFatorR): Uint8Array {
  const linhas: CelulaDoFatorR[][] = [[rel.titulo], []];
  for (const [r, v] of rel.cabecalho) linhas.push([r, v]);
  linhas.push([], rel.colunas.map(c => c.rotulo));
  const inicio = linhas.length;
  linhas.push(...rel.linhas);
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  rel.linhas.forEach((l, i) => l.forEach((v, c) => {
    const f = rel.colunas[c]?.formato;
    const cel = ws[XLSX.utils.encode_cell({ r: inicio + i, c })] as XLSX.CellObject | undefined;
    if (typeof v === 'number' && f && f !== 'texto' && cel && cel.t === 'n') cel.z = FORMATO_DO_XLSX[f];
  }));
  ws['!cols'] = rel.colunas.map((_, i) => ({ wch: i === 0 ? 22 : i === 2 || i === 4 ? 15 : 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fator R');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

// ---------- a folha para imprimir ----------

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
/** a célula como a tela mostra: 1.234,56; 12,50% */
export function textoDaCelulaDoFatorR(v: CelulaDoFatorR, f: FormatoDaColunaDoFatorR): string {
  if (typeof v !== 'number') return v;
  return f === 'pct' ? num(v) + '%' : f === 'valor' ? num(v) : String(v);
}

/** A folha A4 deitada: a logo (se vier), o título, o cabeçalho e a tabela; o Fator R em negrito e o Anexo III/V colorido. */
export function htmlDoFatorR(rel: RelatorioDoFatorR, opcoes: { logo?: { definicao: string; uso: string }; emitidoEm?: Date } = {}): string {
  const iFator = rel.colunas.findIndex(c => c.rotulo === 'Fator R');
  const iAnexo = rel.colunas.findIndex(c => c.rotulo === 'Anexo');
  const td = (v: CelulaDoFatorR, i: number, anexo: 'III' | 'V' | null) => {
    const f = rel.colunas[i]?.formato ?? 'texto';
    const cls = [f === 'texto' ? 't' : '', i === iFator ? 'f' : '', i === iAnexo && anexo ? 'a' + anexo : ''].filter(Boolean).join(' ');
    return `<td${cls ? ` class="${cls}"` : ''}>${esc(textoDaCelulaDoFatorR(v, f))}</td>`;
  };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(rel.nome)}</title>
<style>
  @page{size:A4 landscape;margin:9mm}
  :root{color-scheme:light}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#000;font-size:8.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .topo{display:flex;align-items:center;justify-content:space-between;gap:8mm;margin-bottom:3mm;padding-bottom:2mm;border-bottom:.4mm solid #000}
  .topo .logo svg{height:12mm;width:auto;display:block}
  h1{font-size:15pt;margin:0}
  .dados{display:grid;grid-template-columns:1fr 1fr;gap:1mm 6mm;margin:2mm 0 3mm}
  .dados div{display:flex;gap:2mm}
  .dados span{color:#444;min-width:34mm}
  table{width:100%;border-collapse:collapse}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th{background:#000;color:#fff;font-weight:700;padding:1.2mm 1mm;text-align:right;white-space:nowrap}
  td{border-bottom:.2mm solid #999;padding:.9mm 1mm;text-align:right;white-space:nowrap}
  .t{text-align:left}
  td.f{font-weight:700;background:#ffe9a8}
  td.aIII{color:#0a6b2d;font-weight:700}
  td.aV{color:#b3261e;font-weight:700}
  .pe{margin-top:5mm;color:#444;font-size:7.5pt;display:flex;justify-content:space-between;gap:6mm}
</style></head><body>
${opcoes.logo ? opcoes.logo.definicao : ''}<div class="topo"><h1>${esc(rel.titulo)}</h1>${opcoes.logo ? `<span class="logo">${opcoes.logo.uso}</span>` : ''}</div>
<div class="dados">${rel.cabecalho.map(([r, v]) => `<div><span>${esc(r)}</span><b>${esc(v)}</b></div>`).join('')}</div>
<table><thead><tr>${rel.colunas.map((c, i) => `<th${rel.colunas[i].formato === 'texto' ? ' class="t"' : ''}>${esc(c.rotulo)}</th>`).join('')}</tr></thead>
<tbody>${rel.linhas.map((l, j) => `<tr>${l.map((v, i) => td(v, i, rel.anexos[j])).join('')}</tr>`).join('\n')}</tbody></table>
<div class="pe"><span>Fator R = folha dos 12 meses antes do PA (FS12) ÷ receita bruta dos mesmos 12 meses (RBT12). De ${num(FATOR_R_EM_PCT)}% para cima, Anexo III; abaixo, Anexo V.</span>${opcoes.emitidoEm ? `<span>Emitido em ${opcoes.emitidoEm.toLocaleDateString('pt-BR')}</span>` : ''}</div>
</body></html>`;
}
