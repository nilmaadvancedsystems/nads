// O PDF do Diário do Alterdata → as páginas com cada texto e a posição (x, y nativos do PDF, como o protótipo que
// validou os totais). A regra do diário é do core (tarefas.lerDiario); aqui só o pdf.js. O pdf.js vem do legado, como
// nos outros leitores do app (Entregas, Creditor).
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { tarefas as t } from '@nads/core';

async function pdfjs() {
  const p = await import('pdfjs-dist/legacy/build/pdf.mjs');
  p.GlobalWorkerOptions.workerSrc = workerDoPdf;
  return p;
}

/** As páginas do PDF com os textos e a posição de cada um. Lança Error com a mensagem para a tela. */
export async function paginasDoDiario(buf: ArrayBuffer): Promise<t.PaginaDoPdf[]> {
  const p = await pdfjs();
  let doc;
  try {
    doc = await p.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true }).promise;
  } catch (e) {
    if (e instanceof Error && e.name === 'PasswordException') throw new Error('O PDF está protegido por senha. Exporte o diário de novo, sem senha.', { cause: e });
    throw new Error('Não consegui abrir o PDF do diário. Exporte o diário do Alterdata em PDF.', { cause: e });
  }
  const paginas: t.PaginaDoPdf[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    paginas.push({
      p: n,
      items: conteudo.items.flatMap(it => ('str' in it && it.str.trim() ? [{ s: it.str, x: it.transform[4], y: it.transform[5] }] : [])),
    });
  }
  return paginas;
}
