// Texto do PDF com a posição de cada pedaço (pdf.js, build "legacy": roda no navegador e no Node dos
// testes). O PDF é lido na memória e descartado: nada do arquivo é guardado. O pdf.js só é
// carregado na primeira leitura.
import type { ItemDeTexto } from '../regras/extrato';

let worker: string | null = null;

/** Endereço do worker do pdf.js (o app passa o do bundle: 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'). */
export function definirWorkerDoPdf(url: string): void {
  worker = url;
}

export function ehPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

/** Uma lista de pedaços de texto por página. */
export async function itensDoPdf(bytes: Uint8Array): Promise<ItemDeTexto[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (worker) pdfjs.GlobalWorkerOptions.workerSrc = worker;
  // cópia: o pdf.js transfere o buffer para o worker
  const tarefa = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await tarefa.promise;
  try {
    const paginas: ItemDeTexto[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pagina = await doc.getPage(p);
      const conteudo = await pagina.getTextContent();
      const itens: ItemDeTexto[] = [];
      for (const i of conteudo.items) {
        if (!('str' in i)) continue;
        itens.push({ texto: i.str, x: i.transform[4], y: i.transform[5], largura: i.width });
      }
      paginas.push(itens);
    }
    return paginas;
  } finally {
    // pdf.js 6: quem libera o documento é a tarefa de carregamento (como no Creditor)
    void tarefa.destroy();
  }
}
