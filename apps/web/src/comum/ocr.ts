// O OCR do extrato escaneado (Vitor, 13/10/2026: "às vezes o cliente manda scanner ou algo do tipo"): o Tesseract roda
// aqui no navegador, com o português e o motor servidos pelo próprio site (/ocr/, copiados no build pelo vite.config):
// nada vai para fora. O PDF escaneado é desenhado página por página (pdf.js) e a imagem (foto, scanner) vai direto;
// cada linha que o OCR acha vira os pedaços com a posição, no mesmo formato do texto de um PDF, e o leitor de extrato
// do core faz o resto. Tudo só carrega na primeira vez que precisa (o motor tem uns 4 MB).
import type { extrator } from '@nads/core';

type Item = extrator.ItemDeTexto;
/** a escala do desenho do PDF: 3 = ~216 dpi (Vitor, 14/10/2026: a 2 o BNB escaneado perdia linhas e trocava letras) */
const ESCALA = 3;
/** o limite do preto e branco: o que for mais claro vira branco (o zebrado cinza das tabelas some; o texto, mesmo azul, fica) */
const LIMITE_DO_PRETO = 175;
/** a imagem solta vira uma página do tamanho de um A4 (595 pontos de largura), como o PDF */
const LARGURA_A4 = 595;

type Trabalhador = { setParameters: (p: Record<string, string>) => Promise<unknown>; recognize: (img: HTMLCanvasElement | Blob, opts?: object, saida?: object) => Promise<{ data: Resultado }> };
interface Caixa { x0: number; y0: number; x1: number; y1: number }
interface Resultado { blocks?: { paragraphs: { lines: { bbox: Caixa; words: { text: string; bbox: Caixa }[] }[] }[] }[] | null }

let trabalhador: Promise<Trabalhador> | null = null;
function oTrabalhador(): Promise<Trabalhador> {
  if (!trabalhador) {
    trabalhador = (async () => {
      const { createWorker } = await import('tesseract.js');
      const t = await (createWorker('por', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', gzip: true }) as unknown as Promise<Trabalhador>);
      // a página como um bloco de linhas (o extrato é uma tabela): não junta duas linhas nem troca a ordem das palavras
      await t.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1', user_defined_dpi: String(Math.round(72 * ESCALA)) });
      return t;
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
    for (const w of l.words) {
      const texto = w.text.trim();
      // cada palavra na altura do meio dela (Vitor, 14/10/2026: com a altura da linha do OCR, duas linhas da tabela viravam
      // uma); o leitor junta de novo o que está na mesma altura
      const y = (alturaPx - (w.bbox.y0 + w.bbox.y1) / 2) / escala;
      // o traço ou a barra solta que o OCR inventa nas bordas da tabela não é texto
      if (texto && !/^[—–|_~=]+$/.test(texto)) itens.push({ texto, x: w.bbox.x0 / escala, y, largura: Math.max(1, (w.bbox.x1 - w.bbox.x0) / escala) });
    }
  }
  return itens;
}

/** A página em preto e branco: o cinza claro do fundo vira branco e o texto fica preto (o OCR erra menos). */
function pretoEBranco(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < LIMITE_DO_PRETO ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}


/** O OCR do arquivo: uma lista de pedaços por página (o formato do extrator.ItemDeTexto). */
export async function ocrDoArquivo(bytes: Uint8Array, tipo: 'pdf' | 'imagem'): Promise<Item[][]> {
  if (tipo === 'imagem') {
    // a foto também em preto e branco (o OCR erra menos)
    const bmp = await createImageBitmap(new Blob([bytes.slice()]));
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('o navegador não desenhou a imagem');
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    pretoEBranco(ctx, canvas.width, canvas.height);
    const itens = await itensDaImagem(canvas, canvas.height, canvas.width / LARGURA_A4);
    canvas.width = canvas.height = 0;
    return [itens];
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
      pretoEBranco(ctx, canvas.width, canvas.height);
      paginas.push(await itensDaImagem(canvas, canvas.height, ESCALA));
      canvas.width = canvas.height = 0;
    }
    return paginas;
  } finally {
    await tarefa.destroy();
  }
}
