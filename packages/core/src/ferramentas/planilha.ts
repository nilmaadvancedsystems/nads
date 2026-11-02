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

/**
 * O número como o csv traz: com ';' (o Excel em português) a vírgula é o decimal e o ponto o milhar ("1.234,56"); com ','
 * o ponto é o decimal ("1234.56"). O inteiro com zero na frente (CNPJ, CPF, código) e o de mais de 15 dígitos ficam texto.
 * null = não é número.
 */
export function numeroDoCsv(texto: string, separador: string): number | null {
  const t = texto.trim();
  const br = separador === ';';
  if (!(br ? /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/ : /^-?\d+(?:\.\d+)?$/).test(t)) return null;
  const inteiro = t.replace(/^-/, '').split(br ? ',' : '.')[0].replace(/\./g, '');
  if ((inteiro.length > 1 && inteiro.startsWith('0')) || inteiro.length > 15) return null;
  const n = Number(br ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

/** o dia do Excel (o número de série) de uma data dd/mm/aaaa que existe; null se não for */
function diaDoExcel(texto: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [d, me, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const x = Date.UTC(a, me - 1, d);
  const dt = new Date(x);
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== me - 1 || dt.getUTCDate() !== d) return null;
  return (x - Date.UTC(1899, 11, 30)) / 864e5;
}

/**
 * O csv lido sem o SheetJS adivinhar os valores (30/10/2026: ele lia como no Excel americano — "1.234,56" virava 1,23456,
 * "1234,5" virava 12345, "10/05/2026" virava 5 de outubro e o CNPJ perdia o zero da frente): tudo entra como texto, e só o
 * número no jeito do separador vira número e a data dd/mm/aaaa vira data.
 */
function livroDoCsv(texto: string): XLSX.WorkBook {
  const sep = separadorDoCsv(texto);
  const livro = XLSX.read(texto, { type: 'string', FS: sep, raw: true });
  for (const nome of livro.SheetNames) {
    const aba = livro.Sheets[nome];
    for (const ref of Object.keys(aba)) {
      if (ref.startsWith('!')) continue;
      const c = aba[ref] as XLSX.CellObject;
      if (c.t !== 's' || typeof c.v !== 'string') continue;
      const n = numeroDoCsv(c.v, sep);
      const dia = n == null ? diaDoExcel(c.v) : null;
      if (n != null) aba[ref] = { t: 'n', v: n };
      else if (dia != null) aba[ref] = { t: 'n', v: dia, z: 'dd/mm/yyyy', w: c.v.trim() };
    }
  }
  return livro;
}

/**
 * A aba pronta para o csv do Excel em português: a data em dd/mm/aaaa (o formato curto do Excel sai m/d/yy no SheetJS) e
 * o número com a vírgula no decimal e o ponto no milhar (o SheetJS escreve 1,234.56, que o Excel em português lê como texto).
 */
function abaEmPortugues(aba: XLSX.WorkSheet): XLSX.WorkSheet {
  const saida: XLSX.WorkSheet = { ...aba };
  for (const ref of Object.keys(aba)) {
    if (ref.startsWith('!')) continue;
    const c = aba[ref] as XLSX.CellObject;
    if (c.t !== 'n' || typeof c.v !== 'number') continue;
    const formato = typeof c.z === 'string' ? c.z : typeof c.z === 'number' ? XLSX.SSF.get_table()[c.z] : undefined;
    let w: string;
    if (formato && XLSX.SSF.is_date(formato)) w = XLSX.SSF.format(c.v % 1 ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy', c.v);
    else {
      // no formato Geral, o número inteiro (sem o 1,23E+12 que o SheetJS escreve); nos outros, o texto dele com . e , trocados
      const geral = !formato || formato === 'General';
      const base = geral && !/e/i.test(String(c.v)) ? String(c.v) : c.w ?? String(c.v);
      w = base.replace(/[.,]/g, x => (x === '.' ? ',' : '.'));
    }
    saida[ref] = { ...c, w };
  }
  return saida;
}

/** Converte a planilha e devolve os bytes, o nome novo e o tipo para baixar. */
export function converterPlanilha(bytes: Uint8Array, nomeOrigem: string, destino: FormatoDeSaida): { bytes: Uint8Array; nome: string; tipo: string } {
  const origem = formatoDaPlanilha(nomeOrigem);
  if (!origem) throw new Error('Formato não aceito: escolha um arquivo .xls, .xlsx, .ods ou .csv.');
  const base = nomeOrigem.replace(/\.[^.]+$/, '');
  const livro = origem === 'csv' ? livroDoCsv(textoDoCsv(bytes)) : XLSX.read(bytes, { type: 'array', cellNF: true });
  if (!livro.SheetNames.length) throw new Error('A planilha não tem nenhuma aba com dados.');

  if (destino === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(abaEmPortugues(livro.Sheets[livro.SheetNames[0]]), { FS: ';' });
    return { bytes: new TextEncoder().encode('\uFEFF' + csv), nome: base + '.csv', tipo: 'text/csv;charset=utf-8' };
  }
  const xlsx = XLSX.write(livro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return { bytes: new Uint8Array(xlsx), nome: base + '.xlsx', tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}
