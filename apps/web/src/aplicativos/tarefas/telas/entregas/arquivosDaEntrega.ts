// Os arquivos que entram na entrega (16/10/2026, a cópia fiel do Entregas): a foto, diminuída para caber no documento do
// banco (900 px no lado maior, JPEG 60%, como o compressImage de lá); o PDF da guia, de onde sai o texto (o leitor acha o
// cliente, o tipo, a competência, o vencimento, o valor e o código para pagar) e a imagem da primeira página (JPEG 85%,
// em escala 1,5; se travar mais de 12 s, segue só com o texto); e o QR (o PIX, o link do cliente, a assinatura). Vai tudo
// em data URL (sem Storage), como o Entregas grava.
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/** A foto do jeito que o Entregas guarda: até 900 px no lado maior, JPEG 60%. */
export async function fotoComprimida(arquivo: File): Promise<string> {
  const bmp = await createImageBitmap(arquivo);
  try {
    const escala = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * escala));
    c.height = Math.max(1, Math.round(bmp.height * escala));
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('o navegador não desenhou a foto');
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6);
  } finally {
    bmp.close();
  }
}

async function pdfjs() {
  const p = await import('pdfjs-dist/legacy/build/pdf.mjs');
  p.GlobalWorkerOptions.workerSrc = workerDoPdf;
  return p;
}

/** O texto da primeira página do PDF (as palavras juntas por espaço, como o Entregas). */
export async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  const p = await pdfjs();
  const tarefa = p.getDocument({ data: bytes });
  try {
    const pagina = await (await tarefa.promise).getPage(1);
    const tc = await pagina.getTextContent();
    return tc.items.map(i => ('str' in i ? i.str : '')).join(' ');
  } finally {
    await tarefa.destroy();
  }
}

/** O texto e a imagem da primeira página do PDF da guia (a imagem pode faltar: aí segue só com o texto). */
export async function lerPdfDaGuia(arquivo: File): Promise<{ texto: string; imagem: string | null }> {
  const p = await pdfjs();
  const tarefa = p.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  try {
    const pagina = await (await tarefa.promise).getPage(1);
    const texto = (await pagina.getTextContent()).items.map(i => ('str' in i ? i.str : '')).join(' ');
    const vista = pagina.getViewport({ scale: 1.5 });
    const c = document.createElement('canvas');
    c.width = Math.round(vista.width);
    c.height = Math.round(vista.height);
    const ctx = c.getContext('2d');
    const imagem = ctx
      ? await Promise.race([
        pagina.render({ canvas: c, canvasContext: ctx, viewport: vista }).promise.then(() => c.toDataURL('image/jpeg', 0.85), () => null),
        new Promise<null>(ok => setTimeout(() => ok(null), 12000)),
      ])
      : null;
    return { texto, imagem };
  } finally {
    await tarefa.destroy();
  }
}

/** O QR (data URL do PNG) para o texto: o PIX, o link do cliente, o link de assinar. */
export async function qrDoTexto(texto: string, tamanho = 200): Promise<string> {
  const qr = await import('qrcode');
  return qr.toDataURL(texto, { width: tamanho, margin: 1, errorCorrectionLevel: 'M' });
}

/** Baixa um data URL com o nome dado (Salvar assinatura, Salvar foto, a guia em PDF). */
export function baixarDataUrl(dataUrl: string, nome: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** O quadro do vídeo da câmera num canvas (o "Focar e ler" do Ler guia, quando a foto em resolução cheia não vem). */
export function quadroDoVideo(v: HTMLVideoElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = v.videoWidth || 1280;
  c.height = v.videoHeight || 720;
  c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
  return c;
}
