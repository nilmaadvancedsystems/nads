// O PDF da "Solicitação de documentos" (17/11/2026, o envio pelo WhatsApp no estilo do Acessórias): vai anexado na
// mensagem que o robô manda pelo WhatsApp no Pedir extratos. Uma folha A4 com o logo e o endereço do escritório (os mesmos
// da Carta de balanço), a empresa, a competência, um documento por linha (com a explicação curta), o prazo e para onde
// mandar. Os textos são do core (extrator: competências, nome de cada documento); aqui é só o desenho.
import { extrator as x } from '@nads/core';
import type { PDFFont, PDFPage, RGB } from 'pdf-lib';
import { ENDERECO } from '../../../../telas/fiscal/cartas/cartaDeBalancoPdf';
import { LOGO_NILMA_JPG_BASE64, LOGO_NILMA_PROPORCAO } from '../../../../telas/fiscal/cartas/imagensDaCarta';

const CM = 72 / 2.54;
const A4 = { l: 21 * CM, a: 29.7 * CM };
const MARGEM = 2 * CM;
const LARGURA = A4.l - 2 * MARGEM;

/** As letras que a fonte padrão do PDF (WinAnsi) não tem saem do texto (um emoji no nome do documento, por exemplo). */
function seguro(t: string): string {
  return t.replace(/[^\x20-\x7E\xA0-\xFF–—•“”‘’…€]/gu, '').replace(/ {2,}/g, ' ').trim();
}

/** Quebra o texto em linhas que cabem na largura. */
function linhas(t: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const saida: string[] = [];
  let atual = '';
  for (const palavra of seguro(t).split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? atual + ' ' + palavra : palavra;
    if (atual && fonte.widthOfTextAtSize(tentativa, tamanho) > largura) { saida.push(atual); atual = palavra; } else atual = tentativa;
  }
  if (atual) saida.push(atual);
  return saida;
}

export interface DadosDaSolicitacao {
  pedido: x.PedidoDeExtratos;
  /** 'dd/mm/aaaa' ou '' */
  prazo: string;
  emitidoEm: Date;
}

/** Desenha a Solicitação de documentos e devolve os bytes do PDF. */
export async function desenharSolicitacao(d: DadosDaSolicitacao): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle('Solicitação de documentos - ' + d.pedido.cliente);
  doc.setAuthor('Nilma Contabilidade');
  doc.setCreator('nads');
  doc.setProducer('nads');
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedJpg(LOGO_NILMA_JPG_BASE64);
  const preto = rgb(0, 0, 0);
  const cinza = rgb(0.35, 0.35, 0.35);
  const destaque = rgb(0.96, 0.96, 0.96);
  const escrever = (pagina: PDFPage, t: string, xx: number, y: number, tamanho: number, fonte: PDFFont, cor: RGB = preto) =>
    pagina.drawText(seguro(t), { x: xx, y, size: tamanho, font: fonte, color: cor });

  const novaPagina = () => {
    const p = doc.addPage([A4.l, A4.a]);
    const lw = 5.6 * CM;
    p.drawImage(logo, { x: A4.l - MARGEM - lw + 0.3 * CM, y: A4.a - 1.4 * CM - lw * LOGO_NILMA_PROPORCAO, width: lw, height: lw * LOGO_NILMA_PROPORCAO });
    escrever(p, 'Solicitação de documentos', MARGEM, A4.a - 2.9 * CM, 18, negrito);
    p.drawLine({ start: { x: MARGEM, y: A4.a - 3.6 * CM }, end: { x: A4.l - MARGEM, y: A4.a - 3.6 * CM }, thickness: 0.6, color: cinza });
    ENDERECO.forEach((l, k) => escrever(p, l, MARGEM, 2.2 * CM - k * 9, 7, normal, cinza));
    return p;
  };
  let pagina = novaPagina();
  let y = A4.a - 4.7 * CM;
  /** passa para a página seguinte quando não cabe mais `altura` */
  const caber = (altura: number) => { if (y - altura < 3.2 * CM) { pagina = novaPagina(); y = A4.a - 4.7 * CM; } };

  const competencia = x.competenciasPorExtenso(d.pedido.competencias);
  escrever(pagina, 'À empresa:', MARGEM, y, 10, normal, cinza);
  y -= 15;
  for (const l of linhas(d.pedido.cliente, negrito, 13, LARGURA)) { escrever(pagina, l, MARGEM, y, 13, negrito); y -= 17; }
  y -= 4;
  escrever(pagina, 'Competência: ', MARGEM, y, 10.5, normal);
  escrever(pagina, competencia, MARGEM + normal.widthOfTextAtSize('Competência: ', 10.5), y, 10.5, negrito);
  const emissao = 'Emitida em ' + x.dataPorExtenso(d.emitidoEm);
  escrever(pagina, emissao, A4.l - MARGEM - normal.widthOfTextAtSize(seguro(emissao), 10.5), y, 10.5, normal, cinza);
  y -= 30;

  for (const l of linhas('Prezado(s) cliente(s), para o fechamento contábil de ' + competencia + ', pedimos que nos enviem os documentos abaixo:', normal, 11.5, LARGURA)) {
    escrever(pagina, l, MARGEM, y, 11.5, normal);
    y -= 16;
  }
  y -= 8;

  for (const documento of d.pedido.documentos) {
    const nome = linhas(x.nomeComCompetencias(documento, d.pedido), negrito, 11, LARGURA - 0.7 * CM);
    const detalhe = documento.detalhe ? linhas(documento.detalhe, normal, 9.5, LARGURA - 0.7 * CM) : [];
    caber(nome.length * 14 + detalhe.length * 12 + 10);
    pagina.drawRectangle({ x: MARGEM + 0.05 * CM, y: y - 1, width: 5, height: 5, color: preto });
    nome.forEach((l, k) => escrever(pagina, l, MARGEM + 0.5 * CM, y - k * 14, 11, negrito));
    y -= nome.length * 14;
    detalhe.forEach((l, k) => escrever(pagina, l, MARGEM + 0.5 * CM, y - k * 12, 9.5, normal, cinza));
    y -= detalhe.length * 12 + 10;
  }

  y -= 6;
  caber(4 * CM);
  if (d.prazo) {
    pagina.drawRectangle({ x: MARGEM, y: y - 10, width: LARGURA, height: 26, color: destaque });
    escrever(pagina, 'Prazo para envio: até ' + d.prazo, MARGEM + 0.4 * CM, y - 1, 12, negrito);
    y -= 40;
  }
  for (const l of linhas('Como enviar: responda o e-mail desta solicitação com os arquivos em anexo (PDF, OFX ou planilha) ou mande pelo WhatsApp do escritório, ' + x.WHATSAPP_PARA_RESPONDER + '.', normal, 10.5, LARGURA)) {
    escrever(pagina, l, MARGEM, y, 10.5, normal);
    y -= 15;
  }
  y -= 20;
  caber(2 * CM);
  escrever(pagina, 'Qualquer dúvida, estamos à disposição.', MARGEM, y, 11, normal);
  escrever(pagina, 'Atenciosamente,', MARGEM, y - 26, 11, normal);
  escrever(pagina, 'NILMA CONTABILIDADE', MARGEM, y - 42, 11, negrito);
  return doc.save();
}
