// A imagem que vai junto da entrega (16/10/2026, a entrega de documentos trazida do Entregas): a foto, diminuída para caber
// no documento do banco (900 px no lado maior, JPEG 60%, como o Entregas), ou a primeira página do PDF da guia (JPEG 85%,
// como o Entregas faz ao anexar o PDF). Vai em data URL em entregas/{id}/anexos/comprovante (sem Storage, igual lá).
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/** O documento do banco aceita ~1 MB; o data URL não pode passar disso (sobra para a assinatura). */
const LIMITE = 700_000;

function canvasDe(largura: number, altura: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(largura));
  c.height = Math.max(1, Math.round(altura));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('o navegador não desenhou a imagem');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  return { c, ctx };
}

async function daFoto(arquivo: File): Promise<string> {
  const bmp = await createImageBitmap(arquivo);
  try {
    const escala = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const { c, ctx } = canvasDe(bmp.width * escala, bmp.height * escala);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6);
  } finally {
    bmp.close();
  }
}

async function doPdf(arquivo: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = workerDoPdf;
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  try {
    const pagina = await (await tarefa.promise).getPage(1);
    const vista = pagina.getViewport({ scale: 1.5 });
    const { c, ctx } = canvasDe(vista.width, vista.height);
    await pagina.render({ canvas: c, canvasContext: ctx, viewport: vista, intent: 'print' }).promise;
    // a página grande pode passar do limite: tenta com menos qualidade antes de desistir
    for (const q of [0.85, 0.7, 0.55]) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length <= LIMITE) return url;
    }
    return c.toDataURL('image/jpeg', 0.4);
  } finally {
    await tarefa.destroy();
  }
}

/** A imagem do arquivo escolhido e se ela é a guia (veio de um PDF). */
export async function imagemDoArquivo(arquivo: File): Promise<{ imagem: string; ehGuia: boolean }> {
  const ehPdf = arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name);
  const imagem = ehPdf ? await doPdf(arquivo) : await daFoto(arquivo);
  if (imagem.length > LIMITE) throw new Error('a imagem ficou grande demais para o banco');
  return { imagem, ehGuia: ehPdf };
}

