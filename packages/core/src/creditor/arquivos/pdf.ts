// Texto de um PDF do banco, lido no próprio navegador com o pdf.js (nada sai da máquina).
// Só serve para PDF com texto (exportado pelo banco). PDF escaneado ou foto não têm texto: aí a
// pessoa digita os títulos na conferência.

export interface ItemTextoPdf { texto: string; x: number; y: number; largura: number }

/**
 * Remonta as linhas do relatório: itens na mesma altura (±2) viram uma linha, da esquerda para a
 * direita; espaço grande entre dois itens vira dois espaços (separa as colunas).
 */
export function linhasDosItens(itens: ItemTextoPdf[]): string[] {
  const linhas: { y: number; itens: ItemTextoPdf[] }[] = [];
  for (const it of itens) {
    if (!it.texto.trim()) continue;
    const l = linhas.find(x => Math.abs(x.y - it.y) <= 2);
    if (l) l.itens.push(it); else linhas.push({ y: it.y, itens: [it] });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map(l => {
      const ord = l.itens.sort((a, b) => a.x - b.x);
      let s = '', fim = -Infinity;
      for (const it of ord) {
        const vao = it.x - fim;
        s += s ? (vao > 6 ? '  ' : vao > 0.5 ? ' ' : '') : '';
        s += it.texto.trim();
        fim = it.x + it.largura;
      }
      return s;
    });
}

/** Todas as páginas, uma linha do relatório por linha de texto. workerSrc = endereço do worker do pdf.js (vem do site). */
export async function textoDoPdf(buf: ArrayBuffer, workerSrc: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true });
  let doc;
  try {
    doc = await tarefa.promise;
  } catch {
    throw new Error('Não consegui abrir o PDF (arquivo protegido ou corrompido?).');
  }
  const paginas: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const conteudo = await (await doc.getPage(p)).getTextContent();
    const itens: ItemTextoPdf[] = [];
    for (const it of conteudo.items) {
      if (!('str' in it)) continue;
      itens.push({ texto: it.str, x: it.transform[4], y: it.transform[5], largura: it.width });
    }
    paginas.push(linhasDosItens(itens).join('\n'));
  }
  await tarefa.destroy();
  const texto = paginas.join('\n');
  if (!texto.trim()) throw new Error('O PDF não tem texto (parece escaneado ou foto). Digite os títulos na conferência.');
  return texto;
}
