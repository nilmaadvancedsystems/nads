// A planilha de uma tabela da tela (Vitor, 07/10/2026: "exportar a tabela atual em Excel lá no DP"): o cabeçalho e as
// linhas, numa aba, com a largura das colunas pelo conteúdo. Puro: devolve os bytes do .xlsx; a tela baixa.
import * as XLSX from 'xlsx';

export type CelulaDaPlanilha = string | number | null;

export function planilhaXlsx(aba: string, cabecalho: readonly string[], linhas: readonly (readonly CelulaDaPlanilha[])[]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet([[...cabecalho], ...linhas.map(l => l.map(v => (v == null ? '' : v)))]);
  ws['!cols'] = cabecalho.map((c, i) => ({ wch: Math.min(60, Math.max(c.length, ...linhas.map(l => String(l[i] ?? '').length)) + 2) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length, c: cabecalho.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba.slice(0, 31));
  const saida: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(saida);
}
