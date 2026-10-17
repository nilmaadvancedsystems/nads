// O desenho do PDF da DANFSe v2.0 (15/10/2026: "faz o danf poder ser baixado"), no modelo do Anexo I da Nota Técnica 008
// SE/CGNFS-e (16/10/2026: "essa danfe gerada no app não parece a emitida pelo governo"): uma página A4 em retrato, feita no
// navegador (ou no robô) a partir dos dados que o core tirou do XML (nfse.dadosDaDanfse). O pdf-lib e o qrcode só carregam
// quando a pessoa clica em "Baixar DANFSe" (não pesam a abertura da tela).
//
// O que a NT manda e está aqui (item e tabela da NT entre parênteses):
//   - A4 em retrato, moldura de 1 pt a 0,18 cm da borda (2.2.2, 2.2.3); linhas divisórias de 0,5 pt; sombreamento cinza 5% no
//     cabeçalho, nos títulos dos blocos e nos campos "Emitente da NFS-e" e "Valor Líquido da NFS-e + IBS/CBS" (2.2.3);
//   - fontes Arial nos rótulos e Microsoft Sans Serif nos conteúdos, em preto sólido: aqui a Helvetica do PDF (as mesmas
//     medidas de letra, sem embutir fonte) (2.4); título do bloco 7 pt negrito caixa alta, rótulo do campo 6 pt negrito, rótulos
//     da identificação 7 pt negrito caixa alta, conteúdo 7 pt normal (2.4.1 a 2.4.4);
//   - cabeçalho: a logomarca da NFS-e à esquerda (4,00 cm de largura, a imagem da própria NT), "DANFSe v2.0" e "Documento
//     Auxiliar da NFS-e" ao centro em negrito de 9 pt, o município (8 pt) e os ambientes (6 pt) à direita; em ambiente de
//     homologação, "NFS-e SEM VALIDADE JURÍDICA" em vermelho (2.4.3);
//   - o QR code de 1,52 x 1,52 cm em X 17,48 / Y 1,67 cm (https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=<chave>) e,
//     embaixo dele, o texto da autenticidade em 6 pt (2.4.3);
//   - os campos na ordem, com os nomes e nas colunas (0,30 / 5,41 / 10,51 / 15,62 cm) do Anexo I, com as alturas mínimas e as
//     posições da tabela 2.4.5; a altura cresce quando o texto quebra, o canhoto fica fixo no pé (Y 28,10 cm).
import { nfse } from '@nads/core';
import type { PDFFont, RGB } from 'pdf-lib';
import { LOGO_NFSE_PNG_BASE64, LOGO_NFSE_PROPORCAO } from './danfseLogo';

const CM = 72 / 2.54;
const A4 = { l: 21 * CM, a: 29.7 * CM };
/** onde começa cada coluna do Anexo I (cm) e a largura de uma coluna */
const COLUNAS = [0.3, 5.41, 10.51, 15.62];
const LARGURA_COLUNA = 5.09;
const X_INICIAL = 0.3;
const X_FINAL = 20.7;
/** a moldura da página (cm da borda): a NT pede 0,15 a 0,20 */
const MOLDURA = 0.18;
/** o canhoto: Y fixo, 0,67 cm de altura */
const Y_CANHOTO = 28.1;
const ALTURA_CANHOTO = 0.67;
/** o espaço de respiro entre o texto e a borda do campo */
const RESPIRO = 4;

interface Campo {
  col: number;
  /** quantas colunas o campo ocupa (1 a 4) */
  span?: number;
  rotulo: string;
  valor: string;
  /** o cinza de 5% atrás do campo (Emitente, Valor Líquido + IBS/CBS) */
  fundo?: boolean;
  /** o rótulo maior (a identificação da NFS-e e os três valores do total): em pt */
  rotuloTam?: number;
}
interface OpcoesDaLinha {
  /** o título do bloco (7 pt negrito, com o fundo cinza), na primeira coluna */
  titulo?: string;
  /** altura mínima (cm) */
  minimo: number;
  /** a linha da identificação: rótulos de 7 pt em caixa alta */
  identificacao?: boolean;
}

export async function desenharDanfse(d: nfse.DadosDaDanfse): Promise<Uint8Array> {
  const [{ PDFDocument, StandardFonts, rgb }, qr] = await Promise.all([import('pdf-lib'), import('qrcode')]);
  const doc = await PDFDocument.create();
  doc.setTitle('DANFSe ' + d.numeroNfse);
  doc.setSubject('Documento Auxiliar da NFS-e');
  doc.setProducer('nads');
  const pagina = doc.addPage([A4.l, A4.a]);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(LOGO_NFSE_PNG_BASE64);

  const preto = rgb(0, 0, 0);
  const cinza = rgb(0.95, 0.95, 0.95);
  const vermelho = rgb(0.93, 0.11, 0.14);

  // texto que o Helvetica (WinAnsi) não sabe escrever vira "?", em vez de derrubar o PDF
  const aceitos = new Set(fonte.getCharacterSet());
  const limpo = (t: string) => Array.from(t.replace(new RegExp('[   ]', 'g'), ' ')).map(c => (aceitos.has(c.codePointAt(0) as number) ? c : '?')).join('');

  /** y em pt de cima da página → y do PDF */
  const py = (yPt: number) => A4.a - yPt;
  const x = (cm: number) => cm * CM;

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

  /** escreve o texto com a linha de base a yPt (pt, de cima da página) */
  function texto(t: string, xPt: number, yPt: number, f: PDFFont, tam: number, cor: RGB = preto) {
    pagina.drawText(limpo(t), { x: xPt, y: py(yPt), font: f, size: tam, color: cor });
  }
  const largura = (t: string, f: PDFFont, tam: number) => f.widthOfTextAtSize(limpo(t), tam);

  function retangulo(xCm: number, yPt: number, wCm: number, hPt: number, cor: RGB) {
    pagina.drawRectangle({ x: x(xCm), y: py(yPt + hPt), width: wCm * CM, height: hPt, color: cor });
  }

  /** a linha divisória de 0,5 pt, de uma borda à outra da moldura */
  function divisoria(yPt: number) {
    pagina.drawLine({ start: { x: x(MOLDURA), y: py(yPt) }, end: { x: A4.l - x(MOLDURA), y: py(yPt) }, thickness: 0.5, color: preto });
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // o cabeçalho (X 0,30 / Y 0,30 cm, 20,40 x 1,16): o fundo cinza, a logomarca, o título e o município com os ambientes
  // ---------------------------------------------------------------------------------------------------------------------
  const topoDoCabecalho = 0.3 * CM;
  const alturaDoCabecalho = 1.16 * CM;
  retangulo(X_INICIAL, topoDoCabecalho, X_FINAL - X_INICIAL, alturaDoCabecalho, cinza);
  const larguraLogo = 4 * CM;
  const alturaLogo = larguraLogo * LOGO_NFSE_PROPORCAO;
  pagina.drawImage(logo, { x: x(0.49), y: py(0.44 * CM + alturaLogo), width: larguraLogo, height: alturaLogo });

  const homologacao = d.tipoAmbiente === '2';
  const centroX = x(5.41 + 10.19 / 2);
  const centrar = (t: string, yPt: number, cor: RGB = preto) => texto(t, centroX - largura(t, negrito, 9) / 2, yPt, negrito, 9, cor);
  if (homologacao) {
    centrar('DANFSe v2.0', topoDoCabecalho + 9.5);
    centrar('Documento Auxiliar da NFS-e', topoDoCabecalho + 19.5);
    centrar('NFS-e SEM VALIDADE JURÍDICA', topoDoCabecalho + 29.5, vermelho);
  } else {
    centrar('DANFSe v2.0', topoDoCabecalho + 13.5);
    centrar('Documento Auxiliar da NFS-e', topoDoCabecalho + 26);
  }
  // o município (8 pt) quebra em duas linhas se não couber; os ambientes (6 pt) ficam nas posições da NT (Y 0,97 e 1,22 cm)
  const xDireita = x(COLUNAS[3]) + RESPIRO;
  quebrar('Município: ' + d.municipio, fonte, 8, x(X_FINAL) - RESPIRO - xDireita).slice(0, 2)
    .forEach((l, i) => texto(l, xDireita, topoDoCabecalho + 8.5 + i * 9, fonte, 8));
  texto('Ambiente Gerador: ' + d.ambienteGerador, xDireita, 0.97 * CM + 5.3, fonte, 6);
  texto('Tipo de Ambiente: ' + d.tipoAmbiente, xDireita, 1.22 * CM + 5.3, fonte, 6);

  let y = (0.3 + 1.16) * CM;
  divisoria(y);
  y = 1.48 * CM;

  // ---------------------------------------------------------------------------------------------------------------------
  // uma linha de campos: o rótulo em negrito em cima, o conteúdo embaixo; a altura acompanha o que quebrar
  // ---------------------------------------------------------------------------------------------------------------------
  const larguraDoCampo = (c: Campo) => COLUNAS[c.col + (c.span || 1) - 1] + LARGURA_COLUNA - COLUNAS[c.col];
  function linha(campos: Campo[], o: OpcoesDaLinha): number {
    const medidos = campos.map(c => {
      const tamRotulo = c.rotuloTam ?? (o.identificacao ? 7 : 6);
      const util = larguraDoCampo(c) * CM - RESPIRO - 3;
      const rotulo = c.rotulo ? quebrar(c.rotulo, negrito, tamRotulo, util) : [];
      const valor = quebrar(c.valor, fonte, 7, util);
      const base = o.identificacao ? 7 : 6.2;
      const primeiraDoValor = rotulo.length ? base + (rotulo.length - 1) * tamRotulo * 1.22 + (o.identificacao ? 8.4 : 8.3) : 7.7;
      return { c, tamRotulo, rotulo, valor, base, primeiraDoValor, fim: primeiraDoValor + (valor.length - 1) * 8.3 + 3.3 };
    });
    const util = LARGURA_COLUNA * CM - 2 * RESPIRO;
    const tituloLinhas = o.titulo ? quebrar(o.titulo, negrito, 7, util) : [];
    const alturaDoTitulo = tituloLinhas.length ? 7 + (tituloLinhas.length - 1) * 8.5 + 4 : 0;
    const h = Math.max(o.minimo * CM, alturaDoTitulo, ...medidos.map(m => m.fim));
    if (tituloLinhas.length) {
      retangulo(COLUNAS[0], y, LARGURA_COLUNA, h, cinza);
      tituloLinhas.forEach((t, i) => texto(t, x(COLUNAS[0]) + RESPIRO, y + 7 + i * 8.5, negrito, 7));
    }
    for (const m of medidos) {
      const xc = x(COLUNAS[m.c.col]);
      if (m.c.fundo) retangulo(COLUNAS[m.c.col], y, larguraDoCampo(m.c), h, cinza);
      m.rotulo.forEach((r, i) => texto(r, xc + RESPIRO, y + m.base + i * m.tamRotulo * 1.22, negrito, m.tamRotulo));
      m.valor.forEach((v, i) => texto(v, xc + RESPIRO, y + m.primeiraDoValor + i * 8.3, fonte, 7));
    }
    y += h;
    return h;
  }

  /** a faixa de um bloco que não se aplica ("... NÃO IDENTIFICADO NA NFS-e"): 0,32 cm, texto centrado em negrito */
  function faixa(t: string) {
    divisoria(y);
    texto(t, x(X_INICIAL + (X_FINAL - X_INICIAL) / 2) - largura(t, negrito, 7) / 2, y + 6.7, negrito, 7);
    y += 0.32 * CM;
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // os dados da NFS-e (Y 1,48 cm): a chave, o número, as datas, a DPS, o emitente; à direita, o QR code
  // ---------------------------------------------------------------------------------------------------------------------
  const topoDosDados = y;
  linha([{ col: 0, span: 3, rotulo: 'CHAVE DE ACESSO DA NFS-E', valor: d.chave }], { minimo: 0.79, identificacao: true });
  linha([
    { col: 0, rotulo: 'NÚMERO DA NFS-E', valor: d.numeroNfse }, { col: 1, rotulo: 'COMPETÊNCIA DA NFS-E', valor: d.competencia },
    { col: 2, rotulo: 'DATA E HORA DA EMISSÃO DA NFS-E', valor: d.emitidaEm },
  ], { minimo: 0.69, identificacao: true });
  linha([
    { col: 0, rotulo: 'NÚMERO DA DPS', valor: d.numeroDps }, { col: 1, rotulo: 'SÉRIE DA DPS', valor: d.serieDps },
    { col: 2, rotulo: 'DATA E HORA DA EMISSÃO DA DPS', valor: d.dpsEmitidaEm },
  ], { minimo: 0.69, identificacao: true });
  linha([
    { col: 0, rotulo: 'EMITENTE DA NFS-E', valor: d.emitente, fundo: true }, { col: 1, rotulo: 'SITUAÇÃO DA NFS-E', valor: d.situacao },
    { col: 2, rotulo: 'FINALIDADE', valor: d.finalidade },
  ], { minimo: 0.69, identificacao: true });
  y = Math.max(y, topoDosDados + 2.86 * CM);

  // o QR code (1,52 x 1,52 cm em X 17,48 / Y 1,67 cm): a consulta pública com a chave de acesso
  const matriz = (qr.default ?? qr).create(d.urlDeConsulta, { errorCorrectionLevel: 'M' }).modules;
  const lado = 1.52 * CM;
  const modulo = lado / matriz.size;
  for (let r = 0; r < matriz.size; r++) for (let c = 0; c < matriz.size; c++) {
    if (matriz.get(r, c)) pagina.drawRectangle({ x: x(17.48) + c * modulo, y: py(1.67 * CM + (r + 1) * modulo), width: modulo + 0.05, height: modulo + 0.05, color: preto });
  }
  // o texto embaixo do QR (X 15,80 / Y 3,36 cm, 4,72 cm de largura, 6 pt)
  quebrar('A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e', fonte, 6, 4.72 * CM - 2)
    .forEach((t, i) => texto(t, x(15.8), 3.36 * CM + 5.4 + i * 6.8, fonte, 6));

  // ---------------------------------------------------------------------------------------------------------------------
  // o prestador e o tomador
  // ---------------------------------------------------------------------------------------------------------------------
  const pessoa = (titulo: string, q: nfse.PessoaDanfse) => {
    divisoria(y);
    linha([{ col: 1, rotulo: 'CNPJ / CPF / NIF', valor: q.documento }, { col: 2, rotulo: 'Indicador Municipal (Inscrição)', valor: q.inscricaoMunicipal }, { col: 3, rotulo: 'Telefone', valor: q.fone }], { titulo, minimo: 0.65 });
    linha([{ col: 0, span: 2, rotulo: 'Nome / Nome Empresarial', valor: q.nome }, { col: 2, rotulo: 'Município / Sigla UF', valor: q.municipio }, { col: 3, rotulo: 'Código IBGE / CEP', valor: q.ibgeCep }], { minimo: 0.65 });
    linha([{ col: 0, span: 2, rotulo: 'Endereço', valor: q.endereco }, { col: 2, span: 2, rotulo: 'E-mail', valor: q.email }], { minimo: 0.65 });
  };
  const p = d.prestador;
  pessoa('PRESTADOR / FORNECEDOR', p);
  linha([{ col: 0, rotulo: 'Simples Nacional na Data de Competência', valor: p.simples }, { col: 1, span: 3, rotulo: 'Regime de Apuração Tributária pelo SN', valor: p.regimeApuracao }], { minimo: 0.65 });

  // sem tomador na nota, a NT manda só a faixa (2.3.1); o destinatário e o intermediário a DANFSe não lê da nota: faixa
  const tomadorVazio = d.tomador.nome === nfse.SEM_VALOR && d.tomador.documento === nfse.SEM_VALOR;
  if (tomadorVazio) faixa('TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e'); else pessoa('TOMADOR / ADQUIRENTE', d.tomador);
  faixa('DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e');
  faixa('INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e');

  // ---------------------------------------------------------------------------------------------------------------------
  // o serviço prestado (a descrição do código e a do serviço, quanto couber antes do canhoto)
  // ---------------------------------------------------------------------------------------------------------------------
  const s = d.servico;
  divisoria(y);
  linha([{ col: 1, rotulo: 'Código de Tributação Nacional / Municipal', valor: s.codigoTributacao }, { col: 2, rotulo: 'Código da NBS', valor: s.nbs }, { col: 3, rotulo: 'Local da Prestação / Sigla UF / País', valor: s.local }], { titulo: 'SERVIÇO PRESTADO', minimo: 0.65 });
  linha([{ col: 0, span: 4, rotulo: '', valor: s.descricaoDoCodigo }], { minimo: 0.4 });
  linha([{ col: 0, span: 4, rotulo: 'Descrição do Serviço', valor: s.descricao }], { minimo: 0.64 });

  const m = d.municipal;
  divisoria(y);
  linha([{ col: 1, rotulo: 'Tipo de Tributação do ISSQN', valor: m.tributacao }, { col: 2, span: 2, rotulo: 'Município / Sigla UF / País de Incidência do ISSQN', valor: m.incidencia }], { titulo: 'TRIBUTAÇÃO MUNICIPAL (ISSQN)', minimo: 0.65 });
  linha([{ col: 0, rotulo: 'Regime Especial de Tributação do ISSQN', valor: m.regimeEspecial }, { col: 1, rotulo: 'Tipo de Imunidade do ISSQN', valor: m.imunidade }, { col: 2, rotulo: 'Suspensão da Exigibilidade do ISSQN', valor: m.suspensao }, { col: 3, rotulo: 'Número Processo Suspensão', valor: m.processoSuspensao }], { minimo: 0.65 });
  linha([{ col: 0, rotulo: 'Benefício Municipal', valor: m.beneficio }, { col: 1, rotulo: 'Cálculo do BM', valor: m.calculoBm }, { col: 2, rotulo: 'Total Deduções/Reduções', valor: m.deducoes }, { col: 3, rotulo: 'Desconto Incondicionado', valor: m.descontoIncondicionado }], { minimo: 0.65 });
  linha([{ col: 0, rotulo: 'BC ISSQN', valor: m.baseDeCalculo }, { col: 1, rotulo: 'Alíquota Aplicada', valor: m.aliquota }, { col: 2, rotulo: 'Retenção do ISSQN', valor: m.retencao }, { col: 3, rotulo: 'ISSQN Apurado', valor: m.issqn }], { minimo: 0.65 });

  const f = d.federal;
  divisoria(y);
  linha([{ col: 1, rotulo: 'IRRF', valor: f.irrf }, { col: 2, rotulo: 'Contribuição Previdenciária - Retido', valor: f.previdencia }, { col: 3, rotulo: 'Contribuições Sociais - Retidas', valor: f.sociais }], { titulo: 'TRIBUTAÇÃO FEDERAL (EXCETO CBS)', minimo: 0.65 });
  linha([{ col: 0, rotulo: 'PIS - Débito Apuração Própria', valor: f.pis }, { col: 1, rotulo: 'COFINS - Débito Apuração Própria', valor: f.cofins }, { col: 2, span: 2, rotulo: 'Descrição Contrib. Sociais - Retidas', valor: f.descricaoSociais }], { minimo: 0.65 });

  const i = d.ibsCbs;
  divisoria(y);
  linha([{ col: 1, rotulo: 'CST / cClassTrib', valor: i.cst }, { col: 2, span: 2, rotulo: 'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', valor: i.operacao }], { titulo: 'TRIBUTAÇÃO IBS / CBS', minimo: 0.65 });
  linha([{ col: 0, rotulo: 'Exclusões e Reduções da Base de Cálculo', valor: i.exclusoes }, { col: 1, rotulo: 'Base de Cálculo Após Exclusões e Reduções', valor: i.baseAposExclusoes }, { col: 2, rotulo: 'Red. Alíquota IBS / Red. Alíquota CBS', valor: i.reducao }, { col: 3, rotulo: 'Alíquota - IBS UF / IBS Mun', valor: i.aliquotaIbs }], { minimo: 0.65 });
  linha([{ col: 0, rotulo: 'Alíq. Efetiva Municipal - IBS', valor: i.efetivaMunicipal }, { col: 1, rotulo: 'Valor Apurado Municipal - IBS', valor: i.apuradoMunicipal }, { col: 2, rotulo: 'Alíq. Efetiva Estadual - IBS', valor: i.efetivaEstadual }, { col: 3, rotulo: 'Valor Apurado Estadual - IBS', valor: i.apuradoEstadual }], { minimo: 0.65 });
  linha([{ col: 0, rotulo: 'Valor Total Apurado - IBS', valor: i.totalIbs }, { col: 1, rotulo: 'Alíquota - CBS', valor: i.aliquotaCbs }, { col: 2, rotulo: 'Alíquota Efetiva - CBS', valor: i.efetivaCbs }, { col: 3, rotulo: 'Valor Total Apurado - CBS', valor: i.apuradoCbs }], { minimo: 0.65 });

  const t = d.totais;
  divisoria(y);
  linha([{ col: 1, rotulo: 'VALOR DA OPERAÇÃO / SERVIÇO', valor: t.valorServico, rotuloTam: 7 }, { col: 2, rotulo: 'Desconto Incondicionado', valor: t.descontoIncondicionado }, { col: 3, rotulo: 'Desconto Condicionado', valor: t.descontoCondicionado }], { titulo: 'VALOR TOTAL DA NFS-E', minimo: 0.69 });
  linha([{ col: 0, rotulo: 'Total das Retenções (ISSQN / Federais)', valor: t.retencoes }, { col: 1, rotulo: 'VALOR LÍQUIDO da NFS-e', valor: t.liquido, rotuloTam: 7 }, { col: 2, rotulo: 'Total do IBS/CBS', valor: t.ibsCbs }, { col: 3, rotulo: 'VALOR LÍQUIDO da NFS-e + IBS/CBS', valor: t.liquidoComIbsCbs, fundo: true, rotuloTam: 7 }], { minimo: 0.69 });

  // ---------------------------------------------------------------------------------------------------------------------
  // as informações complementares: ocupam o que sobra até o canhoto; o que não couber termina em reticências
  // ---------------------------------------------------------------------------------------------------------------------
  divisoria(y);
  texto('INFORMAÇÕES COMPLEMENTARES', x(X_INICIAL) + RESPIRO, y + 8, negrito, 7);
  y += 0.39 * CM;
  const linhasDeInfo = quebrar(d.informacoes, fonte, 7, (X_FINAL - X_INICIAL) * CM - 2 * RESPIRO);
  const cabem = Math.max(1, Math.floor((Y_CANHOTO * CM - 4 - (y + 6)) / 8.3));
  const mostradas = linhasDeInfo.length > cabem ? [...linhasDeInfo.slice(0, cabem - 1), linhasDeInfo[cabem - 1].replace(/\s*\S*$/, '') + '...'] : linhasDeInfo;
  mostradas.forEach((l, k) => texto(l, x(X_INICIAL) + RESPIRO, y + 9 + k * 8.3, fonte, 7));

  // ---------------------------------------------------------------------------------------------------------------------
  // o canhoto (Y 28,10 cm, 0,67 cm): data de cientificação, identificação e assinatura, e a nota com a chave
  // ---------------------------------------------------------------------------------------------------------------------
  const yCanhoto = Y_CANHOTO * CM;
  divisoria(yCanhoto);
  pagina.drawRectangle({ x: x(X_INICIAL), y: py(yCanhoto + ALTURA_CANHOTO * CM), width: (X_FINAL - X_INICIAL) * CM, height: ALTURA_CANHOTO * CM, borderColor: preto, borderWidth: 0.5 });
  for (const c of [COLUNAS[1], COLUNAS[2]]) {
    pagina.drawLine({ start: { x: x(c - 0.1), y: py(yCanhoto) }, end: { x: x(c - 0.1), y: py(yCanhoto + ALTURA_CANHOTO * CM) }, thickness: 0.5, color: preto });
  }
  texto('DATA CIENTIFICAÇÃO', x(COLUNAS[0]) + RESPIRO, yCanhoto + 8, negrito, 7);
  texto('IDENTIFICAÇÃO E ASSINATURA', x(COLUNAS[1]) + RESPIRO, yCanhoto + 8, negrito, 7);
  texto('Nº NFS-E / CHAVE NFS-E', x(COLUNAS[2]) + RESPIRO, yCanhoto + 8, negrito, 7);
  quebrar(d.numeroNfse + ' / ' + d.chave, fonte, 7, 10.19 * CM - 2 * RESPIRO).slice(0, 1)
    .forEach(l => texto(l, x(COLUNAS[2]) + RESPIRO, yCanhoto + 16.4, fonte, 7));

  // a moldura da página: 1 pt de espessura
  pagina.drawRectangle({ x: x(MOLDURA), y: x(MOLDURA), width: A4.l - 2 * x(MOLDURA), height: A4.a - 2 * x(MOLDURA), borderColor: preto, borderWidth: 1 });
  return doc.save();
}
