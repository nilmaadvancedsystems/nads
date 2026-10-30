// O conversor de planilha (30/10/2026): xls, xlsx, ods e csv de entrada; csv ou xlsx de saída. Lido e escrito no
// navegador, com o xlsx (SheetJS). O csv sai com ';' e BOM (o Excel em português abre certo); a planilha de saída leva
// todas as abas, e o csv leva só a primeira (o csv não tem abas).
import * as XLSX from 'xlsx';

export type FormatoDeEntrada = 'xls' | 'xlsx' | 'ods' | 'csv';
export type FormatoDeSaida = 'csv' | 'xlsx';

/** O formato pelo nome do arquivo, ou null se não for planilha. */
export function formatoDaPlanilha(nome: string): FormatoDeEntrada | null {
  const m = /\.(xls|xlsx|ods|csv)$/i.exec(nome.trim());
  return m ? (m[1].toLowerCase() as FormatoDeEntrada) : null;
}

/** O texto do csv: UTF-8 se for válido; senão, Windows-1252 (o que o Excel costuma gravar). */
function textoDoCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** O separador do csv: ';' (o do Excel em português) ou ',' (o padrão), pelo cabeçalho. */
function separadorDoCsv(texto: string): string {
  const primeira = texto.split(/\r?\n/)[0] ?? '';
  return primeira.split(';').length > primeira.split(',').length ? ';' : ',';
}

/** Converte a planilha e devolve os bytes, o nome novo e o tipo para baixar. */
export function converterPlanilha(bytes: Uint8Array, nomeOrigem: string, destino: FormatoDeSaida): { bytes: Uint8Array; nome: string; tipo: string } {
  const origem = formatoDaPlanilha(nomeOrigem);
  if (!origem) throw new Error('Formato não aceito: escolha um arquivo .xls, .xlsx, .ods ou .csv.');
  const base = nomeOrigem.replace(/\.[^.]+$/, '');
  const livro = origem === 'csv'
    ? (() => { const texto = textoDoCsv(bytes); return XLSX.read(texto, { type: 'string', FS: separadorDoCsv(texto) }); })()
    : XLSX.read(bytes, { type: 'array' });
  if (!livro.SheetNames.length) throw new Error('A planilha não tem nenhuma aba com dados.');

  if (destino === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(livro.Sheets[livro.SheetNames[0]], { FS: ';' });
    return { bytes: new TextEncoder().encode('\uFEFF' + csv), nome: base + '.csv', tipo: 'text/csv;charset=utf-8' };
  }
  const xlsx = XLSX.write(livro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return { bytes: new Uint8Array(xlsx), nome: base + '.xlsx', tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}
