// As leituras do PDF que precisam do pdf.js (30/10/2026): cada página como PNG e o texto de todas as páginas. Tudo no
// navegador; o PDF não sai do computador. O que mexe no arquivo (separar, juntar, girar) é o core (ferramentas.pdf).
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

async function pdfjs() {
  const p = await import('pdfjs-dist/legacy/build/pdf.mjs');
  p.GlobalWorkerOptions.workerSrc = workerDoPdf;
  return p;
}

/** Cada página do PDF como PNG. A escala 2 dá uns 144 dpi, legível para ler e para guardar. */
export async function imagensDoPdf(bytes: Uint8Array, escala = 2): Promise<Blob[]> {
  const p = await pdfjs();
  const tarefa = p.getDocument({ data: bytes.slice() });
  try {
    const doc = await tarefa.promise;
    const saida: Blob[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const vista = pagina.getViewport({ scale: escala });
      const tela = document.createElement('canvas');
      tela.width = Math.floor(vista.width);
      tela.height = Math.floor(vista.height);
      const ctx = tela.getContext('2d');
      if (!ctx) throw new Error('O navegador não deixou desenhar a página.');
      await pagina.render({ canvasContext: ctx, canvas: tela, viewport: vista }).promise;
      saida.push(await new Promise<Blob>((ok, falha) => tela.toBlob(b => (b ? ok(b) : falha(new Error('Não consegui gerar a imagem da página ' + n))), 'image/png')));
      pagina.cleanup();
    }
    return saida;
  } finally {
    await tarefa.destroy();
  }
}

/** O texto de todas as páginas, uma depois da outra. Um PDF de foto (digitalizado) volta vazio. */
export async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  const p = await pdfjs();
  const tarefa = p.getDocument({ data: bytes.slice() });
  try {
    const doc = await tarefa.promise;
    const partes: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const tc = await pagina.getTextContent();
      partes.push(tc.items.map(i => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join('').trim());
    }
    return partes.join('\n\n');
  } finally {
    await tarefa.destroy();
  }
}
