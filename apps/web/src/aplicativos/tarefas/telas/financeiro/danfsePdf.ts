// O desenho do PDF da DANFSe v2.0 (15/10/2026: "faz o danf poder ser baixado"): uma página A4 no layout do portal nacional,
// feita no navegador a partir dos dados que o core tirou do XML (nfse.dadosDaDanfse). O pdf-lib e o qrcode só são
// carregados quando a pessoa clica em "Baixar DANFSe" (não pesam a abertura da tela).
import { nfse } from '@nads/core';
import type { PDFFont, PDFPage, RGB } from 'pdf-lib';

const A4 = { l: 595.28, a: 841.89 };
const MARGEM = 20;
const LARGURA = A4.l - 2 * MARGEM;
/** onde começa cada coluna (as do modelo do portal, em fração da largura) */
const COLUNAS = [0, 0.27, 0.53, 0.78];

interface Campo { col: number; span?: number; rotulo: string; valor: string; negrito?: boolean; grande?: boolean; fundo?: boolean }

export async function desenharDanfse(d: nfse.DadosDaDanfse): Promise<Uint8Array> {
  const [{ PDFDocument, StandardFonts, rgb }, qr] = await Promise.all([import('pdf-lib'), import('qrcode')]);
  const doc = await PDFDocument.create();
  doc.setTitle('DANFSe ' + d.numeroNfse);
  doc.setSubject('Documento Auxiliar da NFS-e');
  doc.setProducer('nads');
  const pagina = doc.addPage([A4.l, A4.a]);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);

  const preto = rgb(0.1, 0.1, 0.1);
  const cinza = rgb(0.45, 0.45, 0.45);
  const fundo = rgb(0.92, 0.92, 0.92);
  const linha = rgb(0.15, 0.15, 0.15);

  // texto que o Helvetica (WinAnsi) não sabe escrever vira "?", em vez de derrubar o PDF
  const aceitos = new Set(fonte.getCharacterSet());
  const limpo = (t: string) => Array.from(t.replace(new RegExp('[\u00a0\u2007\u202f]', 'g'), ' ')).map(c => (aceitos.has(c.codePointAt(0) as number) ? c : '?')).join('');

  const x = (col: number) => MARGEM + COLUNAS[col] * LARGURA;
  const py = (y: number) => A4.a - MARGEM - y; // y de cima para baixo, a partir da margem

  function quebrar(t: string, f: PDFFont, tam: number, largura: number): string[] {
    const saida: string[] = [];
    for (const paragrafo of limpo(t).split('\n')) {
      let atual = '';
      for (const palavra of paragrafo.split(' ')) {
        const teste = atual ? atual + ' ' + palavra : palavra;
        if (atual && f.widthOfTextAtSize(teste, tam) > largura) { saida.push(atual); atual = palavra; } else atual = teste;
      }
      saida.push(atual);
    }
    return saida;
  }

  function texto(p: PDFPage, t: string, px: number, y: number, f: PDFFont, tam: number, cor: RGB = preto) {
    p.drawText(limpo(t), { x: px, y: py(y), font: f, size: tam, color: cor });
  }

  function reta(y: number, de = 0, ate = LARGURA, grossura = 0.8) {
    pagina.drawLine({ start: { x: MARGEM + de, y: py(y) }, end: { x: MARGEM + ate, y: py(y) }, thickness: grossura, color: linha });
  }

  let y = 0;

  // ---- o cabeçalho: o logo escrito, o título e o município ----
  const ALTURA_TOPO = 50;
  texto(pagina, 'NFS', MARGEM + 6, y + 36, negrito, 34, rgb(0.18, 0.5, 0.27));
  texto(pagina, 'e', MARGEM + 6 + negrito.widthOfTextAtSize('NFS', 34) + 1, y + 36, negrito, 24, rgb(0.1, 0.45, 0.75));
  texto(pagina, 'Nota Fiscal de', MARGEM + 100, y + 25, fonte, 10, cinza);
  texto(pagina, 'Serviço Eletrônica', MARGEM + 100, y + 37, fonte, 10, cinza);
  const centrar = (t: string, f: PDFFont, tam: number, yy: number) => texto(pagina, t, MARGEM + (LARGURA - f.widthOfTextAtSize(limpo(t), tam)) / 2 + 10, yy, f, tam);
  centrar('DANFSe v2.0', negrito, 10, y + 20);
  centrar('Documento Auxiliar da NFS-e', negrito, 10, y + 33);
  const dir = (t: string, f: PDFFont, tam: number, yy: number) => texto(pagina, t, MARGEM + LARGURA - 4 - f.widthOfTextAtSize(limpo(t), tam), yy, f, tam);
  dir('Município: ' + d.municipio, negrito, 11, y + 16);
  dir('Ambiente Gerador: ' + d.ambienteGerador, fonte, 7.5, y + 28);
  dir('Tipo de Ambiente: ' + d.tipoAmbiente, fonte, 7.5, y + 38);
  y += ALTURA_TOPO;
  reta(y);

  // ---- uma linha de campos: o rótulo em negrito em cima, o valor embaixo; a altura acompanha o que quebrar ----
  function linhaDeCampos(campos: Campo[], titulo?: string, folga = 0): number {
    const larg = (c: Campo) => (COLUNAS[Math.min(c.col + (c.span || 1), 4) as 0 | 1 | 2 | 3] ?? 1) * LARGURA - COLUNAS[c.col] * LARGURA - 8;
    const medidos = campos.map(c => {
      const tam = c.grande ? 9 : 7.5;
      return { c, tam, rotulo: c.rotulo ? quebrar(c.rotulo, negrito, 6.5, larg(c)) : [], valor: quebrar(c.valor, c.negrito || c.grande ? negrito : fonte, tam, larg(c)) };
    });
    const tituloLinhas = titulo ? quebrar(titulo, negrito, 8.5, COLUNAS[1] * LARGURA - 12) : [];
    const h = Math.max(22, 4 + Math.max(...medidos.map(m => m.rotulo.length * 7.5 + m.valor.length * 9)) + 3, titulo ? 10 + tituloLinhas.length * 10 : 0) + folga;
    if (titulo) {
      pagina.drawRectangle({ x: MARGEM, y: py(y + h - 2), width: COLUNAS[1] * LARGURA - 4, height: h - 4, color: fundo });
      tituloLinhas.forEach((t, i) => texto(pagina, t, MARGEM + 6, y + (h - tituloLinhas.length * 10) / 2 + 8 + i * 10, negrito, 8.5));
    }
    for (const m of medidos) {
      if (m.c.fundo) pagina.drawRectangle({ x: x(m.c.col) - 2, y: py(y + h - 2), width: larg(m.c) + 8, height: h - 4, color: fundo });
      let yy = y + 8;
      for (const r of m.rotulo) { texto(pagina, r, x(m.c.col) + 4, yy, negrito, 6.5); yy += 7.5; }
      for (const v of m.valor) { texto(pagina, v, x(m.c.col) + 4, yy + 0.5, m.c.negrito || m.c.grande ? negrito : fonte, m.tam); yy += 9; }
    }
    y += h;
    return h;
  }

  // ---- a chave de acesso ----
  const topoDosDados = y;
  linhaDeCampos([{ col: 0, span: 3, rotulo: 'CHAVE DE ACESSO DA NFS-E', valor: d.chave }]);

  // ---- número, datas, DPS, emitente e o QR code ----
  linhaDeCampos([
    { col: 0, rotulo: 'NÚMERO DA NFS-E', valor: d.numeroNfse }, { col: 1, rotulo: 'COMPETÊNCIA DA NFS-E', valor: d.competencia },
    { col: 2, span: 2, rotulo: 'DATA E HORA DA EMISSÃO DA NFS-E', valor: d.emitidaEm },
  ]);
  linhaDeCampos([
    { col: 0, rotulo: 'NÚMERO DA DPS', valor: d.numeroDps }, { col: 1, rotulo: 'SÉRIE DA DPS', valor: d.serieDps },
    { col: 2, span: 2, rotulo: 'DATA E HORA DA EMISSÃO DA DPS', valor: d.dpsEmitidaEm },
  ]);
  linhaDeCampos([
    { col: 0, rotulo: 'EMITENTE DA NFS-E', valor: d.emitente, fundo: true }, { col: 1, rotulo: 'SITUAÇÃO DA NFS-E', valor: d.situacao },
    { col: 2, span: 2, rotulo: 'FINALIDADE', valor: d.finalidade },
  ]);
  // o QR code (a consulta pública com a chave de acesso) e o texto da autenticidade, na coluna da direita
  const matriz = (qr.default ?? qr).create(d.urlDeConsulta, { errorCorrectionLevel: 'M' }).modules;
  const lado = 50;
  const modulo = lado / matriz.size;
  const qx = MARGEM + COLUNAS[3] * LARGURA + 40;
  for (let r = 0; r < matriz.size; r++) for (let c = 0; c < matriz.size; c++) {
    if (matriz.get(r, c)) pagina.drawRectangle({ x: qx + c * modulo, y: py(topoDosDados + 6 + (r + 1) * modulo), width: modulo + 0.05, height: modulo + 0.05, color: rgb(0, 0, 0) });
  }
  quebrar('A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e.', fonte, 6, 122)
    .forEach((t, i) => texto(pagina, t, MARGEM + COLUNAS[3] * LARGURA + 6, topoDosDados + 6 + lado + 8 + i * 7, fonte, 6));
  reta(y);

  // ---- prestador ----
  const p = d.prestador;
  const linhaPessoa = (titulo: string, q: nfse.PessoaDanfse) => {
    linhaDeCampos([{ col: 1, rotulo: 'CNPJ / CPF / NIF', valor: q.documento }, { col: 2, rotulo: 'Indicador Municipal (Inscrição)', valor: q.inscricaoMunicipal }, { col: 3, rotulo: 'Telefone', valor: q.fone }], titulo);
    linhaDeCampos([{ col: 0, span: 2, rotulo: 'Nome / Nome Empresarial', valor: q.nome }, { col: 2, rotulo: 'Município / Sigla UF', valor: q.municipio }, { col: 3, rotulo: 'Código IBGE / CEP', valor: q.ibgeCep }]);
    linhaDeCampos([{ col: 0, span: 2, rotulo: 'Endereço', valor: q.endereco }, { col: 2, span: 2, rotulo: 'E-mail', valor: q.email }]);
  };
  linhaPessoa('PRESTADOR / FORNECEDOR', p);
  linhaDeCampos([{ col: 0, rotulo: 'Simples Nacional na Data de Competência', valor: p.simples }, { col: 1, span: 3, rotulo: 'Regime de Apuração Tributária pelo SN', valor: p.regimeApuracao }]);
  reta(y);
  linhaPessoa('TOMADOR DO SERVIÇO', d.tomador);
  reta(y);

  const faixa = (t: string, borda = true) => {
    const h = 12;
    const tam = 8;
    texto(pagina, t, MARGEM + (LARGURA - negrito.widthOfTextAtSize(limpo(t), tam)) / 2, y + 9, negrito, tam);
    y += h;
    if (borda) reta(y);
  };
  faixa('DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e');
  faixa('INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e');

  // ---- serviço prestado ----
  const s = d.servico;
  linhaDeCampos([{ col: 1, rotulo: 'Código de Tributação Nacional / Municipal', valor: s.codigoTributacao }, { col: 2, rotulo: 'Código da NBS', valor: s.nbs }, { col: 3, rotulo: 'Local da Prestação / Sigla UF / País', valor: s.local }], 'SERVIÇO PRESTADO');
  linhaDeCampos([{ col: 0, span: 4, rotulo: '', valor: s.descricaoDoCodigo }], undefined, -8);
  linhaDeCampos([{ col: 0, span: 4, rotulo: 'Descrição do Serviço', valor: s.descricao }]);
  reta(y);

  // ---- tributação municipal ----
  const m = d.municipal;
  linhaDeCampos([{ col: 1, rotulo: 'Tipo de Tributação do ISSQN', valor: m.tributacao }, { col: 2, span: 2, rotulo: 'Município / Sigla UF / País de Incidência do ISSQN', valor: m.incidencia }], 'TRIBUTAÇÃO MUNICIPAL (ISSQN)');
  linhaDeCampos([{ col: 0, rotulo: 'Regime Especial de Tributação do ISSQN', valor: m.regimeEspecial }, { col: 1, rotulo: 'Tipo de Imunidade do ISSQN', valor: m.imunidade }, { col: 2, rotulo: 'Suspensão da Exigibilidade do ISSQN', valor: m.suspensao }, { col: 3, rotulo: 'Número Processo Suspensão', valor: m.processoSuspensao }]);
  linhaDeCampos([{ col: 0, rotulo: 'Benefício Municipal', valor: m.beneficio }, { col: 1, rotulo: 'Cálculo do BM', valor: m.calculoBm }, { col: 2, rotulo: 'Total Deduções/Reduções', valor: m.deducoes }, { col: 3, rotulo: 'Desconto Incondicionado', valor: m.descontoIncondicionado }]);
  linhaDeCampos([{ col: 0, rotulo: 'BC ISSQN', valor: m.baseDeCalculo }, { col: 1, rotulo: 'Alíquota Aplicada', valor: m.aliquota }, { col: 2, rotulo: 'Retenção do ISSQN', valor: m.retencao }, { col: 3, rotulo: 'ISSQN Apurado', valor: m.issqn }]);
  reta(y);

  // ---- tributação federal ----
  const f = d.federal;
  linhaDeCampos([{ col: 1, rotulo: 'IRRF', valor: f.irrf }, { col: 2, rotulo: 'Contribuição Previdenciária - Retido', valor: f.previdencia }, { col: 3, rotulo: 'Contribuições Sociais - Retidas', valor: f.sociais }], 'TRIBUTAÇÃO FEDERAL (EXCETO CBS)');
  linhaDeCampos([{ col: 0, rotulo: 'PIS - Débito Apuração Própria', valor: f.pis }, { col: 1, rotulo: 'COFINS - Débito Apuração Própria', valor: f.cofins }, { col: 2, span: 2, rotulo: 'Descrição Contrib. Sociais - Retidas', valor: f.descricaoSociais }]);
  reta(y);

  // ---- IBS / CBS ----
  const i = d.ibsCbs;
  linhaDeCampos([{ col: 1, rotulo: 'CST / cClassTrib', valor: i.cst }, { col: 2, span: 2, rotulo: 'Indicador de Operação / Código IBGE Incidência / Sigla UF', valor: i.operacao }], 'TRIBUTAÇÃO IBS / CBS');
  linhaDeCampos([{ col: 0, rotulo: 'Exclusões e Reduções da Base de Cálculo', valor: i.exclusoes }, { col: 1, rotulo: 'Base de Cálculo Após Exclusões e Reduções', valor: i.baseAposExclusoes }, { col: 2, rotulo: 'Red. Alíquota IBS / Red. Alíquota CBS', valor: i.reducao }, { col: 3, rotulo: 'Alíquota - IBS UF / IBS Mun', valor: i.aliquotaIbs }]);
  linhaDeCampos([{ col: 0, rotulo: 'Alíq. Efetiva Municipal - IBS', valor: i.efetivaMunicipal }, { col: 1, rotulo: 'Valor Apurado Municipal - IBS', valor: i.apuradoMunicipal }, { col: 2, rotulo: 'Alíq. Efetiva Estadual - IBS', valor: i.efetivaEstadual }, { col: 3, rotulo: 'Valor Apurado Estadual - IBS', valor: i.apuradoEstadual }]);
  linhaDeCampos([{ col: 0, rotulo: 'Valor Total Apurado - IBS', valor: i.totalIbs }, { col: 1, rotulo: 'Alíquota - CBS', valor: i.aliquotaCbs }, { col: 2, rotulo: 'Alíquota Efetiva - CBS', valor: i.efetivaCbs }, { col: 3, rotulo: 'Valor Total Apurado - CBS', valor: i.apuradoCbs }]);
  reta(y);

  // ---- valor total ----
  const t = d.totais;
  linhaDeCampos([{ col: 1, rotulo: 'VALOR DA OPERAÇÃO / SERVIÇO', valor: t.valorServico, grande: true }, { col: 2, rotulo: 'Desconto Incondicionado', valor: t.descontoIncondicionado }, { col: 3, rotulo: 'Desconto Condicionado', valor: t.descontoCondicionado }], 'VALOR TOTAL DA NFS-E');
  linhaDeCampos([{ col: 0, rotulo: 'Total das Retenções (ISSQN / Federais)', valor: t.retencoes }, { col: 1, rotulo: 'VALOR LÍQUIDO da NFS-e', valor: t.liquido }, { col: 2, rotulo: 'Total do IBS/CBS', valor: t.ibsCbs }, { col: 3, rotulo: 'VALOR LÍQUIDO da NFS-e + IBS/CBS', valor: t.liquidoComIbsCbs, fundo: true }]);
  reta(y);

  // ---- informações complementares ----
  texto(pagina, 'INFORMAÇÕES COMPLEMENTARES', MARGEM + 6, y + 13, negrito, 8.5);
  y += 22;
  reta(y - 2);
  quebrar(d.informacoes, fonte, 7.5, LARGURA - 16).forEach((l, k) => texto(pagina, l, MARGEM + 4, y + 10 + k * 10, fonte, 7.5));

  // ---- o rodapé: ciência, assinatura e a chave, numa caixa colada embaixo ----
  const rodape = A4.a - 2 * MARGEM - 40 - 1;
  const alturaRodape = 40;
  pagina.drawRectangle({ x: MARGEM, y: py(rodape + alturaRodape), width: LARGURA, height: alturaRodape, borderColor: linha, borderWidth: 0.8 });
  const cols = [0, 0.27, 0.53];
  cols.forEach((c, k) => {
    if (k) pagina.drawLine({ start: { x: MARGEM + c * LARGURA, y: py(rodape) }, end: { x: MARGEM + c * LARGURA, y: py(rodape + alturaRodape) }, thickness: 0.8, color: linha });
  });
  texto(pagina, 'DATA CIENTIFICAÇÃO', MARGEM + 8, rodape + 14, negrito, 8);
  texto(pagina, 'IDENTIFICAÇÃO E ASSINATURA', MARGEM + COLUNAS[1] * LARGURA + 8, rodape + 14, negrito, 8);
  texto(pagina, 'Nº NFS-E / CHAVE NFS-E', MARGEM + COLUNAS[2] * LARGURA + 8, rodape + 14, negrito, 8);
  quebrar(d.numeroNfse + ' / ' + d.chave, fonte, 7, LARGURA * (1 - COLUNAS[2]) - 16).forEach((l, k) => texto(pagina, l, MARGEM + COLUNAS[2] * LARGURA + 8, rodape + 25 + k * 8, fonte, 7));

  // a moldura da página
  pagina.drawRectangle({ x: MARGEM, y: MARGEM, width: LARGURA, height: A4.a - 2 * MARGEM, borderColor: linha, borderWidth: 0.8 });
  return doc.save();
}
