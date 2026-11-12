// O PDF da Carta de balanço (12/11/2026), no desenho do modelo do escritório (Balanço.pdf): duas páginas A4, a Declaração de
// inventário (o cliente preenche o valor, dá ciência e assina) e a Carta de balanço (o pedido do inventário em 31/12, com o
// prazo e os votos de fim de ano, com os sinos). O mesmo desenho no navegador (Fiscal › Cartas, "Ver a carta") e no robô
// (robo/gerado/cartas.js, feito por scripts/robo-cartas.mjs), que assina com o certificado do escritório:
//   - assinatura: o selo visível "Assinado de forma digital por ..." no quadro da Declaração (o titular e a hora, em Brasília);
//   - reservarAssinatura: o lugar da assinatura digital no PDF (o dicionário /Sig, com o /ByteRange e o /Contents em branco,
//     como o @signpdf faz); o robô calcula o /ByteRange e grava a assinatura PKCS#7 no /Contents (robo/cartas-fiscal.js).
// Os textos (e o negrito de cada pedaço) são do core (cartasFiscal); aqui é só o desenho.
import { cartasFiscal } from '@nads/core';
import type { PDFDocument, PDFFont, PDFPage, RGB } from 'pdf-lib';
import { LOGO_NILMA_JPG_BASE64, LOGO_NILMA_PROPORCAO, SINOS_PNG_BASE64, SINOS_PROPORCAO } from './imagensDaCarta';

const CM = 72 / 2.54;
const A4 = { l: 21 * CM, a: 29.7 * CM };
const MARGEM = 2 * CM;
const LARGURA = A4.l - 2 * MARGEM;
const ENDERECO = [
  'Travessa Martinho Rego nº 30 – Salas 101/105 – Centro – Taiobeiras/MG',
  'Tel.: (38)3845-2074 / E-mail: nilmacontabilidade@gmail.com',
  'Site: www.nilmacontabilidade.com.br',
];
const CONTADORA = { nome: 'Nilma Dias Oliveira', crc: 'CRC - MG088272-O' };
/** o tamanho reservado para a assinatura PKCS#7 (bytes; vira o dobro em hexadecimal) */
export const TAMANHO_DA_ASSINATURA = 16384;
/** o /ByteRange em branco, que o robô troca pelos números (mesmo comprimento) */
export const BYTE_RANGE_EM_BRANCO = '**********';

export interface OpcoesDaCarta {
  /** o selo visível da assinatura (o CN do certificado: 'NILMA DIAS OLIVEIRA:27872981000113') e a hora da assinatura */
  assinatura?: { titular: string; quando: Date } | null;
  /** reserva no PDF o lugar da assinatura digital (só o robô, que assina) */
  reservarAssinatura?: boolean;
}

interface Fontes { normal: PDFFont; negrito: PDFFont }
interface Peca { p: string; negrito: boolean }

/**
 * As palavras dos trechos; uma palavra pode ter pedaços de fontes diferentes ("LTDA" em negrito e a vírgula colada, normal).
 */
function palavrasDe(trechos: cartasFiscal.Trecho[]): Peca[][] {
  const palavras: Peca[][] = [];
  let colar = false;
  for (const t of trechos) {
    for (const parte of t.texto.split(/(\s+)/)) {
      if (!parte) continue;
      if (/^\s+$/.test(parte)) { colar = false; continue; }
      const peca = { p: parte, negrito: !!t.negrito };
      if (colar && palavras.length) palavras[palavras.length - 1].push(peca);
      else palavras.push([peca]);
      colar = true;
    }
  }
  return palavras;
}

/**
 * Escreve um parágrafo justificado (a última linha à esquerda) a partir de y (a linha de base da 1ª linha); devolve o y
 * da linha seguinte ao parágrafo. alinhar 'centro' centraliza todas as linhas.
 */
function paragrafo(pagina: PDFPage, f: Fontes, trechos: cartasFiscal.Trecho[], o: { x: number; y: number; largura: number; tamanho: number; alinhar?: 'justificado' | 'centro' }): number {
  const fonte = (negrito: boolean) => (negrito ? f.negrito : f.normal);
  const largura = (w: Peca[]) => w.reduce((s, x) => s + fonte(x.negrito).widthOfTextAtSize(x.p, o.tamanho), 0);
  const espaco = f.normal.widthOfTextAtSize(' ', o.tamanho);
  const linhas: Peca[][][] = [];
  let atual: Peca[][] = [];
  let usado = 0;
  for (const w of palavrasDe(trechos)) {
    const lw = largura(w);
    if (atual.length && usado + espaco + lw > o.largura) { linhas.push(atual); atual = []; usado = 0; }
    usado += (atual.length ? espaco : 0) + lw;
    atual.push(w);
  }
  if (atual.length) linhas.push(atual);
  let y = o.y;
  linhas.forEach((linha, k) => {
    const soma = linha.reduce((s, w) => s + largura(w), 0);
    let x = o.x;
    let vao = espaco;
    if (o.alinhar === 'centro') x = o.x + (o.largura - soma - espaco * (linha.length - 1)) / 2;
    else if (k < linhas.length - 1 && linha.length > 1) vao = (o.largura - soma) / (linha.length - 1);
    for (const w of linha) {
      for (const peca of w) {
        pagina.drawText(peca.p, { x, y, size: o.tamanho, font: fonte(peca.negrito) });
        x += fonte(peca.negrito).widthOfTextAtSize(peca.p, o.tamanho);
      }
      x += vao;
    }
    y -= o.tamanho * 1.45;
  });
  return y;
}

/** "2025.12.05 09:14:30 -03'00'": a hora em Brasília, como o selo do Adobe */
export function horaDoSelo(quando: Date): string {
  const b = new Date(quando.getTime() - 3 * 36e5);
  const p = (n: number) => String(n).padStart(2, '0');
  return b.getUTCFullYear() + '.' + p(b.getUTCMonth() + 1) + '.' + p(b.getUTCDate()) + ' ' + p(b.getUTCHours()) + ':' + p(b.getUTCMinutes()) + ':' + p(b.getUTCSeconds()) + " -03'00'";
}

/** Desenha a Carta de balanço (a Declaração de inventário e a Carta) e devolve os bytes do PDF. */
export async function desenharCartaDeBalanco(d: cartasFiscal.DadosDaCarta, opcoes: OpcoesDaCarta = {}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle('Carta de balanço ' + d.ano + ' - ' + d.empresa);
  doc.setAuthor('Nilma Contabilidade');
  doc.setCreator('nads');
  doc.setProducer('nads');
  const f: Fontes = { normal: await doc.embedFont(StandardFonts.Helvetica), negrito: await doc.embedFont(StandardFonts.HelveticaBold) };
  const logo = await doc.embedJpg(LOGO_NILMA_JPG_BASE64);
  const sinos = await doc.embedPng(SINOS_PNG_BASE64);
  const preto = rgb(0, 0, 0);
  const cinza = rgb(0.25, 0.25, 0.25);
  const texto = (pagina: PDFPage, t: string, x: number, y: number, tamanho: number, fonte: PDFFont, cor: RGB = preto) =>
    pagina.drawText(t, { x, y, size: tamanho, font: fonte, color: cor });

  const cabecalho = (pagina: PDFPage, titulo: string) => {
    // a linha fina na margem esquerda, como no modelo
    pagina.drawLine({ start: { x: 1.1 * CM, y: 0.6 * CM }, end: { x: 1.1 * CM, y: A4.a - 0.6 * CM }, thickness: 0.8, color: preto });
    const lw = 6.6 * CM;
    pagina.drawImage(logo, { x: A4.l - MARGEM - lw + 0.4 * CM, y: A4.a - 1.5 * CM - lw * LOGO_NILMA_PROPORCAO, width: lw, height: lw * LOGO_NILMA_PROPORCAO });
    texto(pagina, titulo, MARGEM, A4.a - 3.2 * CM, 18, f.negrito);
  };
  const rodape = (pagina: PDFPage) => ENDERECO.forEach((l, k) => texto(pagina, l, MARGEM, 2.2 * CM - k * 9, 7, f.normal, cinza));

  // ── página 1: a Declaração de inventário ──
  const dec = cartasFiscal.textoDaDeclaracao(d);
  const p1 = doc.addPage([A4.l, A4.a]);
  cabecalho(p1, dec.titulo);
  let y = A4.a - 6.6 * CM;
  for (const p of dec.paragrafos) y = paragrafo(p1, f, p, { x: MARGEM, y, largura: LARGURA, tamanho: 12.5 }) - 12;
  paragrafo(p1, f, [{ texto: dec.fecho }], { x: MARGEM, y: y - 10, largura: LARGURA, tamanho: 12.5, alinhar: 'centro' });

  // embaixo, à direita: o quadro da ciência e das assinaturas (de cima para baixo: a ciência, a linha do cliente, o selo da
  // assinatura digital da contadora, a linha dela, o nome e o CRC)
  const q = { x: 11.1 * CM, y: 8.2 * CM, l: 8.2 * CM, a: 7 * CM };
  const topo = q.y + q.a;
  const dentro = q.x + 0.5 * CM;
  p1.drawRectangle({ x: q.x, y: q.y, width: q.l, height: q.a, borderColor: preto, borderWidth: 0.8 });
  texto(p1, 'CIÊNCIA EM ______/ ______/________', dentro, topo - 1.2 * CM, 11, f.normal);
  const tracejado = (yl: number) => p1.drawLine({ start: { x: dentro, y: yl }, end: { x: q.x + q.l - 0.5 * CM, y: yl }, thickness: 0.6, color: preto, dashArray: [3, 2] });
  const centro = (t: string, yl: number, tam: number, fonte: PDFFont) => texto(p1, t, q.x + (q.l - fonte.widthOfTextAtSize(t, tam)) / 2, yl, tam, fonte);
  tracejado(topo - 2.6 * CM);
  let empresa = d.empresa;
  while (empresa.length > 4 && f.negrito.widthOfTextAtSize(empresa, 11.5) > q.l - 0.8 * CM) empresa = empresa.slice(0, -2).trimEnd() + '…';
  centro(empresa, topo - 3.1 * CM, 11.5, f.negrito);
  if (opcoes.assinatura) {
    const [nome, documento = ''] = opcoes.assinatura.titular.split(':');
    const ys = topo - 3.95 * CM;
    const partes = nome.trim().split(/\s+/);
    const meio = Math.ceil(partes.length / 2);
    texto(p1, partes.slice(0, meio).join(' '), dentro, ys, 9.5, f.normal);
    texto(p1, partes.slice(meio).join(' ') + (documento ? ':' + documento : ''), dentro, ys - 11, 9.5, f.normal);
    ['Assinado de forma digital por ' + opcoes.assinatura.titular, 'Dados: ' + horaDoSelo(opcoes.assinatura.quando)]
      .forEach((l, k) => texto(p1, l, dentro, ys - 22 - k * 7.5, 6, f.normal, cinza));
  }
  tracejado(topo - 5.55 * CM);
  centro(CONTADORA.nome, topo - 6.05 * CM, 11.5, f.normal);
  centro(CONTADORA.crc, topo - 6.6 * CM, 11.5, f.normal);

  // embaixo, à esquerda: o fecho do escritório (na altura da ciência) e o local e a data (na altura do nome da contadora)
  texto(p1, 'Qualquer dúvida estamos à inteira', MARGEM, topo - 1.2 * CM, 12, f.normal);
  texto(p1, 'disposição.', MARGEM, topo - 1.2 * CM - 16, 12, f.normal);
  texto(p1, 'Att,', MARGEM, topo - 1.2 * CM - 46, 12, f.normal);
  texto(p1, 'NILMA CONTABILIDADE', MARGEM, topo - 1.2 * CM - 62, 12, f.normal);
  texto(p1, d.localEData, MARGEM, topo - 6.05 * CM, 11.5, f.negrito);
  rodape(p1);

  // ── página 2: a Carta de balanço ──
  const carta = cartasFiscal.textoDaCarta(d);
  const p2 = doc.addPage([A4.l, A4.a]);
  cabecalho(p2, carta.titulo);
  texto(p2, 'À empresa:', MARGEM, A4.a - 4.6 * CM, 11, f.normal);
  y = paragrafo(p2, f, [{ texto: d.empresa, negrito: true }], { x: MARGEM, y: A4.a - 5.6 * CM, largura: 9 * CM, tamanho: 11 });
  texto(p2, 'Prezado(s) Cliente(s)', MARGEM, Math.min(y - 6, A4.a - 6.5 * CM), 11, f.normal);
  y = A4.a - 8.4 * CM;
  for (const p of carta.paragrafos) y = paragrafo(p2, f, p, { x: MARGEM, y, largura: LARGURA, tamanho: 12.5 }) - 14;
  paragrafo(p2, f, [{ texto: carta.votos }], { x: MARGEM, y: y - 56, largura: LARGURA, tamanho: 12.5, alinhar: 'centro' });
  const sl = 7.6 * CM;
  p2.drawImage(sinos, { x: (A4.l - sl) / 2, y: 7.4 * CM, width: sl, height: sl * SINOS_PROPORCAO });
  rodape(p2);

  if (opcoes.reservarAssinatura) await reservarLugarDaAssinatura(doc, p1);
  // sem object streams: o robô acha o /ByteRange e o /Contents no texto do PDF
  return doc.save({ useObjectStreams: false });
}

/** O dicionário da assinatura (em branco) e o campo dela na Declaração, para o robô assinar depois. */
async function reservarLugarDaAssinatura(doc: PDFDocument, pagina: PDFPage) {
  const { PDFArray, PDFHexString, PDFName, PDFNumber, PDFString } = await import('pdf-lib');
  const ctx = doc.context;
  const byteRange = PDFArray.withContext(ctx);
  byteRange.push(PDFNumber.of(0));
  for (let k = 0; k < 3; k++) byteRange.push(PDFName.of(BYTE_RANGE_EM_BRANCO));
  const assinatura = ctx.register(ctx.obj({
    Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'adbe.pkcs7.detached', ByteRange: byteRange,
    Contents: PDFHexString.of('0'.repeat(TAMANHO_DA_ASSINATURA * 2)),
    Reason: PDFString.of('Carta de balanco'), Location: PDFString.of('Taiobeiras - MG'), M: PDFString.fromDate(new Date()),
  }));
  const campo = ctx.register(ctx.obj({
    Type: 'Annot', Subtype: 'Widget', FT: 'Sig', Rect: [0, 0, 0, 0], V: assinatura, T: PDFString.of('Assinatura da contadora'), F: 4, P: pagina.ref,
  }));
  pagina.node.set(PDFName.of('Annots'), ctx.obj([campo]));
  doc.catalog.set(PDFName.of('AcroForm'), ctx.obj({ SigFlags: 3, Fields: [campo] }));
}
