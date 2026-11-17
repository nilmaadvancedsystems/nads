// As páginas de um PDF desenhadas como imagens (12/11/2026, a pré-visualização da guia): o navegador do celular não
// mostra PDF dentro da página (fica em branco), então o pdf.js desenha cada página num canvas e a janela mostra as
// imagens, igual no PC e no celular. Até 10 páginas (uma guia tem 1 ou 2); escala 2 para ficar nítido na tela do celular.
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

const MAXIMO_DE_PAGINAS = 10;

/** As páginas do PDF em data URL (JPEG). Lança erro se o pdf.js não abrir o arquivo (aí a janela usa o visualizador do navegador). */
export async function paginasDoPdf(arquivo: Blob): Promise<string[]> {
  const p = await import('pdfjs-dist/legacy/build/pdf.mjs');
  p.GlobalWorkerOptions.workerSrc = workerDoPdf;
  const tarefa = p.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  try {
    const doc = await tarefa.promise;
    const paginas: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAXIMO_DE_PAGINAS); n++) {
      const pagina = await doc.getPage(n);
      const vista = pagina.getViewport({ scale: 2 });
      const c = document.createElement('canvas');
      c.width = Math.round(vista.width);
      c.height = Math.round(vista.height);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('o navegador não desenhou a página');
      await pagina.render({ canvas: c, canvasContext: ctx, viewport: vista }).promise;
      paginas.push(c.toDataURL('image/jpeg', 0.85));
    }
    return paginas;
  } finally {
    await tarefa.destroy();
  }
}
