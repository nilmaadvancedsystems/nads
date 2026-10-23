// O Demonstrativo de Caixa em planilha (19/10/2026: "preciso de um relatório em planilha obedecendo os filtros"), no jeito
// do Demonstrativo do Toriba: o título com o período, o Saldo inicial, o cabeçalho (Data, Histórico, Conta, Entradas,
// Saídas, Observações), uma linha por lançamento listado, os totais e o Saldo final. Puro: a tela manda o que está nela.
import * as XLSX from 'xlsx';
import type { ContaDoPlano, LancamentoDeCaixa } from './index';

export type CelulaDoDemonstrativo = string | number;

export interface EntradaDoDemonstrativo {
  /** AAAA-MM-DD */
  de: string;
  ate: string;
  /** o saldo de antes do período (o do cartão da tela, que não depende dos filtros) */
  saldoInicial: number;
  /** exatamente as linhas que estão na tela (período, busca e tipo) */
  itens: { lancamento: LancamentoDeCaixa; conta?: ContaDoPlano }[];
  /** a busca ou o tipo estão filtrando: o saldo final considera só as linhas listadas */
  filtrado: boolean;
}

export const CABECALHO_DO_DEMONSTRATIVO = ['Data', 'Histórico', 'Conta', 'Entradas', 'Saídas', 'Observações'] as const;

const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };
const centavos = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100;

/** O nome do arquivo: "Caixa AAAA-MM-DD a AAAA-MM-DD.xlsx". */
export const nomeDoDemonstrativo = (de: string, ate: string) => `Caixa ${de} a ${ate}.xlsx`;

export interface LinhasDoDemonstrativo {
  /** a planilha como linhas de células (as colunas de valor são números; a outra ponta fica vazia) */
  linhas: CelulaDoDemonstrativo[][];
  entradas: number;
  saidas: number;
  saldoFinal: number;
  /** o índice (0) das linhas que têm só números de valor, para a planilha formatar como R$ */
  linhaDoCabecalho: number;
}

/** As linhas do relatório, na ordem em que a planilha as mostra. */
export function linhasDoDemonstrativo(e: EntradaDoDemonstrativo): LinhasDoDemonstrativo {
  let ent = 0, sai = 0;
  const corpo: CelulaDoDemonstrativo[][] = e.itens.map(({ lancamento: l, conta }) => {
    const c = centavos(l.valor);
    if (l.tipo === 'E') ent += c; else sai += c;
    return [dataBr(l.data), l.descricao, conta ? `${conta.codigo} ${conta.descricao}` : '', l.tipo === 'E' ? l.valor : '', l.tipo === 'S' ? l.valor : '', l.observacoes ?? ''];
  });
  const saldoFinal = reais(centavos(e.saldoInicial) + ent - sai);
  const linhas: CelulaDoDemonstrativo[][] = [
    [`Demonstrativo de Caixa — ${dataBr(e.de)} a ${dataBr(e.ate)}`],
    [],
    ['', 'Saldo inicial', '', e.saldoInicial],
    [...CABECALHO_DO_DEMONSTRATIVO],
    ...corpo,
    ['', 'Totais', '', reais(ent), reais(sai)],
    ['', 'Saldo final', '', saldoFinal],
  ];
  if (e.filtrado) linhas.push([], ['Há filtro de busca ou de tipo: o saldo final considera só as linhas listadas acima.']);
  return { linhas, entradas: reais(ent), saidas: reais(sai), saldoFinal, linhaDoCabecalho: 3 };
}

/** Um .xlsx de uma aba só a partir das linhas: os números saem formatados em R$ (o mesmo de todas as planilhas do Financeiro). */
export function xlsxDeLinhas(linhas: CelulaDoDemonstrativo[][], aba: string, larguras: number[]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  for (const [endereco, cel] of Object.entries(ws)) {
    if (endereco[0] !== '!' && (cel as XLSX.CellObject).t === 'n') (cel as XLSX.CellObject).z = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  }
  ws['!cols'] = larguras.map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba);
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

/** O .xlsx do demonstrativo (aba "Caixa"), com os valores formatados em R$. */
export function planilhaDoDemonstrativo(e: EntradaDoDemonstrativo): Uint8Array {
  return xlsxDeLinhas(linhasDoDemonstrativo(e).linhas, 'Caixa', [12, 44, 30, 16, 16, 36]);
}

// ---------- para imprimir direto (23/10/2026: "quero que coloque na parte do financeiro essa planilha para impressão direto") ----------

/** quantas linhas a folha leva: as que faltam saem em branco, para escrever à mão (a planilha do escritório tem 36; 26 é
 *  o que cabe numa folha deitada com o cabeçalho, os totais e o saldo final em Calibri 12; medido) */
export const LINHAS_DA_FOLHA_DO_CAIXA = 26;

const escHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const rs = (v: number | '' | undefined) => (v === '' || v == null ? '' : '<span class="' + (v < 0 ? 'neg' : '') + '">R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/^/, v < 0 ? '-' : '') + '</span>');

/**
 * O Demonstrativo de Caixa para imprimir, no desenho da planilha do escritório (A4 deitado): o título no meio, o Saldo
 * inicial e o cabeçalho em cinza claro, as cinco colunas (Data, Histórico, Conta, Entradas, Saídas) com borda fina, uma
 * linha por lançamento e, até encher a folha, linhas em branco; embaixo, os Totais e o Saldo final em cinza. Calibri 12.
 */
export function htmlDoDemonstrativo(e: EntradaDoDemonstrativo): string {
  const r = linhasDoDemonstrativo(e);
  const corpo = e.itens.map(({ lancamento: l, conta }) => `<tr><td class="c">${escHtml(dataBr(l.data))}</td><td>${escHtml(l.descricao)}</td><td>${escHtml(conta ? conta.codigo + ' ' + conta.descricao : '')}</td><td class="n">${l.tipo === 'E' ? rs(l.valor) : ''}</td><td class="n">${l.tipo === 'S' ? rs(l.valor) : ''}</td></tr>`);
  const vazias = Math.max(0, LINHAS_DA_FOLHA_DO_CAIXA - corpo.length);
  for (let i = 0; i < vazias; i++) corpo.push('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Caixa ${escHtml(e.de)} a ${escHtml(e.ate)}</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  :root{color-scheme:light}
  *{box-sizing:border-box}
  html,body{margin:0;background:#fff}
  body{font-family:Calibri,"Segoe UI",Arial,sans-serif;font-size:12pt;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:12pt;font-weight:700;text-align:center;margin:0 0 6mm}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  td,th{border:.25mm solid #000;padding:.6mm 1.5mm;height:4.5mm;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  th,.cinza td,.cinza th{background:#f2f2f2;font-weight:700}
  th{text-align:left}
  .c{text-align:center}
  .n{text-align:right}
  .neg{color:#c00}
  .sem-borda td{border:none;background:none}
  .aviso{margin-top:3mm;font-size:10pt}
</style></head><body>
<h1>${escHtml(String(r.linhas[0][0]))}</h1>
<table>
<colgroup><col style="width:10.5%"><col style="width:42%"><col style="width:20.5%"><col style="width:13.5%"><col style="width:13.5%"></colgroup>
<thead>
<tr class="cinza"><td class="sem-fundo" style="background:none;border:none"></td><td colspan="2">Saldo inicial</td><td class="n">${rs(e.saldoInicial)}</td><td style="background:none;border:none"></td></tr>
<tr><th class="c">Data</th><th>Histórico</th><th>Conta</th><th class="n">Entradas</th><th class="n">Saídas</th></tr>
</thead>
<tbody>
${corpo.join('\n')}
<tr><td colspan="3" class="c"><b>Totais</b></td><td class="n"><b>${rs(r.entradas)}</b></td><td class="n"><b>${rs(r.saidas)}</b></td></tr>
<tr class="cinza"><td style="background:none;border:none"></td><td colspan="2" class="c">Saldo final</td><td class="n">${rs(r.saldoFinal)}</td><td style="background:none;border:none"></td></tr>
</tbody></table>
${e.filtrado ? '<p class="aviso">Há filtro de busca ou de tipo: o saldo final considera só as linhas listadas.</p>' : ''}
</body></html>`;
}
