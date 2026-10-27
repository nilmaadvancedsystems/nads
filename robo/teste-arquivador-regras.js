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
igual('data ISO do comprovante PIX ("Data do pagamento2026-01-30 09:11")', R.dataBr('DATA DO PAGAMENTO2026-01-30 09:11:07'), '30-01-2026');
igual('banco pela conta da Caixa (agência/operação/conta)', R.bancoDoTexto('Extrato\nCliente: X\nConta: 3411/1292/000578855317-9'), 'CAIXA');
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
igual('NF-e entre dois clientes: nas duas (saída no emitente, entrada no destinatário; 23/10/2026)', [d.acao, d.cliente, d.copias.map(c => c.cliente)], ['ARQUIVAR', 380, [152]]);
d = R.decidir({ nome: 'a.xml', rel: '2026-08\\JANIO JOSE DE ALMEIDA\\a.xml', xml: nfe('11426314000177', '06934601000158', '9', '2026-08-05T10:00:00-03:00') }, ctx);
igual('... vinda da pasta de um deles: também nas duas', [d.acao, d.cliente, d.copias.map(c => c.cliente)], ['ARQUIVAR', 380, [152]]);
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
// 23/10/2026 (Vitor): o FGTS vai para DEPARTAMENTO PESSOAL\<MM>\FGTS, como o robô do FGTS grava
igual('FGTS Digital: DEPARTAMENTO PESSOAL\\<MM>\\FGTS\\FGTS MM-AAAA.pdf', [d.destinoRelativo, d.nomeFinal], ['421 - D´FARMA FARMACIA DE MANIPULACAO LTDA\\DEPARTAMENTO PESSOAL\\09\\FGTS', 'FGTS 09-2026.pdf']);
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
// 23/10/2026 (Vitor: "o código da ZELO mudou para 591"): as contas da ZELO saíram da tabela; sem conta já arquivada, não identifica
igual('OFX: sem a conta da ZELO na tabela do 03, o OFX sem CNPJ não acha o cliente', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'CLIENTE_NAO_LOCALIZADO']);
igual('certificado .pfx: cliente pelo CNPJ do nome, nome original (04b)', decidir({ nome: 'JANIO_06934601000158.pfx', rel: '2026-10\\JANIO_06934601000158.pfx' }).destinoRelativo, '152 - JANIO JOSE DE ALMEIDA\\SOCIETÁRIO\\CERTIFICADO DIGITAL');
// a raiz pelo ano (Vitor, 23/10/2026): sem a competência nem o ano na pasta de origem, não vai para 2026 por padrão
d = decidir({ nome: 'JANIO_06934601000158.pfx' });
igual('certificado sem ano na pasta: NÃO IDENTIFICADOS (ANO_INDETERMINADO), nunca 2026 por padrão', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'ANO_INDETERMINADO']);
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
  fs.mkdirSync(path.join(pasta, 'CONTRATO.pdf'));   // a rotina antiga deixou PASTAS com nome de arquivo
  igual('uma PASTA com o nome do arquivo também ocupa o nome: " (1)"', A.conferirDestino({ destinoRelativo: '380 - X\\A', nomeFinal: 'CONTRATO.pdf' }, sha('contrato'), c).nomeFinal, 'CONTRATO (1).pdf');
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

// ---------- 10. decisões do Vitor (21/10/2026) ----------
const nfseNilma = '<CompNfse><Nfse><InfNfse><Numero>4003</Numero><DataEmissao>2026-09-10T00:00:00</DataEmissao><PrestadorServico><Cnpj>27872981000113</Cnpj></PrestadorServico><TomadorServico><Cnpj>06934601000158</Cnpj></TomadorServico></InfNfse></Nfse></CompNfse>';
d = decidir({ nome: 'nfse-nilma.xml', xml: nfseNilma });
igual('NFS-e de honorários da Nilma: na 284 E uma cópia no tomador', [d.destinoRelativo, d.copias.map(c => c.destinoRelativo)], ['284 - NILMA CONTABILIDADE LTDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NFS-e', ['152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NFS-e']]);
const CAD_ = require('./arquivador-cadastro');
const j = CAD_.juntar({
  planilha: [{ codigo: 591, razao: 'ZELO AGROINDUSTRIAS LTDA', doc: '53.636.418/0001-56', regime: 'Simples' }, { codigo: 332, razao: 'DOMINGA ROSA GOMES', doc: '063.718.286-30', regime: 'Física' }],
  entregas: [{ codigoOrigem: '591', nome: 'AAP INTERMEDIACOES LTDA', documento: '65.116.389/0001-80', enquadramento: 'Simples' }, { codigoOrigem: '602', nome: 'ZELO AGROINDUSTRIAS LTDA - MATRIZ', documento: '53636418000156', enquadramento: 'Simples' },
    { codigoOrigem: '332', nome: 'DOMINGA ROSA GOMES', documento: '19.412.505/0001-91', enquadramento: 'Física' }],
  nads: [{ codigo: 591, nome: 'AAP INTERMEDIACOES LTDA', regime: 'Simples' }, { codigo: 332, nome: 'DOMINGA ROSA GOMES', regime: 'Presumido' }],
});
const l332 = j.linhas.find(l => l.codigo === 332), l591 = j.linhas.find(l => l.codigo === 591);
igual('cadastro: o regime do nads vale (sobre o Entregas e a planilha)', l332.regime, 'Presumido');
igual('cadastro: CPF (planilha) e CNPJ (Entregas) do mesmo cliente valem os dois', [l332.doc, l332.outrosDocs], ['19412505000191', ['06371828630']]);
igual('cadastro: código que na planilha era de outra empresa (591 ZELO × AAP) não herda o CNPJ nem o nome', [l591.doc, l591.outrosDocs, l591.outrosNomes], ['65116389000180', [], []]);
igual('cadastro: a divergência vai para a lista de pendências', j.divergencias.map(x => x.tipo), ['CODIGO_DE_OUTRA_EMPRESA']);
const cadZ = R.montarCadastro(j.linhas, ['591 - AAP INTERMEDIACOES LTDA', '591 - ZELO AGROINDUSTRIAIS LTDA']);
igual('ZELO sem exceção nas regras (23/10/2026): a filial que não está no cadastro não vai para a matriz', R.clientesDoDoc('53636418000400', cadZ), []);
igual('código com duas pastas no Drive: não escolhe', R.decidir({ nome: 'n.xml', rel: 'n.xml', xml: nfe('65116389000180', '99999999000191', '1', '2026-08-05T10:00:00-03:00') }, { cadastro: cadZ }).motivo, 'PASTA_DO_CLIENTE_DUPLICADA');
const cadZ2 = R.montarCadastro(j.linhas, ['591 - ZELO AGROINDUSTRIAIS LTDA']);
igual('pasta nova quando o Drive já tem a mesma empresa com outro código: não cria a segunda', R.decidir({ nome: 'n.xml', rel: 'n.xml', xml: nfe('53636418000156', '99999999000191', '1', '2026-08-05T10:00:00-03:00') }, { cadastro: cadZ2 }).motivo, 'PASTA_EXISTE_COM_OUTRO_CODIGO');

// ---------- 12. decisões do Vitor (27/10/2026): PGDAS-D, DEFIS do Alterdata, pagamentos de fornecedores, a 408 OURO VERDE ----------
const MIG = require('./arquivador-migracao');
const OV = { regime: 'Presumido', outrosNomes: ['OURO V E S F EIRELI'] };   // o extrato do BB só traz "OURO V E S F EIRELI"
const LINHAS27 = LINHAS.concat([
  { codigo: 700, razao: 'ACSSP ADM PROMOCAO DE VENDAS LTDA', doc: '35.418.593/0001-95', regime: 'Simples' },
  { codigo: 411, razao: 'MINAS FORESTRY LTDA', doc: '12.345.678/0001-95', regime: 'Presumido' },
  { codigo: 413, razao: 'BRAZILIAN FLORESTAL LTDA', doc: '23.456.789/0001-95', regime: 'Presumido' },
  { codigo: 414, razao: 'BRAZILIAN FLORESTAL LTDA', doc: '23.456.789/0002-76', regime: 'Presumido' },
  { codigo: 418, razao: 'BRAZILIAN FLORESTAL LTDA', doc: '23.456.789/0003-57', regime: 'Presumido' },
  { codigo: 453, razao: 'BRAZILIAN FLORESTAL LTDA', doc: '23.456.789/0004-38', regime: 'Presumido' },
  { codigo: 591, razao: 'ZELO AGROINDUSTRIAS LTDA', doc: '53.636.418/0001-56', regime: 'Simples' },
  Object.assign({ codigo: 408, razao: 'OURO VERDE MINERACAO LTDA', doc: '34.567.891/0001-84' }, OV),
  Object.assign({ codigo: 409, razao: 'OURO VERDE MINERACAO LTDA', doc: '34.567.891/0002-65' }, OV),
  Object.assign({ codigo: 410, razao: 'OURO VERDE MINERACAO LTDA', doc: '34.567.891/0003-46' }, OV),
]);
const cad27 = R.montarCadastro(LINHAS27, PASTAS.concat(LINHAS27.filter(l => l.codigo >= 408).map(l => l.codigo + ' - ' + l.razao)));
cad27.mapaMigracao = MIG.carregar({});   // o versionado (as pastas que juntam matriz e filiais)
const d27 = e => R.decidir(Object.assign({ rel: e.nome }, e), { cadastro: cad27, hoje: new Date(2026, 9, 27) });
const destino = x => [x.acao, x.motivo || null, x.destinoRelativo || null, x.nomeFinal || null];

// 12a. PGDAS-D: 01. DAS do Simples, competência = o período de apuração, o documento pelo conteúdo
const PGDAS_DECL = 'Programa Gerador do Documento de Arrecadação do Simples Nacional – Declaratório\nPGDAS-D\nDeclaração\nNº da Declaração: 06934601202302001\nCNPJ Básico: 06.934.601\nCNPJ Matriz: 06.934.601/0001-58\nNome Empresarial: JANIO JOSE DE ALMEIDA\nPeríodo de Apuração (PA): 02/2023\nReceita Bruta do PA (RPA) - Competência 10.000,00';
d = d27({ nome: 'PGDASD-DECLARACAO-06934601202302001 02-2023.pdf', texto: [PGDAS_DECL] });
igual('PGDAS-D declaração: 01. DAS\\MM-AAAA - PGDAS-D DECLARACAO.pdf, raiz do ano do PA', destino(d).concat(d.anoRaiz), ['ARQUIVAR', null, '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\01. DAS', '02-2023 - PGDAS-D DECLARACAO.pdf', 2023]);
// o layout de 2021: o título quebrado em duas linhas e o período "01/06/2021 a 30/06/2021" (Torra Torra; 27/10/2026)
d = d27({ nome: 'PGDASD-DECLARACAO-06934601202106001.pdf', texto: ['Programa Gerador do Documento de Arrecadação\ndo Simples Nacional - Declaratório\nDeclaração Original\nPeríodo de Apuração:01/06/2021 a 30/06/2021\n.\n1. Identificação do Contribuinte\nCNPJ Matriz:06.934.601/0001-58\nNome empresarial:JANIO JOSE DE ALMEIDA\nNº da Declaração:06934601202106001'] });
igual('PGDAS-D de 2021: o título em duas linhas', destino(d).concat(d.anoRaiz), ['ARQUIVAR', null, '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\01. DAS', '06-2021 - PGDAS-D DECLARACAO.pdf', 2021]);
// o pacote de transmissão do Sintegra (TED, "02CL_PADRAO…", .zip que não é zip): 05. SINTEGRA, sem abrir (Vitor, 27/10/2026)
d = d27({ nome: '02-2026.zip', rel: '0152 - JANIO JOSE DE ALMEIDA\\DEPARTAMENTO FISCAL\\SINTEGRA\\2026\\02-2026.zip', tedSintegra: true });
igual('Sintegra TED: 05. SINTEGRA\\MM-AAAA - TRANSMISSAO.zip, cliente pela pasta', destino(d), ['ARQUIVAR', null, '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\05. SINTEGRA', '02-2026 - TRANSMISSAO.zip']);
igual('Sintegra TED: o cabeçalho 02CL_PADRAO', [require('./arquivador-novo').ehTedSintegra(Buffer.from('02CL_PADRAO     CONV57953')), require('./arquivador-novo').ehTedSintegra(Buffer.from('PK\u0003\u0004'))], [true, false]);
// o recibo de 2021: o PA na tabela, grudado no número da apuração ("06/2021" + "06934601202106001")
d = d27({ nome: 'PGDASD-RECIBO-06934601202106001.pdf', texto: ['RECIBO DE ENTREGA DA APURAÇÃO NO PGDAS-D\nDeclaração Original\n1. Informações do Contribuinte\nNome EmpresarialCNPJ da Matriz\nJANIO JOSE DE ALMEIDA06.934.601/0001-58\n2. Resumo da Apuração\nPeríodo de\nApuração\n06/202106934601202106001R$ 55.271,36R$ 3.857,48'] });
igual('PGDAS-D recibo de 2021: o PA da tabela', destino(d), ['ARQUIVAR', null, '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\01. DAS', '06-2021 - PGDAS-D RECIBO.pdf']);
const PGDAS_REC = 'Recibo de Entrega da Apuração\nPGDAS-D\nCNPJ Básico: 06.934.601\nNome Empresarial: JANIO JOSE DE ALMEIDA\nPeríodo de Apuração: 03/2023\nNúmero da Declaração: 06934601202303001\nData/hora da transmissão: 20/04/2023 10:11:12';
d = d27({ nome: 'PGDASD-RECIBO-06934601202303001.pdf', texto: [PGDAS_REC] });
igual('PGDAS-D recibo só com o CNPJ básico (um cliente só bate): 03-2023 - PGDAS-D RECIBO.pdf', destino(d), ['ARQUIVAR', null, '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\01. DAS', '03-2023 - PGDAS-D RECIBO.pdf']);
const PGDAS_EXT = 'Extrato do Simples Nacional\nPeríodo de Apuração (PA): 10/2024\nCNPJ Matriz: 06.934.601/0001-58\nNome empresarial: JANIO JOSE DE ALMEIDA\nInformações da Declaração';
igual('PGDAS-D extrato: 10-2024 - PGDAS-D EXTRATO.pdf', d27({ nome: 'PGDASD-EXTRATO REF. 10.2024.pdf', texto: [PGDAS_EXT] }).nomeFinal, '10-2024 - PGDAS-D EXTRATO.pdf');
const PGDAS_DOIS = PGDAS_EXT + '\nRecibo de Entrega da Apuração';
igual('PGDAS-D com recibo e extrato no conteúdo: o nome do arquivo desempata; sem ele, VOCABULARIO_AUSENTE', [d27({ nome: 'PGDASD-RECIBO-1.pdf', texto: [PGDAS_DOIS] }).nomeFinal, d27({ nome: 'pgdas.pdf', texto: [PGDAS_DOIS] }).motivo], ['10-2024 - PGDAS-D RECIBO.pdf', 'VOCABULARIO_AUSENTE']);
d = d27({ nome: 'PGDASD-EXTRATO.pdf', texto: [PGDAS_EXT.replace(/06.934.601\/0001-58/, '11.426.314/0001-77').replace('10/2024', '09/2026')] });
igual('PGDAS-D de cliente do Presumido no ano corrente: TIPO_INCOMPATIVEL_COM_REGIME (como o DAS)', [d.tipo, d.motivo], ['PGDAS-D', 'TIPO_INCOMPATIVEL_COM_REGIME']);
igual('a guia do DAS ("Pagar este documento até") que cita o PGDAS-D continua DAS', d27({ nome: 'das.pdf', texto: [DAS + '\nGerado pelo PGDAS-D'] }).nomeFinal, '09-2026.pdf');

// 12b. relatório da DEFIS do Alterdata: 14. DEFIS, cliente do CNPJ Matriz, raiz do ano da entrega (a emissão)
const ALTERDATA = 'Declaração Anual do Simples Nacional - DASN Ano Calendário: Alterdata Tecnologia em Informática Ltda. 2025Emissão: 09/02/2026 17:19:15Página: 00001 00371ACSSP ADM PROMOCAO DE VENDAS LTDA 1. Identificação do Contribuinte CNPJ Matriz: 35.418.593/0001-95 Nome Empresarial: 1.1 CNPJ das Filiais Presentes nesta declaração: 06.934.601/0001-58 2. Informações Econômico-Fiscais';
d = d27({ nome: 'ACSSP F.pdf', rel: 'DEFIS 2025.zip\\DEFIS 2025\\ACSSP F.pdf', texto: [ALTERDATA] });
igual('DEFIS do Alterdata: 14. DEFIS\\AAAA - DEFIS ALTERDATA.pdf do CNPJ Matriz, raiz do ano da emissão', destino(d).concat(d.anoRaiz), ['ARQUIVAR', null, '700 - ACSSP ADM PROMOCAO DE VENDAS LTDA\\FISCAL\\SIMPLES NACIONAL\\14. DEFIS', '2025 - DEFIS ALTERDATA.pdf', 2026]);
d = d27({ nome: 'BIG LANCHES F.pdf', texto: [ALTERDATA.replace('Ltda. 2025Emissão: 09/02/2026 17:19:15', 'Ltda. 2024')] });
igual('... sem a emissão: o ano-calendário + 1', [d.nomeFinal, d.anoRaiz], ['2024 - DEFIS ALTERDATA.pdf', 2025]);
d = d27({ nome: 'defis.pdf', texto: ['Declaração de Informações Socioeconômicas e Fiscais (DEFIS)\nAno-calendário 2025\nCNPJ 06.934.601/0001-58 JANIO JOSE DE ALMEIDA'] });
igual('a DEFIS do portal continua "AAAA - DEFIS.pdf"', [d.tipo, d.destinoRelativo, d.nomeFinal], ['DEFIS', '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\14. DEFIS', '2025 - DEFIS.pdf']);

// 12c. pagamentos de fornecedores: CONTÁBIL\PAGAMENTOS DE FORNECEDORES\[ANO]\[MÊS]\[FORNECEDOR], o nome original
const NOMES_PG = ['28-04-2025 POSTO 116 NF18203 R$4.107,85.pdf', '10-04-2025 RR PNEUS NF12279 E 1546 R$3.023,10.pdf', 'NF 128286 Mason Equipamento R$ 42.762,19.pdf', 'NFSE 08 MARCIA LAZZARO R$2.500,00.pdf', 'FATURAS Nº 32270 TRILHA TURISMO R$ 2.229,67..pdf', '29-09-2026 COMERCIAL ALVES NF58812 R$37,68.pdf'];
igual('fornecedor: o trecho entre a data/"NF nnn" e o "R$", em maiúsculas', NOMES_PG.map(n => (R.pagamentoDeFornecedor({ nome: n, rel: 'X\\Comprovantes e NFs\\' + n }) || {}).fornecedor), ['POSTO 116', 'RR PNEUS', 'MASON EQUIPAMENTO', 'MARCIA LAZZARO', 'TRILHA TURISMO', 'COMERCIAL ALVES']);
const P413 = 'FERNANDO\\413 BRAZILIAN filiais 414.  418. 453\\Comprovantes e Pagtos\\NFs e Boletos\\';
d = d27({ nome: NOMES_PG[0], rel: P413 + NOMES_PG[0], texto: ['DANFE\nDOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA\nPOSTO 116 LTDA\nDESTINATÁRIO BRAZILIAN FLORESTAL LTDA 23.456.789/0001-95'] });
igual('pasta 413 (matriz e filiais), sem CNPJ de filial no conteúdo: a matriz 413, mês da data do nome, nome original', destino(d), ['ARQUIVAR', null, '413 - BRAZILIAN FLORESTAL LTDA\\CONTÁBIL\\PAGAMENTOS DE FORNECEDORES\\2025\\04\\POSTO 116', NOMES_PG[0]]);
d = d27({ nome: NOMES_PG[2], rel: P413 + NOMES_PG[2], texto: ['BOLETO\nPagador: BRAZILIAN FLORESTAL LTDA CNPJ 23.456.789/0003-57\nVencimento: 15/05/2025\nValor 42.762,19'] });
igual('... o CNPJ da filial 418 no conteúdo: a 418; sem data no nome nem mês na pasta, o vencimento', destino(d), ['ARQUIVAR', null, '418 - BRAZILIAN FLORESTAL LTDA\\CONTÁBIL\\PAGAMENTOS DE FORNECEDORES\\2025\\05\\MASON EQUIPAMENTO', NOMES_PG[2]]);
d = d27({ nome: NOMES_PG[3], rel: 'FERNANDO\\411 MINAS FORESTRY\\2025\\04\\Comprovantes e NFs\\' + NOMES_PG[3], texto: [' '] });
igual('escaneado sem texto na pasta "411 MINAS FORESTRY\\2025\\04": a 411, o mês da pasta de origem', destino(d), ['ARQUIVAR', null, '411 - MINAS FORESTRY LTDA\\CONTÁBIL\\PAGAMENTOS DE FORNECEDORES\\2025\\04\\MARCIA LAZZARO', NOMES_PG[3]]);
d = d27({ nome: NOMES_PG[5], rel: '591 - ZELO AGROINDUSTRIAS LTDA\\2026\\09.2026\\Comprovantes e NFs\\' + NOMES_PG[5], texto: [COMP.replace(/LEONARDO MENDES MARQUES/g, 'ZELO AGROINDUSTRIAS LTDA')] });
igual('comprovante bancário de fornecedor na pasta de pagamentos: PAGAMENTOS DE FORNECEDORES, não EXTRATOS\\COMPROVANTES', destino(d), ['ARQUIVAR', null, '591 - ZELO AGROINDUSTRIAS LTDA\\CONTÁBIL\\PAGAMENTOS DE FORNECEDORES\\2026\\09\\COMERCIAL ALVES', NOMES_PG[5]]);
d = d27({ nome: NOMES_PG[1], texto: [COMP] });
igual('... fora da pasta de pagamentos, o mesmo nome segue o conteúdo (EXTRATOS\\…\\COMPROVANTES\\SICOOB)', destino(d), ['ARQUIVAR', null, '380 - LEONARDO MENDES MARQUES\\CONTÁBIL\\EXTRATOS\\2026\\02\\COMPROVANTES\\SICOOB', 'Comprovantes 02-2026.pdf']);
d = d27({ nome: NOMES_PG[4], rel: 'FERNANDO\\411 MINAS FORESTRY\\Comprovantes e NFs\\' + NOMES_PG[4], texto: ['FATURA 32270\nTRILHA TURISMO LTDA\nTotal 2.229,67'] });
igual('sem data no nome, sem mês na pasta e sem vencimento: NAO_IDENTIFICADO/COMPETENCIA_AUSENTE', [d.acao, d.motivo, d.tipo, d.cliente], ['NAO_IDENTIFICADO', 'COMPETENCIA_AUSENTE', 'FATURA FORNECEDOR', 411]);

// 12d. a 408 OURO VERDE e as filiais 409 e 410 na mesma pasta: "OV" = 408, "OV1" = 409, "OV3" = 410, "408Balancete…" = 408
const P408 = 'FERNANDO\\408 OURO VERDE MINERAÇÃO filiais 409 e 410\\2025\\02.2025\\';
igual('pasta 408/409/410: o cliente pelo nome do arquivo', ['BB 02.2025 OV1.pdf', 'BNB 01.2025 ov3.pdf', 'BB Aplic. 02.2025 OV.pdf', '408Balancete2025.pdf', 'BB 02.2025.pdf'].map(n => (R.clienteDaPasta(P408 + n, cad27) || {}).codigo || null), [409, 410, 408, 408, null]);
const EXT_OV = 'SISBB - SISTEMA DE INFORMACOES BANCO DO BRASIL\nEXTRATO DE CONTA CORRENTE\nCliente: OURO V E S F EIRELI\nAgência: 2705-7 Conta corrente: 26345-1\nPeríodo: 01/02/2025 a 28/02/2025\nSALDO ANTERIOR 1.000,00';
d = d27({ nome: 'BB 02.2025 OV1.pdf', rel: P408 + 'BB 02.2025 OV1.pdf', texto: [EXT_OV] });
igual('extrato do BB só com "OURO V E S F EIRELI" e "OV1" no nome: a 409 (o resto como as regras já fazem)', destino(d), ['ARQUIVAR', null, '409 - OURO VERDE MINERACAO LTDA\\CONTÁBIL\\EXTRATOS\\2025\\02\\BANCÁRIOS\\BANCO DO BRASIL', '02-2025.pdf']);
igual('... sem "OV" no nome continua CLIENTE_AMBIGUO', d27({ nome: 'BB 02.2025.pdf', rel: P408 + 'BB 02.2025.pdf', texto: [EXT_OV] }).motivo, 'CLIENTE_AMBIGUO');

// ---------- 13. decisões do Vitor (27/10/2026, 2º lote): o PDF da nota pelo XML da chave, os comprovantes do Berizal, a 415 LAVICA, a NFS-e da Nilma ----------
const K = require('./arquivador-chaves');
const comDv = b => { let s = 0, p = 2; for (let i = b.length - 1; i >= 0; i--) { s += +b[i] * p; p = p === 9 ? 2 : p + 1; } const r = s % 11; return b + (r < 2 ? 0 : 11 - r); };
const LINHAS28 = LINHAS27.concat([
  { codigo: 237, razao: 'POSTO DE COMBUSTIVEIS BERIZAL LTDA', doc: '17.713.597/0001-14', regime: 'Presumido' },
  { codigo: 415, razao: 'LAVICA EMPREENDIMENTOS FLORESTAIS LTDA', doc: '45.678.912/0001-55', regime: 'Presumido' },
  { codigo: 416, razao: 'LAVICA EMPREENDIMENTOS FLORESTAIS LTDA - FILIAL 02', doc: '45.678.912/0002-36', regime: 'Presumido' },
  { codigo: 544, razao: 'HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA', doc: '34.192.587/0001-08', regime: 'Simples' },
  { codigo: 545, razao: 'HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA', doc: '34.192.587/0002-80', regime: 'Simples' },
]);
const cad28 = R.montarCadastro(LINHAS28, PASTAS.concat(LINHAS28.filter(l => l.codigo >= 237 && !PASTAS.some(p => p.startsWith(l.codigo + ' - '))).map(l => l.codigo + ' - ' + l.razao)));
cad28.mapaMigracao = MIG.carregar({});
const XML_NFE = ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NF-e'], XML_NFSE = ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NFS-e'];
const CH_HELLO = comDv('312602' + '34192587000280' + '55' + '002' + '000001316' + '1' + '11395121');
const CH_NFSE = '3168002' + '2' + '2' + '27872981000113' + '2600000003244' + '2602' + '000105201' + '1';
const idx = new K.Indice();
idx.juntar(CH_HELLO, 545, XML_NFE, 'doc', 'teste');
idx.juntar(CH_NFSE, 284, XML_NFSE, 'doc', 'teste');
idx.juntar(CH_NFSE, 152, XML_NFSE, 'doc', 'teste');
const d28 = (e, comChaves) => R.decidir(Object.assign({ rel: e.nome }, e), Object.assign({ cadastro: cad28, hoje: new Date(2026, 9, 27) }, comChaves === false ? {} : { chaves: comChaves || idx }));

// 13a. o PDF da nota com o XML da mesma chave já arquivado: a pasta e o nome do XML, com .pdf
const DANFE_HELLO = 'NF-e\nRECEBEMOS DE HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA OS PRODUTOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO.\nCHAVE DE ACESSO\nDANFE\nDOCUMENTO AUXILIAR\nDA NOTA FISCAL\nELETRÔNICA\n15151706611834.192.587/0002-80\nOutras Entradas - Retorno Simbolico de Deposito Temporario\n135260405866604 - 01/02/2026 10:59:31\n' + CH_HELLO.replace(/(\d{4})(?=\d)/g, '$1 ') + '\nNº 000.001.316\nHELLO NUTRITION COMERCIO\nDE ALIMENTOS E BEBIDAS LTDA';
const REL_HELLO = 'IMPORTAÇÃO\\0544 - HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA - ME (MATRIZ)\\2026\\02\\022026.zip\\022026/FILIAL 02\\';
d = d28({ nome: '35260234192587000280550020000013161.pdf', rel: REL_HELLO + '35260234192587000280550020000013161.pdf', texto: [DANFE_HELLO] });
igual('PDF da nota (nome com a chave cortada, a chave no conteúdo) com o XML arquivado: a pasta e o nome do XML', destino(d).concat(d.anoRaiz), ['ARQUIVAR', null, '545 - HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NF-e', '02-2026_NF-e_1316.pdf', 2026]);
igual('... o " - Copia" vai para o mesmo destino e nome (o idêntico vira JA_ARQUIVADO no conferirDestino)', destino(d28({ nome: '35260234192587000280550020000013161 - Copia.pdf', rel: REL_HELLO + 'x - Copia.pdf', texto: [DANFE_HELLO] })), destino(d));
const sem = d28({ nome: '35260234192587000280550020000013161.pdf', rel: REL_HELLO + 'x.pdf', texto: [DANFE_HELLO] }, new K.Indice()), hoje = d28({ nome: '35260234192587000280550020000013161.pdf', rel: REL_HELLO + 'x.pdf', texto: [DANFE_HELLO] }, false);
igual('... sem o XML no índice: NAO_IDENTIFICADO com o motivo de hoje', [sem.acao, sem.motivo], [hoje.acao, hoje.motivo]);
d = d28({ nome: CH_HELLO + '-nfe.pdf', texto: [' '] });
igual('a chave no nome ("<chave>-nfe.pdf"), escaneado sem texto: pelo nome', [d.acao, d.destinoRelativo, d.nomeFinal], ['ARQUIVAR', '545 - HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NF-e', '02-2026_NF-e_1316.pdf']);
const DANFSE = 'DANFSev1.0\nDocumentoAuxiliardaNFS-e\nMUNICIPIODETAIOBEIRAS\nChavedeAcessodaNFS-e\n' + CH_NFSE + '\nNúmerodaNFS-e\n2600000003244\nCompetênciadaNFS-e\n28/02/2026\nPrestadordoServiço\nCNPJ/ CPF/ NIF\n27.872.981/0001-13\nNILMACONTABILIDADELTDA\nTOMADORDOSERVIÇO\nCNPJ/ CPF/ NIF\n06.934.601/0001-58';
d = d28({ nome: CH_NFSE.slice(0, 49) + ' ' + CH_NFSE.slice(49) + '.pdf', rel: 'IMPORTAÇÃO\\0152 - JANIO JOSE DE ALMEIDA\\2026\\02\\x.pdf', texto: [DANFSE] });
igual('NFS-e nacional (chave de 50 no conteúdo) com o XML na 152 e na 284: nas duas, a da pasta de origem primeiro', [d.acao, d.destinoRelativo, d.nomeFinal, d.copias.map(c => c.destinoRelativo)], ['ARQUIVAR', '152 - JANIO JOSE DE ALMEIDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NFS-e', '02-2026_NFS-e_2600000003244.pdf', ['284 - NILMA CONTABILIDADE LTDA\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NFS-e']]);
d = d28({ nome: '110111' + CH_HELLO + '01-procEventoNFe.pdf', texto: ['CANCELAMENTO DE NF-e\nNão possui valor fiscal, simples representação do evento indicado abaixo\n' + CH_HELLO.replace(/(\d{4})(?=\d)/g, '$1 ') + '\n110111Cancelamento'] });
igual('o PDF do evento não usa o XML do original (o índice não guarda o nome do XML do evento)', d.acao, 'NAO_IDENTIFICADO');

// 13b. Posto Berizal (237): o comprovante escaneado (OCR) e o "N - DDMMAAAA - Pagamento - V.pdf" em PAGAMENTOS DE FORNECEDORES
const OCR_CAIXA = 'Gerenciador CAI-XA\nGERENCIADOR\nCAIXA\nComprovante de Pagamento de Boleto\nVia Internet Banking CAIXA\nBanco Recebedor: CAIXA ECONÔMICA FEDERAL\nPagador Final / Efetivo\nCPF/CNPJ: 17.713.597/0001-14\nNome: POSTO DE COMBUSTIVEIS BERIZAL LT\nInstituição Emissora - Nome do Banco: BANCO COOPERATIVO DO BRASIL S.A.\nBeneficiário original / Cedente\nNome Fantasia: NILMA DIAS OLIVEIRA\nNome/Razão Social: NILMA DIAS OLIVEIRA\nCPF/CNP)I: 27.872.981/0001-13\nSacador Avalista\nNome/Razão Social: POSTO DE COMBUSTIVEIS BERIZAL LTDA ME\nCPF/CNPJ: 17.713.597/0001-14\nPagador Sacado\nNome/Razão Social: POSTO DE COMBUSTIVEIS BERIZAL LTDA ME\nCPF/CNPJ: 17.713.597/0001-14\nData do Vencimento: 10/02/2026\nData de Efetivação / Agendamento: 09/02/2026\nValor Nominal do Boleto: 1.400,00\nValor Calculado (R$): 1.400,00\nValor Pago (R$): 1.400,00\nCódigo da operação: 59884063245';
const REL_BER = 'IMPORTAÇÃO\\0237 - POSTO DE COMBUSTIVEL BERIZAL LTDA - ME\\2026\\02\\Descompactado(s) com sucesso\\BOLETOS E COMPROVANTES FEVEREIRO.rar\\';
d = d28({ nome: 'Imagem (10).jpg', rel: REL_BER + 'Imagem (10).jpg', texto: [OCR_CAIXA], ocr: { confianca: 88 } });
igual('imagem do comprovante (OCR): cliente pelo CNPJ do pagador, "DD-MM-AAAA BENEFICIÁRIO R$ VALOR.jpg", mês da efetivação', destino(d).concat(d.confianca), ['ARQUIVAR', null, '237 - POSTO DE COMBUSTIVEIS BERIZAL LTDA\\CONTÁBIL\\PAGAMENTOS DE FORNECEDORES\\2026\\02\\NILMA DIAS OLIVEIRA', '09-02-2026 NILMA DIAS OLIVEIRA R$ 1.400,00.jpg', 0.9]);
d = d28({ nome: 'Imagem (11).jpg', rel: REL_BER + 'Imagem (11).jpg', texto: [OCR_CAIXA.replace(/Nome Fantasia: NILMA DIAS OLIVEIRA\nNome\/Razão Social: NILMA DIAS OLIVEIRA\n/, '')], ocr: { confianca: 88 } });
igual('... sem o beneficiário lido: VOCABULARIO_AUSENTE', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'VOCABULARIO_AUSENTE']);
d = d28({ nome: 'Imagem (13).jpg', rel: REL_BER + 'Imagem (13).jpg', texto: ['RECIBO DO PAGADOR SICOOB 756-0\nBeneficiário MAXTELL FIBRA LTDA Vencimento 10/02/2026\nPagador: POSTO BERIZAL CPF/CNPJ: 17.713.597/0001-14\nFicha de Compensação'], ocr: { confianca: 73 } });
igual('imagem de boleto (não é comprovante de pagamento): fica sem regra', [d.acao, d.motivo], ['NAO_IDENTIFICADO', 'TIPO_NAO_RECONHECIDO']);
igual('imagem sem texto (sem OCR): FORMATO_SEM_REGRA, como antes', d28({ nome: 'Imagem.jpg', rel: REL_BER + 'Imagem.jpg' }).motivo, 'FORMATO_SEM_REGRA');
const BB_DEBITO = 'SISBB  -  SISTEMA DE INFORMACOES BANCO DO BRASIL\n03/03/2026  -   AUTO ATENDIMENTO   -    17.01.17\n        COMPROVANTE DE DEBITO AUTOMATICO\nCLIENTE: POSTO DE COMBUSTIVEIS BER\nAGENCIA: 2705-7      CONTA:        22.294-1\nCONVENIO: 012695       BB SEGUROS\nDATA PREVISTA DO DEBITO:              03.02.2026\nDATA DO DEBITO:                       03.02.2026\nVALOR DO DEBITO R$                        313,29\nHISTORICO LANCAMENTO:  DEBITO AUTORIZADO';
const REL_BER_PDF = 'IMPORTAÇÃO\\0237 - POSTO DE COMBUSTIVEL BERIZAL LTDA - ME\\2026\\02\\Comprovantes\\';
d = d28({ nome: '4 - 03022026 - Pagamento - 313,29.pdf', rel: REL_BER_PDF + '4 - 03022026 - Pagamento - 313,29.pdf', texto: [BB_DEBITO] });
igual('"N - DDMMAAAA - Pagamento - V.pdf" (débito automático do BB): pela pasta 0237, o convênio é o beneficiário, nome original', destino(d), ['ARQUIVAR', null, '237 - POSTO DE COMBUSTIVEIS BERIZAL LTDA\\CONTÁBIL\\PAGAMENTOS DE FORNECEDORES\\2026\\02\\BB SEGUROS', '4 - 03022026 - Pagamento - 313,29.pdf']);
d = d28({ nome: '9 - 10022026 - Pagamento - 167,09.pdf', rel: REL_BER_PDF + '9 - 10022026 - Pagamento - 167,09.pdf', texto: [BB_DEBITO.replace(/CONVENIO: 012695       BB SEGUROS\n/, '')] });
igual('... sem o beneficiário no conteúdo: VOCABULARIO_AUSENTE', [d.acao, d.motivo, d.tipo], ['NAO_IDENTIFICADO', 'VOCABULARIO_AUSENTE', 'COMPROVANTE FORNECEDOR']);

// 13c. 415 LAVICA e a filial 416 na mesma pasta: o pagamento de fornecedor como o da 413
const P415 = 'FERNANDO\\415 LAVICA EMPREEND. FLORESTAIS filal 416\\Comprovantes\\NFs e Boletos\\';
const BOL_LUSO = 'BOLETO LUSO BRASIL NF60236 R$454,00.pdf';
d = d28({ nome: BOL_LUSO, rel: P415 + BOL_LUSO, texto: ['Boleto\nBeneficiário LUSO BRASIL LTDA\nVencimento: 10/03/2025\nValor 454,00'] });
igual('pasta 415/416 sem CNPJ da filial: a matriz 415; "BOLETO" no começo do nome não entra no fornecedor', destino(d), ['ARQUIVAR', null, '415 - LAVICA EMPREENDIMENTOS FLORESTAIS LTDA\\CONTÁBIL\\PAGAMENTOS DE FORNECEDORES\\2025\\03\\LUSO BRASIL', BOL_LUSO]);
d = d28({ nome: BOL_LUSO, rel: P415 + BOL_LUSO, texto: ['Boleto\nPagador LAVICA EMPREENDIMENTOS FLORESTAIS LTDA CNPJ 45.678.912/0002-36\nVencimento: 10/03/2025'] });
igual('... o CNPJ da filial 416 no conteúdo: a 416', d.cliente, 416);

// 13d. a NFS-e de honorários da Nilma em PDF (o layout da Prefeitura de Taiobeiras): na 284 E no tomador
const NFSE_NILMA = '\nAlíquota\nPREFEITURA MUNICIPAL DE TAIOBEIRAS\nSECRETARIA MUNICIPAL DE RECEITAS E CADASTRO\nRazão Social: NILMA DIAS OLIVEIRA - ME\nEndereço: TRAVESSA MARTINHO REGO, 000030, SALA 101/105 - CENTRO\nInscrição Estadual: ..... - Inscrição Municipal: 250517/6308 -  CPF/CNPJ: 27.872.981/0001-13\nNOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFSe\nNº da Nota Fiscal\n855\n TOMADOR DE SERVIÇOS\nAVENIDA AFONSO PENA\nEndereço\n39998-000\nCEP\nSECRETARIA MUNICIPAL DE RECEITAS E CADASTRO\n03.149.551/0001-00\nRazão Social\nADERLEI DOS SANTOS & CIA LTDA EPP\nValorValor ServiçoQuant.Un.Descrição do Serviço\nCPF/CNPJ\nData de Emissão\n17/02/2022\nNúmero RPS\ne28a41fcbbc6538a6313a4775af0accd\nNome Fantasia: NILMA CONTABILIDADE\nPRESTADOR DE SERVIÇO\nGerado em\n17/02/2022 09:59:42\nRECEBI(EMOS) DA EMPRESA: NILMA DIAS OLIVEIRA - ME A NOTA FISCAL Nº 855, EMITIDA EM 17/02/2022 NO VALOR R$ 1.237,00';
d = d28({ nome: 'ADERLEI DOS SANTOS & CIA LTDA.pdf', rel: 'FERNANDO\\NFSE NILMA CONTABILIDADE\\2022\\01-2022\\ADERLEI DOS SANTOS & CIA LTDA.pdf', texto: [NFSE_NILMA] });
igual('NFS-e da Nilma (Taiobeiras, "Nº da Nota Fiscal"): na 284 (EMITIDOS) e uma cópia no tomador (RECEBIDOS)', [d.acao, d.destinoRelativo, d.nomeFinal, d.copias.map(c => c.destinoRelativo), d.anoRaiz], ['ARQUIVAR', '284 - NILMA CONTABILIDADE LTDA\\FISCAL\\SIMPLES NACIONAL\\03. DOCUMENTOS FISCAIS\\EMITIDOS', '17-02-2022 - NFS-e 855 - NILMA CONTABILIDADE.pdf', ['66 - ADERLEI SANTOS E CIA\\FISCAL\\LUCRO PRESUMIDO\\03. DOCUMENTOS FISCAIS\\RECEBIDOS'], 2022]);

// ---------- 11. PRODUCAO de verdade, numa pasta temporária (nunca no Drive) ----------
(async () => {
  const sb = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-arqnovo-prod-'));
  try {
    const origem = path.join(sb, 'origem'), clientes = path.join(sb, '2026'), controle = path.join(sb, 'controle');
    fs.mkdirSync(path.join(origem, '2026-09', 'X'), { recursive: true });
    fs.mkdirSync(path.join(clientes, '284 - NILMA CONTABILIDADE LTDA'), { recursive: true });
    fs.writeFileSync(path.join(origem, '2026-09', 'X', 'nfse-nilma.xml'), nfseNilma);
    fs.writeFileSync(path.join(origem, 'foto.jpg'), 'nao sei o que e');
    const atividades = [];
    const painelFalso = { atividade: (t, x, det) => atividades.push(x), erro: (t, x, det) => atividades.push('ERRO ' + x + ' ' + det) };
    const base = { modo: 'PRODUCAO', confirmo: true, origem, clientes, controle, cadastro: R.montarCadastro(LINHAS, ['284 - NILMA CONTABILIDADE LTDA']), manifestoAntigo: path.join(sb, 'nao-existe.jsonl'), travaAntiga: path.join(sb, 'nao-existe.lock'), painel: painelFalso };
    // só XML liberado e não identificado fica na origem (a rotina antiga ainda roda)
    const r = await A.executar(Object.assign({}, base, { tiposProducao: ['XML'] }));
    const na284 = path.join(clientes, '284 - NILMA CONTABILIDADE LTDA', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NFS-e', '09-2026_NFS-e_4003.xml');
    const no152 = path.join(clientes, '152 - JANIO JOSE DE ALMEIDA', 'FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NFS-e', '09-2026_NFS-e_4003.xml');
    igual('produção: gravou na 284 e na pasta nova do tomador', [fs.existsSync(na284), fs.existsSync(no152)], [true, true]);
    igual('produção: o original saiu da origem (quarentena própria)', fs.existsSync(path.join(origem, '2026-09', 'X', 'nfse-nilma.xml')), false);
    igual('produção: não identificado fica na origem enquanto a rotina antiga roda', fs.existsSync(path.join(origem, 'foto.jpg')), true);
    const man = fs.readFileSync(path.join(controle, 'MANIFESTO', 'manifesto.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    igual('produção: duas linhas no manifesto, a da pasta nova marcada', man.map(m => [m.cliente, m.pasta_cliente_criada]).sort((a, b) => a[0] - b[0]), [[152, true], [284, false]]);   // a cópia vai antes (o original só sai depois dela)
    igual('produção: painel com a pasta criada e os dois arquivamentos', atividades.filter(a => /^Criou|^Arquivou/.test(a)).length, 3);
    igual('produção: nenhum erro', r.itens.filter(i => i.erro).map(i => i.erro), []);
    // rodar de novo com o mesmo arquivo: nunca sobrescreve, já está lá
    fs.writeFileSync(path.join(origem, 'nfse-nilma-de-novo.xml'), nfseNilma);
    const r2 = await A.executar(Object.assign({}, base, { tiposProducao: ['XML'] }));
    igual('produção: o mesmo conteúdo de novo é JA_ARQUIVADO (sem " (1)")', r2.itens.find(i => i.nome === 'nfse-nilma-de-novo.xml').acao, 'JA_ARQUIVADO');
    igual('produção: tipo fora da lista liberada fica na origem', (await A.executar(Object.assign({}, base, { tiposProducao: ['NFC-e PDF'], arquivos: ['foto.jpg'] }))).itens[0].naoAplicado, 'tipo ainda em simulação');
  } finally { fs.rmSync(sb, { recursive: true, force: true }); }
  // 13e. a imagem lida de verdade pelo Tesseract (27/10/2026): um comprovante gerado aqui, em PNG, passa pelo montarEntrada
  try {
    const { createCanvas } = require('@napi-rs/canvas');
    const linhas = ['Comprovante de Pagamento de Boleto', 'Pagador Final / Efetivo', 'CPF/CNPJ: 17.713.597/0001-14', 'Beneficiario original / Cedente', 'Nome/Razao Social: NILMA DIAS OLIVEIRA', 'Pagador Sacado', 'CPF/CNPJ: 17.713.597/0001-14', 'Data de Efetivacao / Agendamento: 09/02/2026', 'Valor Pago (R$): 1.400,00'];
    const cv = createCanvas(1400, 60 + linhas.length * 60), g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#000'; g.font = '34px sans-serif';
    linhas.forEach((l, i) => g.fillText(l, 40, 70 + i * 60));
    const ent = await A.montarEntrada('Imagem (10).png', REL_BER + 'Imagem (10).png', cv.toBuffer('image/png'));
    const di = R.decidir(ent, { cadastro: cad28, hoje: new Date(2026, 9, 27) });
    igual('imagem PNG lida pelo Tesseract: o comprovante vai para PAGAMENTOS DE FORNECEDORES com o nome montado', [di.acao, di.destinoRelativo, di.nomeFinal], ['ARQUIVAR', '237 - POSTO DE COMBUSTIVEIS BERIZAL LTDA\\CONTÁBIL\\PAGAMENTOS DE FORNECEDORES\\2026\\02\\NILMA DIAS OLIVEIRA', '09-02-2026 NILMA DIAS OLIVEIRA R$ 1.400,00.png']);
  } finally { await A.encerrarOcr(); }
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.log('FALHOU com erro:', e.stack); process.exit(1); });
