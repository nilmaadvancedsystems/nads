// PDF do banco, lido no próprio navegador com o pdf.js (nada sai da máquina).
// Primeiro tenta a leitura por posição (relatorioDosItens: a tabela do Sicoob, em que cada coluna é
// um bloco de texto); se não achar o cabeçalho, remonta as linhas e lê como texto corrido.
// Só serve para PDF com texto (exportado pelo banco). PDF escaneado ou foto não têm texto.
import type { RelatorioBanco } from '../tipos';
import { lerRelatorioTexto, relatorioDosItens, type ItemPdf } from './banco';

/**
 * Remonta as linhas: pedaços na mesma altura (±2) viram uma linha, da esquerda para a direita;
 * espaço grande entre dois pedaços vira dois espaços (separa as colunas). y de cima para baixo.
 */
export function linhasDosItens(itens: ItemPdf[]): string[] {
  const linhas: { y: number; itens: ItemPdf[] }[] = [];
  for (const it of itens) {
    if (!it.texto.trim()) continue;
    const l = linhas.find(x => Math.abs(x.y - it.y) <= 2);
    if (l) l.itens.push(it); else linhas.push({ y: it.y, itens: [it] });
  }
  return linhas
    .sort((a, b) => a.y - b.y)
    .map(l => {
      let s = '', fim = -Infinity;
      for (const it of l.itens.sort((a, b) => a.x - b.x)) {
        const vao = it.x - fim;
        s += s ? (vao > 6 ? '  ' : vao > 0.5 ? ' ' : '') : '';
        s += it.texto.trim();
        fim = it.x + it.largura;
      }
      return s;
    });
}

/** Os pedaços de texto de cada página, em coordenadas da tela (já considera página girada). workerSrc = o pdf.worker do build legacy. */
export async function itensDoPdf(buf: ArrayBuffer, workerSrc: string): Promise<ItemPdf[][]> {
  // build "legacy": funciona também em Chrome/Edge que não estão na última versão
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true });
  let doc;
  try {
    doc = await tarefa.promise;
  } catch (e) {
    const nome = e instanceof Error ? e.name : '';
    if (nome === 'PasswordException') throw new Error('O PDF está protegido por senha. Exporte de novo sem senha.', { cause: e });
    throw new Error('Não consegui abrir o PDF' + (e instanceof Error && e.message ? ': ' + e.message : '.'), { cause: e });
  }
  const paginas: ItemPdf[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const tela = pagina.getViewport({ scale: 1 });
    const conteudo = await pagina.getTextContent();
    const itens: ItemPdf[] = [];
    for (const it of conteudo.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const m = pdfjs.Util.transform(tela.transform, it.transform);
      itens.push({ texto: it.str, x: m[4], y: m[5], largura: it.width });
    }
    paginas.push(itens);
  }
  await tarefa.destroy();
  if (!paginas.some(p => p.length)) throw new Error('O PDF não tem texto (parece escaneado ou foto). Peça ao banco o PDF exportado.');
  return paginas;
}

/** Relatório do banco a partir do PDF. */
export async function lerRelatorioPdf(buf: ArrayBuffer, workerSrc: string): Promise<RelatorioBanco> {
  const paginas = await itensDoPdf(buf, workerSrc);
  const porPosicao = relatorioDosItens(paginas);
  if (porPosicao && porPosicao.grupos.some(g => g.titulos.length)) return porPosicao;
  return lerRelatorioTexto(paginas.map(p => linhasDosItens(p).join('\n')).join('\n'));
}
