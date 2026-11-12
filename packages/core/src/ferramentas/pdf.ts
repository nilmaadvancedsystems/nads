// As ferramentas de PDF (30/10/2026, "um conversor de PDF, separar e juntar PDF, girar e remover páginas"): tudo no
// navegador, com o pdf-lib. Puro: sem tela, sem rede. As páginas são contadas a partir de 0 aqui; o texto que a pessoa
// digita ("1-3, 5") é lido por paginasDoTexto, que já devolve os números certos.
// 12/11/2026 ("melhorar o visual e as funcionalidades da aba de Ferramentas"): as páginas em miniatura (os cortes do
// Separar e o giro de cada página), juntar PDF com imagem, imagem em PDF e numerar as páginas.
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { formatoDaImagem, type FormatoDeImagem } from './imagens';

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

/** O contrário de paginasDoTexto: os índices (a partir de 0) no texto curto, "1-3, 5". */
export function textoDasPaginas(paginas: readonly number[]): string {
  const ordem = [...new Set(paginas)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < ordem.length; i++) {
    const de = ordem[i];
    while (i + 1 < ordem.length && ordem[i + 1] === ordem[i] + 1) i++;
    partes.push(ordem[i] === de ? String(de + 1) : de + 1 + '-' + (ordem[i] + 1));
  }
  return partes.join(', ');
}

/** Os grupos do Separar ("1-3; 4-6": um arquivo por grupo, separados por ponto e vírgula). */
export function gruposDoTexto(texto: string, total: number): { grupos: number[][]; erro?: string } {
  const partes = texto.split(';').map(g => g.trim()).filter(Boolean);
  if (!partes.length) return { grupos: [], erro: 'Escreva os grupos, por exemplo 1-3; 4-6. Cada grupo vira um arquivo.' };
  const grupos: number[][] = [];
  for (const parte of partes) {
    const lido = paginasDoTexto(parte, total);
    if (lido.erro) return { grupos: [], erro: lido.erro };
    grupos.push(lido.paginas);
  }
  return { grupos };
}

/** O texto dos grupos, "1-3; 4-6". */
export function textoDosGrupos(grupos: readonly (readonly number[])[]): string {
  return grupos.map(textoDasPaginas).join('; ');
}

/**
 * Os grupos pelos cortes das miniaturas: cada corte é a página (índice) que começa um arquivo novo. Sem corte, um
 * arquivo só com todas as páginas.
 */
export function gruposPelosCortes(total: number, cortes: readonly number[]): number[][] {
  const inicios = [0, ...[...new Set(cortes)].filter(c => c > 0 && c < total).sort((a, b) => a - b)];
  return inicios.map((de, i) => Array.from({ length: (inicios[i + 1] ?? total) - de }, (_, k) => de + k));
}

/**
 * Os cortes de grupos que são as páginas em sequência, do começo ao fim, sem pular nem repetir (o que as miniaturas
 * conseguem mostrar); null quando os grupos foram escritos de outro jeito ("1; 3-4", "5-6; 1-4").
 */
export function cortesDosGrupos(grupos: readonly (readonly number[])[], total: number): number[] | null {
  const cortes: number[] = [];
  let proxima = 0;
  for (const grupo of grupos) {
    if (!grupo.length || grupo[0] !== proxima) return null;
    for (const p of grupo) if (p !== proxima++) return null;
    if (grupo[0] > 0) cortes.push(grupo[0]);
  }
  return proxima === total ? cortes : null;
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
  return juntarArquivos(arquivos);
}

/** O tamanho do A4, em pontos. */
export const A4: [number, number] = [595.28, 841.89];

/** Como a imagem vira página: do tamanho de uma folha A4 (com margem, deitada se a imagem for deitada) ou do tamanho dela. */
export type PaginaDaImagem = 'a4' | 'imagem';

/** Uma imagem que vira página. tamanho: a página exata em pontos (o Comprimir põe a página do tamanho da original). */
export interface ImagemParaPdf { bytes: Uint8Array; tamanho?: [number, number] }

/** A margem da imagem na folha A4, em pontos (uns 8 mm). */
const MARGEM_DA_IMAGEM = 24;

async function colocarImagem(doc: PDFDocument, img: ImagemParaPdf, formato: FormatoDeImagem, pagina: PaginaDaImagem) {
  const imagem = formato === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
  if (img.tamanho) {
    const [w, h] = img.tamanho;
    doc.addPage([w, h]).drawImage(imagem, { x: 0, y: 0, width: w, height: h });
    return;
  }
  if (pagina === 'imagem') {
    // 1 pixel = 0,75 ponto (96 dpi), como o navegador mostra a imagem
    const [w, h] = [imagem.width * 0.75, imagem.height * 0.75];
    doc.addPage([w, h]).drawImage(imagem, { x: 0, y: 0, width: w, height: h });
    return;
  }
  const deitada = imagem.width > imagem.height;
  const [w, h] = deitada ? [A4[1], A4[0]] : A4;
  const escala = Math.min((w - 2 * MARGEM_DA_IMAGEM) / imagem.width, (h - 2 * MARGEM_DA_IMAGEM) / imagem.height);
  const [iw, ih] = [imagem.width * escala, imagem.height * escala];
  doc.addPage([w, h]).drawImage(imagem, { x: (w - iw) / 2, y: (h - ih) / 2, width: iw, height: ih });
}

/** Um PDF com uma página por imagem (PNG ou JPG), na ordem dada. */
export async function pdfDeImagens(imagens: ImagemParaPdf[], pagina: PaginaDaImagem = 'a4'): Promise<Uint8Array> {
  if (!imagens.length) throw new Error('Escolha ao menos uma imagem.');
  const doc = await PDFDocument.create();
  for (const [i, img] of imagens.entries()) {
    const formato = formatoDaImagem(img.bytes);
    if (!formato) throw new Error('A imagem ' + (i + 1) + ' não é PNG nem JPG.');
    await colocarImagem(doc, img, formato, pagina);
  }
  return doc.save();
}

/**
 * Junta PDFs e imagens (PNG ou JPG) num PDF só, na ordem dada: do PDF vão todas as páginas; a imagem vira uma página
 * (do jeito de `pagina`).
 */
export async function juntarArquivos(arquivos: Uint8Array[], pagina: PaginaDaImagem = 'a4'): Promise<Uint8Array> {
  const novo = await PDFDocument.create();
  for (const [i, bytes] of arquivos.entries()) {
    const formato = formatoDaImagem(bytes);
    if (formato) {
      await colocarImagem(novo, { bytes }, formato, pagina);
      continue;
    }
    if (!ehPdf(bytes)) throw new Error('O arquivo ' + (i + 1) + ' não é PDF, PNG nem JPG.');
    const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copiadas = await novo.copyPages(origem, origem.getPageIndices());
    copiadas.forEach(p => novo.addPage(p));
  }
  return novo.save();
}

/** O arquivo começa com %PDF (alguns trazem lixo antes: procura no primeiro KB, como os leitores de PDF). */
export function ehPdf(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length - 3, 1024);
  for (let i = 0; i < n; i++) if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) return true;
  return false;
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
  return editarPdf(bytes, { tirar: paginas });
}

/** O giro somado, sempre de 0 a 270. */
export const somarGiro = (atual: number, mais: number) => (((atual + mais) % 360) + 360) % 360;

/**
 * Gira e tira de uma vez (as miniaturas do Girar e tirar): giros[i] é quanto a página i gira (0, 90, 180 ou 270, no
 * sentido do relógio, somando ao giro que ela já tem); tirar são as páginas que saem. Não dá para tirar todas.
 */
export async function editarPdf(bytes: Uint8Array, mudancas: { giros?: readonly number[]; tirar?: readonly number[] }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const tirar = new Set(mudancas.tirar ?? []);
  const sobram = doc.getPageIndices().filter(i => !tirar.has(i));
  if (!sobram.length) throw new Error('Não dá para tirar todas as páginas do arquivo.');
  const paginas = doc.getPages();
  for (const i of sobram) {
    const giro = mudancas.giros?.[i] ?? 0;
    if (giro % 360) paginas[i].setRotation(degrees(somarGiro(paginas[i].getRotation().angle, giro)));
  }
  if (!tirar.size) return doc.save();
  const novo = await PDFDocument.create();
  const copiadas = await novo.copyPages(doc, sobram);
  copiadas.forEach(p => novo.addPage(p));
  return novo.save();
}

/** Como o número sai: "Página 3 de 10", "3 de 10" ou só "3". */
export type ModeloDoNumero = 'pagina-de' | 'de' | 'numero';
/** Onde o número fica, no rodapé. */
export type LugarDoNumero = 'esquerda' | 'centro' | 'direita';

/** O texto do número da página n (a partir de 1) de total. */
export function textoDoNumero(modelo: ModeloDoNumero, n: number, total: number): string {
  if (modelo === 'numero') return String(n);
  return (modelo === 'pagina-de' ? 'Página ' : '') + n + ' de ' + total;
}

/**
 * Onde desenhar o texto no rodapé da página como ela APARECE (com o giro dela): a posição e o giro do texto nas medidas
 * da página sem giro, que é como o pdf-lib desenha. caixa: a área visível da página (x, y, largura, altura, sem giro).
 */
export function posicaoNoRodape(
  caixa: { x: number; y: number; width: number; height: number }, giro: number, larguraDoTexto: number, lugar: LugarDoNumero, margem: number,
): { x: number; y: number; giro: number } {
  const g = somarGiro(giro, 0);
  // a largura da página como aparece: troca com a altura no giro de 90 e 270
  const larguraVista = g === 90 || g === 270 ? caixa.height : caixa.width;
  const vx = lugar === 'esquerda' ? margem : lugar === 'centro' ? (larguraVista - larguraDoTexto) / 2 : larguraVista - margem - larguraDoTexto;
  const vy = margem;
  // de volta para as medidas sem giro (o pdf-lib gira a página no sentido do relógio na hora de mostrar)
  const [x, y] = g === 90 ? [caixa.width - vy, vx] : g === 180 ? [caixa.width - vx, caixa.height - vy] : g === 270 ? [vy, caixa.height - vx] : [vx, vy];
  return { x: caixa.x + x, y: caixa.y + y, giro: g };
}

/** Numera as páginas no rodapé (fonte Helvetica de 10 pontos, cinza escuro, a uns 7 mm da borda). */
export async function numerarPaginas(
  bytes: Uint8Array, opcoes: { modelo: ModeloDoNumero; lugar: LugarDoNumero; primeiro?: number },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const tamanho = 10;
  const paginas = doc.getPages();
  const primeiro = Math.max(1, Math.floor(opcoes.primeiro ?? 1));
  const total = paginas.length + primeiro - 1;
  for (const [i, pagina] of paginas.entries()) {
    const texto = textoDoNumero(opcoes.modelo, primeiro + i, total);
    const largura = fonte.widthOfTextAtSize(texto, tamanho);
    const p = posicaoNoRodape(pagina.getCropBox(), pagina.getRotation().angle, largura, opcoes.lugar, 20);
    pagina.drawText(texto, { x: p.x, y: p.y, size: tamanho, font: fonte, color: rgb(0.25, 0.25, 0.25), rotate: degrees(p.giro) });
  }
  return doc.save();
}
