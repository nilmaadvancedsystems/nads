// O OCR do extrato escaneado (Vitor, 13/10/2026: "às vezes o cliente manda scanner ou algo do tipo"): o Tesseract roda
// aqui no navegador, com o português e o motor servidos pelo próprio site (/ocr/, copiados no build pelo vite.config):
// nada vai para fora. O PDF escaneado é desenhado página por página (pdf.js) e a imagem (foto, scanner) vai direto;
// cada linha que o OCR acha vira os pedaços com a posição, no mesmo formato do texto de um PDF, e o leitor de extrato
// do core faz o resto. Tudo só carrega na primeira vez que precisa (o motor tem uns 4 MB).
import type { extrator } from '@nads/core';

type Item = extrator.ItemDeTexto;
/** a escala do desenho do PDF: 2 = ~144 dpi, o bastante para o OCR sem ficar lento */
const ESCALA = 2;
/** a imagem solta vira uma página do tamanho de um A4 (595 pontos de largura), como o PDF */
const LARGURA_A4 = 595;

type Trabalhador = { recognize: (img: HTMLCanvasElement | Blob, opts?: object, saida?: object) => Promise<{ data: Resultado }> };
interface Caixa { x0: number; y0: number; x1: number; y1: number }
interface Resultado { blocks?: { paragraphs: { lines: { bbox: Caixa; words: { text: string; bbox: Caixa }[] }[] }[] }[] | null }

let trabalhador: Promise<Trabalhador> | null = null;
function oTrabalhador(): Promise<Trabalhador> {
  if (!trabalhador) {
    trabalhador = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('por', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', gzip: true }) as unknown as Promise<Trabalhador>;
    })();
    trabalhador.catch(() => { trabalhador = null; });
  }
  return trabalhador;
}

/** As palavras de uma imagem (o canvas da página, ou o arquivo da foto), em pontos com o y para cima (como o pdf.js). */
async function itensDaImagem(img: HTMLCanvasElement | Blob, alturaPx: number, escala: number): Promise<Item[]> {
  const t = await oTrabalhador();
  const { data } = await t.recognize(img, {}, { blocks: true });
  const itens: Item[] = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs) for (const l of p.lines) {
    // a linha inteira com a mesma altura (o fundo dela): as palavras de uma linha não se separam por causa das letras
    const y = (alturaPx - l.bbox.y1) / escala;
    for (const w of l.words) {
      const texto = w.text.trim();
      if (texto) itens.push({ texto, x: w.bbox.x0 / escala, y, largura: Math.max(1, (w.bbox.x1 - w.bbox.x0) / escala) });
    }
  }
  return itens;
}

async function tamanhoDaImagem(blob: Blob): Promise<{ largura: number; altura: number }> {
  const bmp = await createImageBitmap(blob);
  const r = { largura: bmp.width, altura: bmp.height };
  bmp.close();
  return r;
}

/** O OCR do arquivo: uma lista de pedaços por página (o formato do extrator.ItemDeTexto). */
export async function ocrDoArquivo(bytes: Uint8Array, tipo: 'pdf' | 'imagem'): Promise<Item[][]> {
  if (tipo === 'imagem') {
    const blob = new Blob([bytes.slice()]);
    const { largura, altura } = await tamanhoDaImagem(blob);
    return [await itensDaImagem(blob, altura, largura / LARGURA_A4)];
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tarefa = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await tarefa.promise;
  try {
    const paginas: Item[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const vista = pagina.getViewport({ scale: ESCALA });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vista.width);
      canvas.height = Math.ceil(vista.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('o navegador não desenhou a página');
      // fundo branco: o PDF escaneado às vezes vem com transparência
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // intent 'print': sem o requestAnimationFrame, que para quando a aba fica escondida (a pessoa troca de aba e o OCR
      // continuava parado)
      await pagina.render({ canvas, canvasContext: ctx, viewport: vista, intent: 'print' }).promise;
      paginas.push(await itensDaImagem(canvas, canvas.height, ESCALA));
      canvas.width = canvas.height = 0;
    }
    return paginas;
  } finally {
    await tarefa.destroy();
  }
}
