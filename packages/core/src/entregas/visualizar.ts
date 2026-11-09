// Ver um arquivo do Drive na própria tela, sem baixar (09/11/2026: "tem como eu apenas visualizar as coisas do drive sem
// precisar baixar?"). PDF e imagem o navegador já mostra (o Abrir de sempre, numa aba). Planilha (.xls, .xlsx, .csv,
// .ods) e texto (.txt, .xml, .ofx) o navegador só sabe baixar: o robô entrega o conteúdo pelo banco (aberturasDrive
// modo "ler", até 4 MB) e aqui ele vira tabela ou texto para a janela de visualização.
import * as XLSX from 'xlsx';
import type { ItemDoDrive } from './drive';

export type ComoVer = 'planilha' | 'texto';

/** O robô entrega para leitura até 4 MB (robo/abrir-do-drive.js, LER_MAX). */
export const VER_MAX_BYTES = 4 * 1024 * 1024;
/** Até quantas linhas e colunas de cada aba a tela mostra (planilha maior: o resto pelo Baixar). */
export const VER_MAX_LINHAS = 2000;
export const VER_MAX_COLUNAS = 60;
const VER_MAX_TEXTO = 400_000;

/** Dá para ver na tela? (null = abre como antes: PDF e imagem numa aba, o resto baixa) */
export function comoVer(it: Pick<ItemDoDrive, 'n' | 'x' | 's' | 't'>): ComoVer | null {
  if (it.t === 'd' || (it.s && it.s > VER_MAX_BYTES)) return null;
  const n = it.n.toLowerCase();
  // documento do Google (t = g) o robô exporta em PDF: abre como antes
  if (it.t === 'g') return null;
  if (/\.(xlsx|xlsm|xls|csv|ods)$/.test(n)) return 'planilha';
  if (/\.(txt|xml|ofx|ofc|json|log|ret|rem)$/.test(n)) return 'texto';
  return null;
}

/** Bytes de texto: UTF-8, ou Windows-1252 quando o UTF-8 não serve (os .csv e .txt do Alterdata). */
export function textoDosBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const t = utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8;
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

export interface AbaParaVer {
  nome: string;
  /** as células como aparecem no Excel (datas e números já formatados) */
  linhas: string[][];
  colunas: number;
  totalLinhas: number;
  /** passou de VER_MAX_LINHAS ou VER_MAX_COLUNAS: a tela avisa que o resto só baixando */
  cortada: boolean;
}

/** As abas da planilha, prontas para a tabela. Lança Error com a mensagem para a tela. */
export function planilhaParaVer(bytes: Uint8Array, nome: string): AbaParaVer[] {
  let wb: XLSX.WorkBook;
  // .xls que na verdade é texto (CSV, tabulado ou HTML, como o Alterdata exporta): lido como texto, pelo conteúdo, e
  // não pela extensão (senão os acentos quebram e as datas viram 5/1/26)
  const binario = (bytes[0] === 0xd0 && bytes[1] === 0xcf) || (bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0x09 && bytes[1] === 0x08);
  try {
    wb = /\.csv$/i.test(nome) || !binario
      ? XLSX.read(textoDosBytes(bytes), { type: 'string', raw: true })
      : XLSX.read(bytes, { type: 'array', cellDates: true });
  } catch {
    throw new Error('não consegui ler a planilha (arquivo corrompido ou formato que o navegador não lê)');
  }
  const abas = wb.SheetNames.map(aba => {
    const ws = wb.Sheets[aba];
    const todas = ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', blankrows: true, dateNF: 'dd/mm/yyyy' }) : [];
    // tira as linhas vazias do fim (o Excel guarda formatação lá embaixo)
    let fim = todas.length;
    while (fim > 0 && !(todas[fim - 1] || []).some(c => String(c ?? '').trim())) fim--;
    const usadas = todas.slice(0, fim);
    const largura = usadas.reduce((m, l) => {
      let k = (l || []).length;
      while (k > 0 && !String((l || [])[k - 1] ?? '').trim()) k--;
      return Math.max(m, k);
    }, 0);
    const colunas = Math.min(largura, VER_MAX_COLUNAS);
    const linhas = usadas.slice(0, VER_MAX_LINHAS).map(l => Array.from({ length: colunas }, (_, i) => String((l || [])[i] ?? '')));
    return { nome: aba, linhas, colunas, totalLinhas: usadas.length, cortada: usadas.length > VER_MAX_LINHAS || largura > VER_MAX_COLUNAS };
  });
  if (!abas.length) throw new Error('a planilha não tem nenhuma aba');
  return abas;
}

/** O texto para a tela (cortado num tamanho que o navegador mostra sem travar). */
export function textoParaVer(bytes: Uint8Array): { texto: string; cortado: boolean } {
  const t = textoDosBytes(bytes);
  return t.length > VER_MAX_TEXTO ? { texto: t.slice(0, VER_MAX_TEXTO), cortado: true } : { texto: t, cortado: false };
}

/** "A", "B", … "Z", "AA" — o nome da coluna, como no Excel. */
export function letraDaColuna(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
