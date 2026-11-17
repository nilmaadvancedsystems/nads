// O PDF do orçamento (13/11/2026, a entrada de clientes do Administrativo: "gerar um arquivo de orçamento para mandar pro
// cliente, por email e tudo"): uma página A4 com a logo do escritório, para quem é, os serviços com o valor por mês, o total,
// a taxa de entrada, a validade e as observações; no pé, o endereço do escritório. Os valores e os textos vêm do core
// (administrativo.entrada); aqui é só o desenho.
import { administrativo } from '@nads/core';
import { LOGO_NILMA_JPG_BASE64, LOGO_NILMA_PROPORCAO } from '../fiscal/cartas/imagensDaCarta';

const CM = 72 / 2.54;
const A4 = { l: 21 * CM, a: 29.7 * CM };
const MARGEM = 2 * CM;
const ENDERECO = [
  'Travessa Martinho Rego nº 30 – Salas 101/105 – Centro – Taiobeiras/MG',
  'Tel.: (38)3845-2074 / E-mail: nilmacontabilidade@gmail.com',
];
const real = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function desenharOrcamento(f: administrativo.entrada.Ficha, o: administrativo.entrada.Orcamento, numero: number, quando: Date): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle('Orçamento — ' + f.razaoSocial);
  const p = doc.addPage([A4.l, A4.a]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const cinza = rgb(0.4, 0.4, 0.4), marca = rgb(0.69, 0.15, 0.18), linha = rgb(0.85, 0.85, 0.85);
  const logo = await doc.embedJpg(LOGO_NILMA_JPG_BASE64);
  const lw = 4.2 * CM;
  p.drawImage(logo, { x: A4.l - MARGEM - lw, y: A4.a - 1.4 * CM - lw * LOGO_NILMA_PROPORCAO, width: lw, height: lw * LOGO_NILMA_PROPORCAO });

  let y = A4.a - 2.6 * CM;
  const escrever = (t: string, x: number, tam: number, fonte = normal, cor = rgb(0, 0, 0)) => p.drawText(t, { x, y, size: tam, font: fonte, color: cor });
  escrever('PROPOSTA DE HONORÁRIOS', MARGEM, 18, negrito, marca);
  y -= 0.7 * CM;
  escrever('Nº ' + String(numero).padStart(4, '0') + ' · ' + quando.toLocaleDateString('pt-BR'), MARGEM, 10, normal, cinza);

  y -= 1.6 * CM;
  escrever('Para', MARGEM, 9, negrito, cinza);
  y -= 0.55 * CM;
  escrever(f.razaoSocial.trim(), MARGEM, 13, negrito);
  y -= 0.5 * CM;
  const contato = [f.contato.trim(), f.telefone.trim(), f.email.trim()].filter(Boolean).join(' · ');
  escrever(contato, MARGEM, 10, normal, cinza);
  const regime = administrativo.entrada.REGIMES.find(r => r.valor === f.regime)?.rotulo || '';
  const atividade = administrativo.entrada.ATIVIDADES.find(a => a.valor === f.atividade)?.rotulo || '';
  y -= 0.45 * CM;
  escrever([atividade, regime, f.cidade.trim()].filter(Boolean).join(' · '), MARGEM, 10, normal, cinza);

  // os serviços
  y -= 1.4 * CM;
  const direita = A4.l - MARGEM;
  escrever('Serviço', MARGEM, 10, negrito);
  p.drawText('Por mês', { x: direita - negrito.widthOfTextAtSize('Por mês', 10), y, size: 10, font: negrito });
  y -= 0.3 * CM;
  p.drawLine({ start: { x: MARGEM, y }, end: { x: direita, y }, thickness: 0.8, color: linha });
  for (const i of o.itens) {
    y -= 0.65 * CM;
    escrever(i.descricao, MARGEM, 10.5);
    const v = real(Number(i.valor) || 0);
    p.drawText(v, { x: direita - normal.widthOfTextAtSize(v, 10.5), y, size: 10.5, font: normal });
    y -= 0.3 * CM;
    p.drawLine({ start: { x: MARGEM, y }, end: { x: direita, y }, thickness: 0.4, color: linha });
  }
  y -= 0.8 * CM;
  const total = real(administrativo.entrada.totalMensal(o));
  escrever('Total por mês', MARGEM, 12, negrito);
  p.drawText(total, { x: direita - negrito.widthOfTextAtSize(total, 13), y, size: 13, font: negrito, color: marca });
  if (o.implantacao > 0) {
    y -= 0.6 * CM;
    const t = real(o.implantacao);
    escrever('Taxa de entrada (uma vez)', MARGEM, 10.5);
    p.drawText(t, { x: direita - normal.widthOfTextAtSize(t, 10.5), y, size: 10.5, font: normal });
  }

  y -= 1.4 * CM;
  escrever('Esta proposta vale por ' + o.validadeDias + ' dias a partir de ' + quando.toLocaleDateString('pt-BR') + '.', MARGEM, 10, normal, cinza);
  // as observações, quebradas na largura da página
  if (o.observacoes.trim()) {
    y -= 0.9 * CM;
    escrever('Observações', MARGEM, 10, negrito);
    const largura = direita - MARGEM;
    for (const paragrafo of o.observacoes.trim().split(/\n+/)) {
      let atual = '';
      for (const palavra of paragrafo.split(/\s+/)) {
        const tenta = atual ? atual + ' ' + palavra : palavra;
        if (normal.widthOfTextAtSize(tenta, 10) > largura && atual) { y -= 0.5 * CM; escrever(atual, MARGEM, 10); atual = palavra; } else atual = tenta;
      }
      if (atual) { y -= 0.5 * CM; escrever(atual, MARGEM, 10); }
    }
  }

  // o pé: o escritório
  let yp = 2.2 * CM;
  p.drawLine({ start: { x: MARGEM, y: yp + 0.6 * CM }, end: { x: direita, y: yp + 0.6 * CM }, thickness: 0.4, color: linha });
  for (const l of ENDERECO) {
    p.drawText(l, { x: (A4.l - normal.widthOfTextAtSize(l, 8.5)) / 2, y: yp, size: 8.5, font: normal, color: cinza });
    yp -= 0.42 * CM;
  }
  return doc.save();
}
