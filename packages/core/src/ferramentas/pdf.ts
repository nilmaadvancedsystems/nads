// As ferramentas de PDF (30/10/2026, "um conversor de PDF, separar e juntar PDF, girar e remover páginas"): tudo no
// navegador, com o pdf-lib. Puro: sem tela, sem rede. As páginas são contadas a partir de 0 aqui; o texto que a pessoa
// digita ("1-3, 5") é lido por paginasDoTexto, que já devolve os números certos.
import { PDFDocument, degrees } from 'pdf-lib';

/**
 * As páginas de um texto como "1-3, 5" (de 1 a total), sem repetir e em ordem. Devolve os índices a partir de 0; com
 * erro, o motivo em português, para a tela mostrar.
 */
export function paginasDoTexto(texto: string, total: number): { paginas: number[]; erro?: string } {
  const paginas = new Set<number>();
  for (const parte of texto.split(',').map(p => p.trim()).filter(Boolean)) {
    const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(parte);
    if (!m) return { paginas: [], erro: '"' + parte + '" não é uma página nem um intervalo (ex.: 2 ou 3-5).' };
    const de = Number(m[1]);
    const ate = m[2] ? Number(m[2]) : de;
    if (de < 1 || ate > total || de > ate) return { paginas: [], erro: '"' + parte + '" está fora de 1 a ' + total + ' (ou o intervalo está invertido).' };
    for (let p = de; p <= ate; p++) paginas.add(p - 1);
  }
  if (!paginas.size) return { paginas: [], erro: 'Escreva as páginas, por exemplo 1-3, 5.' };
  return { paginas: [...paginas].sort((a, b) => a - b) };
}

/** Quantas páginas tem o PDF. */
export async function contarPaginas(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
}

/** Um PDF novo por grupo de páginas (índices a partir de 0), na ordem dos grupos. */
export async function separarPdf(bytes: Uint8Array, grupos: number[][]): Promise<Uint8Array[]> {
  const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const saida: Uint8Array[] = [];
  for (const grupo of grupos) {
    const novo = await PDFDocument.create();
    const copiadas = await novo.copyPages(origem, grupo);
    copiadas.forEach(p => novo.addPage(p));
    saida.push(await novo.save());
  }
  return saida;
}

/** Um PDF só com todas as páginas de cada arquivo, na ordem em que vierem. */
export async function juntarPdfs(arquivos: Uint8Array[]): Promise<Uint8Array> {
  const novo = await PDFDocument.create();
  for (const bytes of arquivos) {
    const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copiadas = await novo.copyPages(origem, origem.getPageIndices());
    copiadas.forEach(p => novo.addPage(p));
  }
  return novo.save();
}

/** Gira as páginas indicadas (índices a partir de 0) em graus (90, 180 ou 270), somando ao giro que já têm. */
export async function girarPaginas(bytes: Uint8Array, paginas: number[], graus: 90 | 180 | 270): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const todas = doc.getPages();
  for (const i of paginas) {
    const pagina = todas[i];
    pagina.setRotation(degrees((pagina.getRotation().angle + graus) % 360));
  }
  return doc.save();
}

/** Tira as páginas indicadas (índices a partir de 0); não dá para tirar todas. */
export async function removerPaginas(bytes: Uint8Array, paginas: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const tirar = new Set(paginas);
  const sobram = doc.getPageIndices().filter(i => !tirar.has(i));
  if (!sobram.length) throw new Error('Não dá para tirar todas as páginas do arquivo.');
  const novo = await PDFDocument.create();
  const copiadas = await novo.copyPages(doc, sobram);
  copiadas.forEach(p => novo.addPage(p));
  return novo.save();
}
