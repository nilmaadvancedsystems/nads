// Linhas de uma planilha (.xls, .xlsx) ou de um .csv, tudo em memória.
// O .csv é lido aqui mesmo (UTF-8, ou Windows-1252 quando o UTF-8 não serve; separador ; , ou tab)
// para os acentos e o "1.234,56" chegarem inteiros.
import * as XLSX from 'xlsx';

export type Linha = unknown[];

function decodificar(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes(String.fromCharCode(0xfffd)) ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

/** Quantas vezes o caractere aparece na linha, fora das aspas. */
function foraDasAspas(linha: string, c: string): number {
  let n = 0, aspas = false;
  for (const ch of linha) { if (ch === '"') aspas = !aspas; else if (ch === c && !aspas) n++; }
  return n;
}

/**
 * O separador é o que divide as linhas do começo do arquivo do mesmo jeito (o título solto na primeira linha, com uma vírgula
 * no texto, não decide nada). No empate, a ordem: o ";" primeiro, o "," por último (a vírgula também é a dos centavos).
 */
function separador(linhas: readonly string[]): string {
  const nota = (c: string) => {
    const vezes = new Map<number, number>();
    for (const l of linhas.slice(0, 20)) { const n = foraDasAspas(l, c); if (n) vezes.set(n, (vezes.get(n) || 0) + 1); }
    return [...vezes].reduce((m, [n, q]) => (q > m[0] || (q === m[0] && n > m[1]) ? [q, n] : m), [0, 0]);
  };
  return [';', '\t', ','].map(c => ({ c, n: nota(c) })).sort((a, b) => b.n[0] - a.n[0] || b.n[1] - a.n[1])[0].c;
}

/** CSV com aspas ("a;b" fica numa célula só; "" vira "). */
export function linhasDoCsv(texto: string): Linha[] {
  const semBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const linhas = semBom.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!linhas.length) return [];
  const sep = separador(linhas);
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
