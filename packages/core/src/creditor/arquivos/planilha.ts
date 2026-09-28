// Linhas de uma planilha (.xls, .xlsx) ou de um .csv, tudo em memória.
// O .csv é lido aqui mesmo (UTF-8, ou Windows-1252 quando o UTF-8 não serve; separador ; , ou tab)
// para os acentos e o "1.234,56" chegarem inteiros.
import * as XLSX from 'xlsx';

export type Linha = unknown[];

function decodificar(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes(String.fromCharCode(0xfffd)) ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

function separador(primeira: string): string {
  const conta = (c: string) => primeira.split(c).length - 1;
  return [';', '\t', ','].sort((a, b) => conta(b) - conta(a))[0];
}

/** CSV com aspas ("a;b" fica numa célula só; "" vira "). */
export function linhasDoCsv(texto: string): Linha[] {
  const semBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const linhas = semBom.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!linhas.length) return [];
  const sep = separador(linhas[0]);
  return linhas.map(l => {
    const celulas: string[] = [];
    let atual = '', aspas = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (aspas) {
        if (ch === '"' && l[i + 1] === '"') { atual += '"'; i++; } else if (ch === '"') aspas = false; else atual += ch;
      } else if (ch === '"') aspas = true;
      else if (ch === sep) { celulas.push(atual.trim()); atual = ''; } else atual += ch;
    }
    celulas.push(atual.trim());
    return celulas;
  });
}

/** Primeira aba (ou o .csv) como linhas de valores crus. Lança Error com mensagem para a tela. */
export function linhasDaPlanilha(buf: ArrayBuffer, nome: string): Linha[] {
  if (/\.(csv|txt)$/i.test(nome)) {
    const l = linhasDoCsv(decodificar(buf));
    if (!l.length) throw new Error('O arquivo está vazio.');
    return l;
  }
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true, raw: true }); }
  catch { throw new Error('O arquivo parece estar corrompido ou em um formato não suportado.'); }
  const aba = wb.SheetNames[0];
  if (!aba) throw new Error('A planilha não tem nenhuma aba.');
  const linhas = XLSX.utils.sheet_to_json<Linha>(wb.Sheets[aba], { header: 1, raw: true, defval: null, blankrows: false });
  if (!linhas.length) throw new Error('A planilha está vazia.');
  return linhas;
}

export function textoDaCelula(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}
