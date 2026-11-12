// As leituras do PDF que precisam do pdf.js e do desenho do navegador (30/10/2026): as miniaturas, cada página como
// imagem, o texto, o OCR e as páginas em JPG do Comprimir. Tudo no navegador; o PDF não sai do computador. O que mexe
// no arquivo (separar, juntar, girar, numerar, montar o PDF das imagens) é o core (ferramentas.pdf).
import { ferramentas } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { ocrDoArquivo } from '../../../../comum/ocr';

async function pdfjs() {
  const p = await import('pdfjs-dist/legacy/build/pdf.mjs');
  p.GlobalWorkerOptions.workerSrc = workerDoPdf;
  return p;
}

type Pagina = Awaited<ReturnType<Awaited<ReturnType<Awaited<ReturnType<typeof pdfjs>>['getDocument']>['promise']>['getPage']>>;

/** Abre o PDF, passa cada página (1 a n) para `fazer` e fecha. Para no meio se `parar` disser. */
async function cadaPagina(bytes: Uint8Array, fazer: (pagina: Pagina, n: number, total: number) => Promise<void>, parar?: () => boolean, so?: readonly number[]) {
  const p = await pdfjs();
  const tarefa = p.getDocument({ data: bytes.slice() });
  try {
    const doc = await tarefa.promise;
    const numeros = so ? so.map(i => i + 1) : Array.from({ length: doc.numPages }, (_, i) => i + 1);
    for (const n of numeros) {
      if (parar?.()) return;
      const pagina = await doc.getPage(n);
      await fazer(pagina, n, doc.numPages);
      pagina.cleanup();
    }
  } finally {
    await tarefa.destroy();
  }
}

/**
 * A página desenhada num canvas, com o fundo branco (o JPG não tem transparência). No jeito de imprimir (intent print):
 * o de tela espera o próximo quadro do navegador (requestAnimationFrame) e para com a aba em segundo plano — comprimir
 * um PDF grande e trocar de aba no meio travava; o OCR já desenha assim.
 */
async function desenhar(pagina: Pagina, escala: number): Promise<HTMLCanvasElement> {
  const vista = pagina.getViewport({ scale: escala });
  const tela = document.createElement('canvas');
  tela.width = Math.max(1, Math.floor(vista.width));
  tela.height = Math.max(1, Math.floor(vista.height));
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('O navegador não deixou desenhar a página.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tela.width, tela.height);
  await pagina.render({ canvasContext: ctx, canvas: tela, viewport: vista, intent: 'print' }).promise;
  return tela;
}

function blobDo(tela: HTMLCanvasElement, tipo: 'image/png' | 'image/jpeg', qualidade?: number): Promise<Blob> {
  return new Promise((ok, falha) => tela.toBlob(b => (b ? ok(b) : falha(new Error('Não consegui gerar a imagem da página.'))), tipo, qualidade));
}

/**
 * As miniaturas das páginas, uma a uma (aparecem enquanto as outras desenham): `aoDesenhar` recebe o índice (a partir
 * de 0), o JPG pequeno e a proporção da página (largura ÷ altura, já com o giro dela). `largura` em pixels de tela;
 * desenha no dobro, para ficar nítida em tela de alta resolução.
 */
export async function miniaturasDoPdf(bytes: Uint8Array, largura: number, aoDesenhar: (i: number, img: Blob, proporcao: number) => void, parar: () => boolean, so?: readonly number[]): Promise<void> {
  await cadaPagina(bytes, async (pagina, n) => {
    const base = pagina.getViewport({ scale: 1 });
    const tela = await desenhar(pagina, (largura * 2) / Math.max(base.width, base.height));
    const img = await blobDo(tela, 'image/jpeg', 0.8);
    tela.width = tela.height = 0;
    if (!parar()) aoDesenhar(n - 1, img, base.width / base.height);
  }, parar, so);
}

/** O formato do PDF → imagem. */
export type FormatoDaImagem = 'png' | 'jpg';

/**
 * As páginas como imagem (todas, ou só as de `so`, índices a partir de 0). A escala 2 dá uns 144 dpi, legível para ler
 * e para guardar; a 3, uns 216 dpi.
 */
export async function imagensDoPdf(bytes: Uint8Array, escala = 2, formato: FormatoDaImagem = 'png', so?: readonly number[], aoAndar?: (feitas: number, total: number) => void): Promise<Blob[]> {
  const saida: Blob[] = [];
  await cadaPagina(bytes, async (pagina, _n, total) => {
    const tela = await desenhar(pagina, escala);
    saida.push(await (formato === 'png' ? blobDo(tela, 'image/png') : blobDo(tela, 'image/jpeg', 0.9)));
    tela.width = tela.height = 0;
    aoAndar?.(saida.length, so?.length ?? total);
  }, undefined, so);
  return saida;
}

/** O texto de todas as páginas, uma depois da outra. Um PDF de foto (digitalizado) volta vazio. */
export async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  const partes: string[] = [];
  await cadaPagina(bytes, async pagina => {
    const tc = await pagina.getTextContent();
    partes.push(tc.items.map(i => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join('').trim());
  });
  return partes.join('\n\n');
}

/** O texto pelo OCR (o PDF digitalizado): o mesmo OCR do extrato, aqui no navegador. */
export async function textoPorOcr(bytes: Uint8Array, aoAndar?: (feitas: number, total: number) => void): Promise<string> {
  const paginas = await ocrDoArquivo(bytes, 'pdf', aoAndar);
  return paginas.map(p => ferramentas.arquivos.textoDosPedacos(p)).join('\n\n');
}

/**
 * As páginas em JPG para o Comprimir: cada uma desenhada na escala e na qualidade do nível, com o tamanho dela em pontos
 * (o da página como aparece, já com o giro), para o PDF novo ter as páginas do mesmo tamanho.
 */
export async function paginasEmJpg(bytes: Uint8Array, escala: number, qualidade: number, aoAndar?: (feitas: number, total: number) => void): Promise<ferramentas.pdf.ImagemParaPdf[]> {
  const saida: ferramentas.pdf.ImagemParaPdf[] = [];
  await cadaPagina(bytes, async (pagina, _n, total) => {
    const base = pagina.getViewport({ scale: 1 });
    const tela = await desenhar(pagina, escala);
    const jpg = await blobDo(tela, 'image/jpeg', qualidade);
    tela.width = tela.height = 0;
    saida.push({ bytes: new Uint8Array(await jpg.arrayBuffer()), tamanho: [base.width, base.height] });
    aoAndar?.(saida.length, total);
  });
  return saida;
}

/**
 * A imagem pronta para virar página: PNG e JPG vão como estão; os outros formatos (WEBP, GIF, BMP) o navegador desenha
 * e vira PNG.
 */
export async function imagemParaPdf(arquivo: File): Promise<Uint8Array> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (ferramentas.imagens.formatoDaImagem(bytes)) return bytes;
  const bmp = await createImageBitmap(arquivo).catch(() => { throw new Error('O navegador não conseguiu abrir a imagem ' + arquivo.name + '.'); });
  const tela = document.createElement('canvas');
  tela.width = bmp.width;
  tela.height = bmp.height;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('O navegador não deixou desenhar a imagem.');
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const png = await blobDo(tela, 'image/png');
  tela.width = tela.height = 0;
  return new Uint8Array(await png.arrayBuffer());
}
