// O relatório da antecipação para o cliente (Vitor, ticket PK6RIE, 12/11/2026: "deixe o relatório bem compreensível, por ser
// cliente, demanda uma coisa mais simples e compreensível"): uma página A4 em retrato (mais, se as notas não couberem), sem
// CFOP, CST nem base de cálculo. Em cima, o valor a pagar em destaque; depois, numa frase, o que é esse valor e de onde ele
// sai (as compras de outros estados, o ICMS que já veio na nota e o do ES); a lista das notas que entram na conta; e, no pé,
// quantas notas ficaram de fora e para quem perguntar. O pdf-lib só carrega no clique (não pesa a abertura da tela).
import { tarefas as t } from '@nads/core';
import type { PDFFont, PDFPage } from 'pdf-lib';

const CM = 72 / 2.54;
const A4 = { l: 21 * CM, a: 29.7 * CM };
const MARGEM = 1.8 * CM;
const LARGURA = A4.l - 2 * MARGEM;
const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface RelatorioDoCliente {
  empresa: t.sieg.EmpresaDoRelatorio;
  /** "Outubro de 2026" */
  periodo: string;
  /** todas as linhas do período (as que não cobram só entram na contagem do pé) */
  linhas: readonly t.sieg.LinhaCalculada[];
  aliquotaInterna: number;
  emitidoEm: Date;
}

/** O texto cortado para caber na largura (com reticências). */
function caber(texto: string, fonte: PDFFont, tam: number, largura: number): string {
  if (fonte.widthOfTextAtSize(texto, tam) <= largura) return texto;
  let s = texto;
  while (s.length > 1 && fonte.widthOfTextAtSize(s + '…', tam) > largura) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}

/** As palavras em linhas que cabem na largura. */
function quebrar(texto: string, fonte: PDFFont, tam: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = '';
  for (const p of texto.split(/\s+/)) {
    const tenta = atual ? atual + ' ' + p : p;
    if (atual && fonte.widthOfTextAtSize(tenta, tam) > largura) { linhas.push(atual); atual = p; } else atual = tenta;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function desenharRelatorioDoCliente(r: RelatorioDoCliente): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle('Antecipação do ICMS · ' + r.periodo + ' · ' + r.empresa.razaoSocial);
  doc.setAuthor('Nilma Contabilidade');
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const preto = rgb(0.1, 0.1, 0.12), cinza = rgb(0.4, 0.4, 0.44), linhaCor = rgb(0.85, 0.85, 0.87), fundo = rgb(0.95, 0.95, 0.96);

  const cobram = t.sieg.linhasQueCobram(r.linhas);
  const tot = t.sieg.totaisDaAntecipacao(cobram);
  const fora = r.linhas.length - cobram.length;

  let pagina: PDFPage = doc.addPage([A4.l, A4.a]);
  let y = A4.a - MARGEM;
  const texto = (s: string, x: number, yy: number, tam: number, fonte = normal, cor = preto) => pagina.drawText(s, { x, y: yy, size: tam, font: fonte, color: cor });
  const aDireita = (s: string, xDir: number, yy: number, tam: number, fonte = normal, cor = preto) => texto(s, xDir - fonte.widthOfTextAtSize(s, tam), yy, tam, fonte, cor);

  // o cabeçalho
  texto('Antecipação do ICMS', MARGEM, y - 20, 20, negrito);
  aDireita('Nilma Contabilidade', A4.l - MARGEM, y - 14, 10, negrito, cinza);
  y -= 40;
  texto(r.periodo, MARGEM, y, 12, normal, cinza);
  y -= 22;
  texto(caber(r.empresa.razaoSocial, negrito, 11, LARGURA), MARGEM, y, 11, negrito);
  y -= 14;
  if (r.empresa.cnpj) { texto('CNPJ ' + r.empresa.cnpj, MARGEM, y, 9, normal, cinza); y -= 14; }
  y -= 10;

  // o valor a pagar, em destaque
  const alturaCaixa = 70;
  pagina.drawRectangle({ x: MARGEM, y: y - alturaCaixa, width: LARGURA, height: alturaCaixa, color: fundo });
  texto('Valor a pagar de antecipação', MARGEM + 16, y - 24, 11, normal, cinza);
  texto(brl(tot.antecipacao), MARGEM + 16, y - 54, 26, negrito);
  y -= alturaCaixa + 22;

  // o que é, numa frase
  const explicacao = 'Quando a empresa compra mercadoria de outro estado para revender, o Espírito Santo cobra a diferença entre o seu ICMS ('
    + String(r.aliquotaInterna).replace('.', ',') + '%) e o ICMS que já veio destacado na nota do fornecedor. Essa diferença é a antecipação, paga pela guia (DAE) do mês.';
  for (const l of quebrar(explicacao, normal, 10, LARGURA)) { texto(l, MARGEM, y, 10); y -= 14; }
  y -= 10;

  // as três contas que levam ao valor
  const contas: [string, number][] = [['Compras de outros estados', tot.valorOperacao], ['ICMS do Espírito Santo', tot.icmsInterno], ['ICMS já pago na nota', tot.icmsDestacado]];
  const largCaixa = (LARGURA - 2 * 10) / 3;
  contas.forEach(([rotulo, valor], i) => {
    const x = MARGEM + i * (largCaixa + 10);
    pagina.drawRectangle({ x, y: y - 46, width: largCaixa, height: 46, borderColor: linhaCor, borderWidth: 1 });
    texto(rotulo, x + 10, y - 17, 8.5, normal, cinza);
    texto(brl(valor), x + 10, y - 35, 12, negrito);
  });
  y -= 46 + 8;
  // só o que a Helvetica do PDF escreve (WinAnsi): sem o sinal de menos tipográfico
  texto('ICMS do Espírito Santo menos o ICMS já pago na nota = valor a pagar', MARGEM, y - 8, 8.5, normal, cinza);
  y -= 32;

  // as notas
  const colunas = [
    { rotulo: 'Nota', x: MARGEM, larg: 62, dir: false },
    { rotulo: 'Data', x: MARGEM + 66, larg: 60, dir: false },
    { rotulo: 'Fornecedor', x: MARGEM + 130, larg: LARGURA - 130 - 3 * 74 - 8, dir: false },
    { rotulo: 'Valor da compra', x: A4.l - MARGEM - 148, larg: 72, dir: true },
    { rotulo: 'ICMS já pago', x: A4.l - MARGEM - 74, larg: 72, dir: true },
    { rotulo: 'A pagar', x: A4.l - MARGEM, larg: 72, dir: true },
  ];
  const cabecalhoDaTabela = () => {
    texto('Notas que entram no valor', MARGEM, y, 11, negrito);
    y -= 18;
    for (const c of colunas) (c.dir ? aDireita : texto)(c.rotulo, c.x, y, 8.5, negrito, cinza);
    y -= 6;
    pagina.drawLine({ start: { x: MARGEM, y }, end: { x: A4.l - MARGEM, y }, thickness: 1, color: linhaCor });
    y -= 14;
  };
  cabecalhoDaTabela();
  // a mesma nota com mais de uma linha (um CST por linha) aparece uma vez, somada
  const porNota = new Map<string, { numero: string; data: string; fornecedor: string; valor: number; icms: number; aPagar: number }>();
  for (const l of cobram) {
    const k = l.chave || l.numero;
    const n = porNota.get(k) || { numero: l.numero, data: l.data, fornecedor: l.fornecedor.nome, valor: 0, icms: 0, aPagar: 0 };
    n.valor += l.valorOperacao; n.icms += l.icmsDestacado; n.aPagar += l.antecipacao;
    porNota.set(k, n);
  }
  for (const n of porNota.values()) {
    if (y < MARGEM + 60) { pagina = doc.addPage([A4.l, A4.a]); y = A4.a - MARGEM; cabecalhoDaTabela(); }
    const valores = [n.numero, n.data, n.fornecedor, brl(t.sieg.arred(n.valor)), brl(t.sieg.arred(n.icms)), brl(t.sieg.arred(n.aPagar))];
    colunas.forEach((c, i) => (c.dir ? aDireita : texto)(caber(valores[i], normal, 9, c.larg), c.x, y, 9));
    y -= 6;
    pagina.drawLine({ start: { x: MARGEM, y }, end: { x: A4.l - MARGEM, y }, thickness: 0.5, color: linhaCor });
    y -= 13;
  }
  if (y < MARGEM + 70) { pagina = doc.addPage([A4.l, A4.a]); y = A4.a - MARGEM; }
  texto('Total', MARGEM, y, 9.5, negrito);
  aDireita(brl(tot.valorOperacao), colunas[3].x, y, 9.5, negrito);
  aDireita(brl(tot.icmsDestacado), colunas[4].x, y, 9.5, negrito);
  aDireita(brl(tot.antecipacao), colunas[5].x, y, 9.5, negrito);
  y -= 28;

  // o pé
  if (fora > 0) {
    const s = fora === 1 ? '1 item de nota de outro estado não entra no valor' : fora + ' itens de notas de outros estados não entram no valor';
    for (const l of quebrar(s + ' (mercadoria com substituição tributária, que não é para revenda ou que não precisa de antecipação).', normal, 8.5, LARGURA)) { texto(l, MARGEM, y, 8.5, normal, cinza); y -= 12; }
    y -= 4;
  }
  texto('Dúvidas? É só responder o e-mail. · Emitido em ' + r.emitidoEm.toLocaleDateString('pt-BR'), MARGEM, y, 8.5, normal, cinza);
  return doc.save();
}
