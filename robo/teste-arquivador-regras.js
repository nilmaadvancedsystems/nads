// Testes do arquivador novo (arquivador-regras.js e as partes puras do arquivador-novo.js).
// Rode:  node teste-arquivador-regras.js     (não lê o Drive, não lê o banco; o disco só numa pasta temporária)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const R = require('./arquivador-regras');
const A = require('./arquivador-novo');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

// ---------- cadastro de mentira (CNPJs com dígito verificador certo) ----------
const LINHAS = [
  { codigo: 1, razao: 'Empresa EXEMPLO', doc: '36.462.778/0001-60', regime: '' },
  { codigo: 152, razao: 'JANIO JOSE DE ALMEIDA', doc: '06.934.601/0001-58', regime: 'Simples' },
  { codigo: 358, razao: 'MITRA TRANSPORTE E SERVICOS LTDA', doc: '22.633.579/0001-62', regime: 'Presumido' },
  { codigo: 359, razao: 'MITRA TRANSPORTE E SERVICOS LTDA - FILIAL', doc: '22.633.579/0002-43', regime: 'Presumido' },
  { codigo: 380, razao: 'LEONARDO MENDES MARQUES', doc: '11.426.314/0001-77', regime: 'Presumido' },
  { codigo: 421, razao: 'DFARMA FARMACIA DE MANIPULACAO LTDA', doc: '11.536.337/0001-70', regime: 'Simples' },
  { codigo: 284, razao: 'NILMA CONTABILIDADE LTDA', doc: '27.872.981/0001-13', regime: 'Simples' },
  { codigo: 66, razao: 'ADERLEI DOS SANTOS E CIA LTDA', doc: '03.149.551/0001-00', regime: 'Presumido' },
  { codigo: 475, razao: 'ADERLEI DOS SANTOS', doc: '627.521.706-53', regime: 'Física' },
  { codigo: 500, razao: 'FULANO MEI', doc: '11.222.333/0001-81', regime: 'MEI' },
  { codigo: 600, razao: 'SEM PASTA COMERCIO LTDA', doc: '45.997.418/0001-53', regime: 'Real' },
];
const PASTAS = ['152 - JANIO JOSE DE ALMEIDA', '358 - MITRA TRANSPORTE E SERVICOS LTDA', '380 - LEONARDO MENDES MARQUES', '421 - D´FARMA FARMACIA DE MANIPULACAO LTDA', '284 - NILMA CONTABILIDADE LTDA', '66 - ADERLEI SANTOS E CIA', '500 - FULANO MEI'];
const cad = R.montarCadastro(LINHAS, PASTAS);
const ctx = { cadastro: cad, hoje: new Date(2026, 9, 20) };
const decidir = e => R.decidir(Object.assign({ rel: e.nome }, e), ctx);

// ---------- 1. texto, datas, valores ----------
igual('fornecedor: sufixo e pontuação saem, acento fica (Dicionário §5.2)', R.nomeNormalizado('Mitra Transporte e Serviços Ltda - ME'), 'MITRA TRANSPORTE E SERVIÇOS');
igual('fornecedor: pontuação interna vira espaço', R.nomeNormalizado('FITO IND. E COM. DE ALIMENTOS LTDA'), 'FITO IND E COM DE ALIMENTOS');
igual('data: pula "07.16.26283" e acha a data de verdade', R.dataBr('07.16.26283.1412893-9 PAGAR ATE 20/10/2026'), '20-10-2026');
igual('data: datas coladas pelo PDF', R.dataBr('30/04/202523/05/2025'), '30-04-2025');
igual('valor: sem separador de milhar (Dicionário §2)', R.valorBr('VALOR TOTAL 15.869,95'), 'R$15869,95');
igual('competência colada ("setembro/202620/10/2026")', R.competenciaSolta('setembro/202620/10/2026'), { mes: 9, ano: 2026 });
igual('competência: "20/10/2026" não vira 10/2026', R.competenciaSolta('vence 20/10/2026'), null);
igual('competência pelo nome: 012026', R.competenciaDoNome('Sicoob _ Internet banking 012026.pdf'), { mes: 1, ano: 2026 });
igual('competência pelo nome: "brasil setembro 01-09-2026" pega o mês por extenso? não: 09-2026', R.competenciaDoNome('ArqEFD-x-07.2026.txt'), { mes: 7, ano: 2026 });
igual('competência pela pasta do mês', R.competenciaDaPasta('2026-09\\TEOBALDO\\x.xml'), { mes: 9, ano: 2026 });

// ---------- 2. CNPJ/CPF ----------
igual('CNPJ válido', R.cnpjValido('06934601000158'), true);
igual('CNPJ inválido', R.cnpjValido('06934601000159'), false);
igual('documentos do texto: formatado, 14 soltos, CPF formatado; 11 soltos não', R.documentosDoTexto('CNPJ 06.934.601/0001-58 e 11426314000177 tel 62752170653 cpf 627.521.706-53').map(d => d.doc), ['06934601000158', '11426314000177', '62752170653']);
igual('CNPJ com zero à frente (Bradesco "053.997.059/0001-62")', R.documentosDoTexto('PAGADOR 053.997.059/0001-62').map(d => d.doc), ['53997059000162']);
igual('raiz impressa sozinha (FGTS Digital)', R.raizesDoTexto('CPF/CNPJ do Empregador\n11.536.337\n'), ['11536337']);
igual('escritório nunca é cliente (03)', R.clientesDoDoc('27872981000113', cad), []);
igual('linha 1 da planilha (Empresa EXEMPLO) fica fora', cad.porCod.has(1), false);
igual('regime: Física → PESSOA FISICA (Dicionário §2.1)', cad.porCod.get(475).regime, 'PESSOA FISICA');
igual('regime fora da tabela = undefined (VOCABULARIO_AUSENTE)', R.regimeCanonico('Simples Hibrido'), undefined);
igual('nome: "&" = "E" e o nome mais longo vence', R.clientesPeloNomeNoTexto('Nome Cliente: ADERLEI DOS SANTOS & CIA LTDA', cad), [66]);
igual('nome: o escritório não identifica pelo nome', R.clientesPeloNomeNoTexto('PIX ENVIADO NILMA CONTABILIDADE LTDA', cad), []);
igual('nome: número colado no nome (BB "3273-5DORNAS")', R.clientesPeloNomeNoTexto('Conta corrente3273-5LEONARDO MENDES MARQUES', cad), [380]);
igual('cliente pela pasta "SIEG 2026-09 - <nome>.zip"', R.clienteDaPasta('SIEG 2026-09 - LEONARDO MENDES MARQUES.zip\\a.xml', cad), { codigo: 380, como: 'nome da pasta "SIEG 2026-09 - LEONARDO MENDES MARQUES.zip"' });

// ---------- 3. XML (porte do xml_lote.py) ----------
const nfe = (emit, dest, n, data, mod) => '<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="x"><ide><mod>' + (mod || 55) + '</mod><nNF>' + n + '</nNF><dhEmi>' + data + '</dhEmi></ide><emit><CNPJ>' + emit + '</CNPJ><xNome>EMITENTE &amp; CIA</xNome></emit><dest><CNPJ>' + dest + '</CNPJ></dest></infNFe></NFe></nfeProc>';
let d = decidir({ nome: '3126.xml', xml: nfe('11426314000177', '99999999000191', '000007261', '2026-08-05T10:00:00-03:00') });
igual('NF-e emitida pelo 380: XML\\NF-e do Presumido (05b 14. XML)', [d.acao, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', '380 - LEONARDO MENDES MARQUES\\FISCAL\\LUCRO PRESUMIDO\\14. XML\\NF-e', '08-2026_NF-e_7261.xml']);
d = decidir({ nome: 'a.xml', xml: nfe('11426314000177', '06934601000158', '9', '2026-08-05T10:00:00-03:00') });
igual('NF-e entre dois clientes sem pasta que desempate: CLIENTE_AMBIGUO', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'CLIENTE_AMBIGUO']);
d = R.decidir({ nome: 'a.xml', rel: '2026-08\\JANIO JOSE DE ALMEIDA\\a.xml', xml: nfe('11426314000177', '06934601000158', '9', '2026-08-05T10:00:00-03:00') }, ctx);
igual('... a pasta de origem desempata (xml_lote: subpasta+documento)', [d.acao, d.cliente], ['ARQUIVAR', 152]);
d = decidir({ nome: 'c.xml', xml: nfe('11426314000177', '99999999000191', '30644', '2026-08-01T10:00:00-03:00', 65) });
igual('NFC-e: pasta XML\\NFC-e', d.destinoRelativo + '\\' + d.nomeFinal, '380 - LEONARDO MENDES MARQUES\\FISCAL\\LUCRO PRESUMIDO\\14. XML\\NFC-e\\08-2026_NFC-e_30644.xml');
const evento = '<procEventoNFe><evento><infEvento><CNPJ>11426314000177</CNPJ><chNFe>31260811426314000177550010000101431439862028</chNFe><dhEvento>2026-09-01T10:00:00-03:00</dhEvento><detEvento><descEvento>Cancelamento</descEvento></detEvento></infEvento></evento></procEventoNFe>';
d = decidir({ nome: 'x-caneve.xml', xml: evento });
igual('evento de NF-e: EVENTOS, nº da chave (05d §1b)', [d.destinoRelativo, d.nomeFinal], ['380 - LEONARDO MENDES MARQUES\\FISCAL\\LUCRO PRESUMIDO\\14. XML\\NF-e\\EVENTOS', '01-09-2026 - CANCELAMENTO NF-e 10143.xml']);
const nfse = '<CompNfse><Nfse><InfNfse><Numero>752217</Numero><DataEmissao>2026-09-10T00:00:00</DataEmissao><PrestadorServico><IdentificacaoPrestador><CpfCnpj><Cnpj>06934601000158</Cnpj></CpfCnpj></IdentificacaoPrestador></PrestadorServico></InfNfse></Nfse></CompNfse>';
d = decidir({ nome: 'nfse.xml', xml: nfse });
igual('NFS-e ABRASF do Simples: 12. XML\\NFS-e', d.destinoRelativo + '\\' + d.nomeFinal, '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NFS-e\\09-2026_NFS-e_752217.xml');
igual('nome de pasta com 0026/0027 (& e apóstrofo gravados pelo robô do Gmail)', R.chaveNome('ANTONIA0027S 0026 CIA'), R.chaveNome("ANTONIA'S & CIA"));
d = decidir({ nome: 'm.xml', xml: nfe('11426314000258', '99999999000191', '1', '2026-08-05T10:00:00-03:00') });
igual('XML de outro estabelecimento da mesma raiz: CLIENTE_AMBIGUO (03)', d.motivo, 'CLIENTE_AMBIGUO');
igual('XML quebrado: NAO_IDENTIFICADO/CONTEUDO_ILEGIVEL', decidir({ nome: 'q.xml', xml: '<a><b></a>' }).motivo, 'CONTEUDO_ILEGIVEL');
d = decidir({ nome: 'mei.xml', xml: nfe('11222333000181', '99999999000191', '5', '2026-08-05T10:00:00-03:00') });
igual('cliente MEI no fiscal: FICA na origem (05: sem especialista)', [d.acao, d.motivo], ['FICA', 'REGIME_SEM_ESPECIALISTA']);
d = decidir({ nome: 'sem.xml', xml: nfe('45997418000153', '99999999000191', '5', '2026-08-05T10:00:00-03:00') });
igual('cliente sem pasta, identificado pelo CNPJ: cria a raiz com a razão da planilha (03 regra 2)', [d.acao, d.criarPastaCliente, d.pastaCliente], ['ARQUIVAR', true, '600 - SEM PASTA COMERCIO LTDA']);

// ---------- 4. PDFs (texto como o pdf.js entrega) ----------
const DARF = 'Documento de Arrecadação\nde Receitas Federais\n06.934.601/0001-58\nJANIO JOSE DE ALMEIDA\nPeríodo de ApuraçãoData de VencimentoNúmero do Documento\n07.16.26283.1412914-5\nPagar este documento até\n20/10/2026\nValor Total do Documento\n286,00\nsetembro/202620/10/2026\nComposição do Documento de Arrecadação\n1099CP DESCONTADA SEGURADO - CONTRIB INDIVIDUAL\nPA:09/2026 Vencimento:20/10/2026';
d = decidir({ nome: 'GuiaPagamento_06934601000158_092026_1.pdf', texto: [DARF] });
igual('DARF de DCTFWeb no Simples: 16. DARF, INSS (05a, 05d §4)', [d.acao, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\16. DARF', '09-2026 - DARF INSS - VALOR R$286,00 - VENCIMENTO 20-10-2026.pdf']);
const COMP_ARREC = 'Data de Vencimento\n22.633.579/0001-62MITRA TRANSPORTE E SERVICOS LTDA\n30/04/202523/05/202507162514159199681\nComprovamos que consta nos sistemas da Receita Federal registro de arrecadação de DARF com os dados a seguir:\nComprovante de Arrecadação\nComposição do Documento de Arrecadação\n2172COFINS - Contribuição15.869,95--15.869,95\nTotais\n15.869,950,000,0015.869,95';
d = decidir({ nome: 'MITRA.pdf', texto: [COMP_ARREC] });
igual('comprovante de arrecadação de DARF no Presumido: 05. DARF, COFINS', [d.destinoRelativo, d.nomeFinal], ['358 - MITRA TRANSPORTE E SERVICOS LTDA\\FISCAL\\LUCRO PRESUMIDO\\05. DARF', '04-2025 - DARF COFINS - VALOR R$15869,95 - VENCIMENTO 23-05-2025.pdf']);
const FGTS = 'CPF/CNPJ do Empregador\n11.536.337\nNome/Razão Social do Empregador\nDFARMA FARMACIA DE MANIPULACAO LTDA\nTag\n11536337 09/2026 MENSAL\n Pagar este documento até\n20/10/2026\nGFD - Guia do FGTS Digital';
d = decidir({ nome: '0126101366580513-0.pdf', texto: [FGTS] });
igual('FGTS Digital: SOCIETÁRIO\\IMPOSTOS\\FGTS\\[ANO]\\[MÊS E ANO].pdf (04b)', [d.destinoRelativo, d.nomeFinal], ['421 - D´FARMA FARMACIA DE MANIPULACAO LTDA\\SOCIETÁRIO\\IMPOSTOS\\FGTS\\2026', '09-2026.pdf']);
const COMP = 'SICOOB - SISTEMA DE COOPERATIVAS DE CRÉDITO DO BRASIL\n26/08/2026\nCOMPROVANTE DE\nPAGAMENTO DE BOLETO\nConta:15.062-2\nCliente:LEONARDO MENDES MARQUES\nBeneficiário:\nNome/Razão Social:TC PNEUS LTDA\nCPF/CNPJ:05.201.107/0001-11\nPagador:\nCPF/CNPJ:11.426.314/0001-77\nDatas:\nRealizado:06/02/2026 às 09:19:36\nPagamento:06/02/2026';
d = decidir({ nome: '022026.pdf', texto: [COMP] });
igual('comprovante Sicoob ("COMPROVANTE DE\\nPAGAMENTO"): COMPROVANTES\\SICOOB, mês do pagamento', [d.acao, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', '380 - LEONARDO MENDES MARQUES\\CONTÁBIL\\EXTRATOS\\2026\\02\\COMPROVANTES\\SICOOB', 'Comprovantes 02-2026.pdf']);
const EXT = 'SISTEMA DE COOPERATIVAS DE CRÉDITO DO BRASIL\nPLATAFORMA DE SERVIÇOS FINANCEIROS DO SICOOB - SISBR\nEXTRATO DE CONTA CORRENTE\nConta:15.062-2 / LEONARDO MENDES MARQUES\nPeriodo:01/01/2026 - 31/01/2026\nHISTÓRICO DE MOVIMENTAÇÃO\n30/01PixPIX RECEBIDO - OUTRA IF BANCO BRADESCO';
d = decidir({ nome: 'extrato.pdf', texto: [EXT] });
igual('extrato Sicoob: BANCÁRIOS\\SICOOB\\01-2026.pdf (Bradesco do lançamento não conta)', [d.destinoRelativo, d.nomeFinal], ['380 - LEONARDO MENDES MARQUES\\CONTÁBIL\\EXTRATOS\\2026\\01\\BANCÁRIOS\\SICOOB', '01-2026.pdf']);
const COMP_EXT = 'BANCO DO BRASIL\nCOMPROVANTE DE MOVIMENTACAO\nCLIENTE: LEONARDO MENDES MARQUES\n01/01/2026 SALDO ANTERIOR 10,00\n02/01/2026 PIX 5,00 SALDO 15,00\n03/01/2026 TARIFA 1,00 SALDO 14,00\nPeríodo: 01/01/2026 a 31/01/2026';
d = decidir({ nome: 'bb.pdf', texto: [COMP_EXT] });
igual('"Comprovante" com saldo corrente é extrato (Dicionário §6.1.1)', d.destinoRelativo, '380 - LEONARDO MENDES MARQUES\\CONTÁBIL\\EXTRATOS\\2026\\01\\BANCÁRIOS\\BANCO DO BRASIL');
d = decidir({ nome: 'scan.pdf', texto: [' \n '] });
igual('PDF sem texto: NAO_IDENTIFICADO/CONTEUDO_SEM_TEXTO (E307)', [d.acao, d.motivo, d.codigo], ['NAO_IDENTIFICADO', 'CONTEUDO_SEM_TEXTO', 'E307']);
d = decidir({ nome: 'carta.pdf', texto: ['Prezados, segue a carta de apresentação da empresa LEONARDO MENDES MARQUES para os devidos fins de direito.'] });
igual('PDF sem título conhecido: TIPO_NAO_RECONHECIDO (não adivinha)', [d.acao, d.motivo, d.cliente], ['NAO_IDENTIFICADO', 'TIPO_NAO_RECONHECIDO', 380]);
d = R.decidir({ nome: 'extrato.pdf', rel: '2026-01\\LEONARDO MENDES MARQUES\\extrato.pdf', texto: ['EXTRATO DE CONTA CORRENTE\nSICOOB\nPeriodo:01/01/2026 - 31/01/2026\nsem nome nem CNPJ'] }, ctx);
igual('só a pasta de origem diz o cliente: abaixo do limiar (0.80 < 0.85) → NAO_IDENTIFICADO com sugestão', [d.acao, d.motivo, d.destinoSugerido], ['NAO_IDENTIFICADO', 'CONFIANCA_ABAIXO_DO_LIMIAR', '380 - LEONARDO MENDES MARQUES\\CONTÁBIL\\EXTRATOS\\2026\\01\\BANCÁRIOS\\SICOOB\\01-2026.pdf']);
const DAS2 = 'Documento de Arrecadação do Simples Nacional\nCNPJ 11.426.314/0001-77 LEONARDO MENDES MARQUES\nPeríodo de Apuração Setembro/2026\nPagar este documento até 20/10/2026\nValor Total do Documento 1.234,56';
igual('DAS em cliente do Presumido: TIPO_INCOMPATIVEL_COM_REGIME (05b)', decidir({ nome: 'das.pdf', texto: [DAS2] }).motivo, 'TIPO_INCOMPATIVEL_COM_REGIME');
const DAS = DAS2.replace('11.426.314/0001-77 LEONARDO MENDES MARQUES', '06.934.601/0001-58 JANIO JOSE DE ALMEIDA');
d = decidir({ nome: 'das.pdf', texto: [DAS] });
igual('DAS no Simples: 01. DAS\\[MÊS E ANO].pdf (05a)', d.destinoRelativo + '\\' + d.nomeFinal, '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\01. DAS\\09-2026.pdf');
d = decidir({ nome: 'das3.pdf', texto: [DAS, DAS.replace('Setembro/2026', 'Agosto/2026').replace('20/10/2026', '20/09/2026'), DAS] });
igual('PDF com várias guias de vencimentos diferentes: FICA (PDF_COMPOSTO_NAO_SEPARADO)', [d.acao, d.motivo], ['FICA', 'PDF_COMPOSTO_NAO_SEPARADO']);

const EXT_SICOOB2 = 'SICOOB\nEXTRATO CONTA CORRENTE\nCONTA: 93.306-6 / LEONARDO MENDES MARQUES\nPERÍODO: 01/07/2026 - 31/07/2026\n07/07PIX EMIT.OUTRA IF33.000,00D\nPagamento Pix\n627.521.706-53';
d = decidir({ nome: 'SICOOB 072026.pdf', texto: [EXT_SICOOB2] });
igual('extrato: titular "CONTA: n / NOME"; CPF de lançamento não é o cliente', [d.acao, d.cliente], ['ARQUIVAR', 380]);
d = decidir({ nome: 'EXTRATO ITAU - LEONARDO (JULHO 2026).pdf', texto: ['EXTRATO DE CONTA\nSANTANDER CONSORCIO\nLEONARDO MENDES MARQUES 11.426.314/0001-77\nPeríodo: 01/07/2026 a 31/07/2026\nITAU UNIBANCO'] });
igual('banco: o do nome do arquivo, quando também está no texto', d.destinoRelativo, '380 - LEONARDO MENDES MARQUES\\CONTÁBIL\\EXTRATOS\\2026\\07\\BANCÁRIOS\\ITAU');
d = decidir({ nome: 'EXTRATO BNB 072026.pdf', texto: ['EXTRATO DE CONTA\nBRADESCO\nLEONARDO MENDES MARQUES 11.426.314/0001-77\nPeríodo: 01/07/2026 a 31/07/2026'] });
igual('banco: nome do arquivo × conteúdo sem o banco do nome → BANCO_DIVERGENTE', d.motivo, 'BANCO_DIVERGENTE');
d = decidir({ nome: 'dirf.pdf', texto: ['Sistema Dirf - Fontes Pagadoras - Informações apresentadas para o ano-calendário 2025\nA7\n11.426.314/0001-77 LEONARDO MENDES MARQUES'] });
igual('DIRF: 17. DIRF\\[ANO-CALENDÁRIO] - DIRF.pdf (05b)', d.destinoRelativo + '\\' + d.nomeFinal, '380 - LEONARDO MENDES MARQUES\\FISCAL\\LUCRO PRESUMIDO\\17. DIRF\\2025 - DIRF.pdf');

// ---------- 5. outros formatos ----------
const sped = '|0000|017|0|01082026|31082026|LEONARDO MENDES MARQUES|11426314000177||MG|123|\n|0001|0|';
d = decidir({ nome: 'ArqEFD.txt', txt: sped });
igual('SPED Fiscal pelo registro 0000 (05b 01. SPED FISCAL)', d.destinoRelativo + '\\' + d.nomeFinal, '380 - LEONARDO MENDES MARQUES\\FISCAL\\LUCRO PRESUMIDO\\01. SPED FISCAL\\08-2026.txt');
const ofx = '<OFX><BANKACCTFROM><BANKID>0237<ACCTID>33229</BANKACCTFROM><BANKTRANLIST><DTSTART>20260801<DTEND>20260831</BANKTRANLIST></OFX>';
const cad2 = R.montarCadastro(LINHAS.concat({ codigo: 591, razao: 'ZELO AGROINDUSTRIAS LTDA', doc: '53.636.418/0001-56', regime: 'Simples' }), PASTAS.concat('591 - ZELO'));
d = R.decidir({ nome: 'x.ofx', rel: 'x.ofx', ofx }, { cadastro: cad2 });
igual('OFX: conta confirmada no 03 (Bradesco 33229 → 591), sempre Bancários com .ofx', d.destinoRelativo + '\\' + d.nomeFinal, '591 - ZELO\\CONTÁBIL\\EXTRATOS\\2026\\08\\BANCÁRIOS\\BRADESCO\\08-2026.ofx');
igual('certificado .pfx: cliente pelo CNPJ do nome, nome original (04b)', decidir({ nome: 'JANIO_06934601000158.pfx' }).destinoRelativo, '152 - JANIO JOSE DE ALMEIDA\\SOCIETÁRIO\\CERTIFICADO DIGITAL');
igual('vídeo é ignorado (Dicionário §1)', decidir({ nome: 'reuniao.mp4' }).acao, 'IGNORAR');
igual('imagem/Word: sem regra → NAO_IDENTIFICADO', decidir({ nome: 'foto.jpg' }).motivo, 'FORMATO_SEM_REGRA');
d = decidir({ nome: 'vendas.csv', planilha: [['Nome Cliente', 'Data da Transação', 'Bandeira', 'Valor Bruto', 'Valor Taxa', 'Valor Líquido'], ['ADERLEI DOS SANTOS & CIA LTDA', '20/01/2026 16:11', 'Visa', 100, 1, 99], ['ADERLEI DOS SANTOS & CIA LTDA', '21/01/2026 10:00', 'Elo', 50, 1, 49]] });
igual('planilha de maquininha sem título (§6.1.3) sem operadora: BANCO_AUSENTE', [d.tipo, d.motivo], ['MAQUININHAS', 'BANCO_AUSENTE']);
d = decidir({ nome: 'MAQUININHA PAGBANK.csv', planilha: [['Nome Cliente', 'Data da Transação', 'Bandeira', 'Valor Bruto', 'Valor Taxa', 'Valor Líquido'], ['ADERLEI DOS SANTOS & CIA LTDA', '20/01/2026 16:11', 'Visa', 100, 1, 99], ['ADERLEI DOS SANTOS & CIA LTDA', '21/01/2026 10:00', 'Elo', 50, 1, 49]] });
igual('... com a operadora no nome do arquivo: MAQUININHAS\\PAGBANK (abaixo do limiar? não: 0.88)', [d.acao, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', '66 - ADERLEI SANTOS E CIA\\CONTÁBIL\\EXTRATOS\\2026\\01\\MAQUININHAS\\PAGBANK', '01-2026.csv']);

// ---------- 6. contas bancárias aprendidas (03) ----------
igual('contas do texto: Sicoob, Itaú, Bradesco', R.contasDoTexto('Conta:15.062-2\nag 3110 cc 99699-2\n02557 | 0006310-041.894,89'), ['150622', '996992', '63100']);
const contas = new Map([['BRADESCO:63100', new Map([[380, new Set(['h1'])]])]]);
const EXT_BRAD = 'Extrato de: Ag:  | CC:   01/01/2026  31/01/202625570006310-0| Entree\nAgência | ContaTotal\n02557 | 0006310-041.894,89\nSALDO ANTERIOR\n1,00';
d = R.decidir({ nome: 'e.pdf', rel: 'e.pdf', hash: 'h9', texto: [EXT_BRAD] }, Object.assign({ contas }, ctx));
igual('extrato Bradesco sem nome nem CNPJ: cliente pela conta já arquivada', [d.acao, d.cliente, d.destinoRelativo], ['ARQUIVAR', 380, '380 - LEONARDO MENDES MARQUES\\CONTÁBIL\\EXTRATOS\\2026\\01\\BANCÁRIOS\\BRADESCO']);
d = R.decidir({ nome: 'e.pdf', rel: 'e.pdf', hash: 'h1', texto: [EXT_BRAD] }, Object.assign({ contas }, ctx));
igual('... o próprio arquivo não se reconhece (medição sem vazamento)', d.motivo, 'CLIENTE_NAO_LOCALIZADO');

// ---------- 7. o destino: nunca sobrescreve ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-arqnovo-'));
try {
  const pasta = path.join(tmp, '380 - X', 'A');
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, '01-2026.pdf'), 'conteudo antigo');
  const sha = s => require('crypto').createHash('sha256').update(s).digest('hex');
  const c = { clientes: tmp, manifesto: new Map(), reservados: new Map(), existe: new Map(), hashes: new Map() };
  const dd = { destinoRelativo: '380 - X\\A', nomeFinal: '01-2026.pdf' };
  igual('mesmo nome, outro conteúdo: " (1)" (Dicionário §2)', A.conferirDestino(dd, sha('novo'), c).nomeFinal, '01-2026 (1).pdf');
  igual('o mesmo conteúdo já gravado: JA_ARQUIVADO (não grava de novo)', A.conferirDestino(dd, sha('conteudo antigo'), c).situacao, 'JA_ARQUIVADO');
  igual('dois do lote com o mesmo nome: o segundo vira " (2)"', A.conferirDestino(dd, sha('outro'), c).nomeFinal, '01-2026 (2).pdf');
  igual('o mesmo conteúdo duas vezes no lote: o segundo é JA_ARQUIVADO', A.conferirDestino(dd, sha('novo'), c).situacao, 'JA_ARQUIVADO');
  c.manifesto.set(sha('x'), path.join(pasta, '01-2026.pdf'));
  igual('hash no manifesto da rotina antiga com o arquivo lá: JA_ARQUIVADO', A.conferirDestino(dd, sha('x'), c).situacao, 'JA_ARQUIVADO');
  // varredura: NÃO IDENTIFICADOS, "_" e CLAUDE FAVOR NÃO MEXER ficam de fora (Dicionário §1)
  const orig = path.join(tmp, 'origem');
  for (const p of ['2026-09\\C\\a.xml', 'NÃO IDENTIFICADOS\\x\\b.pdf', '_CONTROLE\\c.pdf', 'CLAUDE FAVOR NÃO MEXER\\d.pdf', 'e.pdf']) { fs.mkdirSync(path.dirname(path.join(orig, p)), { recursive: true }); fs.writeFileSync(path.join(orig, p), 'x'); }
  igual('varredura recursiva com as exclusões', A.varrer(orig, {}), ['2026-09\\C\\a.xml', 'e.pdf']);
  igual('... e com --incluir-nao-identificados', A.varrer(orig, { incluirNaoIdentificados: true }), ['2026-09\\C\\a.xml', 'e.pdf', 'NÃO IDENTIFICADOS\\x\\b.pdf']);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ---------- 8. .zip lido sem ferramenta externa ----------
function zipCom(arquivos) {
  const locais = [], centrais = [];
  let pos = 0;
  for (const [nome, conteudo, deflate] of arquivos) {
    const bruto = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo);
    const dados = deflate ? zlib.deflateRawSync(bruto) : bruto;
    const n = Buffer.from(nome);
    const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(deflate ? 8 : 0, 8); loc.writeUInt32LE(dados.length, 18); loc.writeUInt32LE(bruto.length, 22); loc.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(deflate ? 8 : 0, 10); cen.writeUInt32LE(dados.length, 20); cen.writeUInt32LE(bruto.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(pos, 42);
    locais.push(loc, n, dados); centrais.push(cen, n);
    pos += 30 + n.length + dados.length;
  }
  const cd = Buffer.concat(centrais);
  const fim = Buffer.alloc(22); fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10); fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(pos, 16);
  return Buffer.concat(locais.concat([cd, fim]));
}
const z = A.abrirZip(zipCom([['a.xml', '<a>1</a>', true], ['pasta/b.txt', 'texto', false]]));
igual('zip: deflate e stored, com subpasta', z.map(m => [m.nome, m.buffer.toString()]), [['a.xml', '<a>1</a>'], ['pasta/b.txt', 'texto']]);
const z2 = A.membros('fora.zip', zipCom([['dentro.zip', zipCom([['c.xml', '<c/>', true]]), false]]));
igual('zip dentro de zip: abre os dois', z2.map(m => m.nome), ['dentro.zip\\c.xml']);

// ---------- 9. medir contra a história: o tipo do destino ----------
igual('tipo do destino: XML NFC-e', R.tipoDoDestino('G:\\Meu Drive\\2026\\279 - X\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NFC-e').tipo, 'XML NFC-e');
igual('tipo do destino: comprovante', R.tipoDoDestino('G:/Meu Drive/2026/58 - X/CONTÁBIL/EXTRATOS/2026/06/COMPROVANTES/SICOOB').tipo, 'COMPROVANTE');

console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
process.exit(falhas ? 1 : 0);
