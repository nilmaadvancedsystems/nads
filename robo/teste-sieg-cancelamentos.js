// Testes dos cancelamentos do SIEG (11/11/2026: "preciso que ele puxe evento de cancelamento"): reconhecer o evento de
// cancelamento (NF-e, NFC-e, CT-e e NFS-e nacional), a memória do PC dos cancelamentos já gravados, a busca da madrugada
// (procurarCancelamentos, com fakes no lugar do portal e do banco) e a leitura da pasta CANCELADAS no Drive.
// Rode:  node teste-sieg-cancelamentos.js   (sem rede e sem banco)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sieg-canc-'));
// o Drive de mentira (antes de carregar o sieg.js: a pasta é lida quando o módulo carrega)
process.env.PASTA_DESTINO = path.join(tmp, 'drive', 'Claudio Secretario');
const sx = require('./sieg-xmls');
const sp = require('./sieg-portal');
const E = require('./sieg-estado');
const S = require('./sieg');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a !== b) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + a + '\n        esperado: ' + b); }
}

// ---------- os XMLs ----------
const CLI = '11426314000177';            // o cliente (emitente das emitidas)
const FORN = '06934601000158';           // um fornecedor
const chave = (cnpj, mod, n) => '31' + '2609' + cnpj + mod + '001' + String(n).padStart(9, '0') + '1' + String(n).padStart(8, '0') + '0';
const CH1 = chave(CLI, '55', 101), CH2 = chave(FORN, '55', 202), CH3 = chave(CLI, '57', 303);
const nfe = (ch, emit, dest, n) => '<nfeProc><NFe><infNFe Id="NFe' + ch + '"><ide><mod>55</mod><serie>1</serie><nNF>' + n + '</nNF><dhEmi>2026-09-05T10:00:00-03:00</dhEmi></ide><emit><CNPJ>' + emit + '</CNPJ><xNome>E</xNome></emit><dest><CNPJ>' + dest + '</CNPJ></dest><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>';
const evento = (ch, tp, desc, autor, campo = 'chNFe') => '<procEventoNFe><evento><infEvento Id="ID' + tp + ch + '01"><CNPJ>' + autor + '</CNPJ><' + campo + '>' + ch + '</' + campo + '><dhEvento>2026-09-08T10:00:00-03:00</dhEvento><tpEvento>' + tp + '</tpEvento><nSeqEvento>1</nSeqEvento><detEvento><descEvento>' + desc + '</descEvento></detEvento></infEvento></evento></procEventoNFe>';
const canc1 = evento(CH1, '110111', 'Cancelamento', CLI);
const canc2 = evento(CH2, '110111', 'Cancelamento', FORN);
const cancCte = evento(CH3, '110111', 'Cancelamento', CLI, 'chCTe').replace('procEventoNFe', 'procEventoCTe').replace('/procEventoNFe', '/procEventoCTe');
const cce = evento(CH1, '110110', 'Carta de Correcao', CLI);
const ciencia = evento(CH2, '210210', 'Ciencia da Operacao', CLI);
// a NFS-e nacional: a chave de 50 dígitos (município 7, ambiente 1, tipo de inscrição 1, a inscrição 14, o número 13, AAMM 4, código 9, DV 1)
const CHN = '3157005' + '2' + '2' + FORN + '0000000000009' + '2609' + '118215150' + '5';
const eventoNfse = (grupo, desc) => '<evento xmlns="http://www.sped.fazenda.gov.br/nfse"><infEvento Id="EVT1"><pedRegEvento><infPedReg Id="PRE1"><dhEvento>2026-09-08T10:50:30-03:00</dhEvento><CNPJAutor>' + FORN + '</CNPJAutor><chNFSe>' + CHN + '</chNFSe><' + grupo + '><xDesc>' + desc + '</xDesc></' + grupo + '></infPedReg></pedRegEvento></infEvento></evento>';
const cancNfse = eventoNfse('e101101', 'Cancelamento de NFS-e');
const indeferido = eventoNfse('e105105', 'Cancelamento de NFS-e Indeferido por Análise Fiscal');
const nfse = '<NFSe><infNFSe Id="NFS1"><nNFSe>9</nNFSe><dhProc>2026-09-05T10:00:00-03:00</dhProc><emit><CNPJ>' + FORN + '</CNPJ><xNome>F</xNome></emit><DPS><infDPS><dhEmi>2026-09-05T10:00:00-03:00</dhEmi><toma><CNPJ>' + CLI + '</CNPJ></toma><valores><vServPrest><vServ>50.00</vServ></vServPrest></valores></infDPS></DPS></infNFSe></NFSe>';

igual('cancelamento da NF-e (110111): é', sx.ehCancelamento(canc1), true);
igual('cancelamento do CT-e (110111): é', sx.ehCancelamento(cancCte), true);
igual('carta de correção (110110): não é', sx.ehCancelamento(cce), false);
igual('ciência da operação: não é', sx.ehCancelamento(ciencia), false);
igual('a nota: não é', sx.ehCancelamento(nfe(CH1, CLI, FORN, 101)), false);
igual('cancelamento da NFS-e nacional (e101101): é', sx.ehCancelamento(cancNfse), true);
igual('cancelamento da NFS-e indeferido: não é', sx.ehCancelamento(indeferido), false);
igual('o evento da NFS-e nacional é um evento', sx.tipoDoXml(cancNfse), 'evento');
igual('... e é de NFS-e', sx.tipoDeNota(cancNfse), 'NFS-e');
igual('nome do arquivo do evento da NFS-e: a chave e o código', sx.nomeDoArquivo(cancNfse), CHN + '-evento-101101-1.xml');
igual('nome do arquivo do cancelamento da NF-e (como antes)', sx.nomeDoArquivo(canc1), CH1 + '-evento-110111-1.xml');
igual('a chave cancelada: NF-e', sx.chaveCancelada(canc1), CH1);
igual('a chave cancelada: CT-e', sx.chaveCancelada(cancCte), CH3);
igual('a chave cancelada: NFS-e pelo prestador e número', sx.chaveCancelada(cancNfse), 'NFSE:' + FORN.replace(/^0+/, '') + ':9');
igual('o resumo do cancelamento da NF-e (como antes)', sx.resumoDaNota(canc1), { cancela: CH1 });
igual('o resumo da carta de correção: nada', sx.resumoDaNota(cce), null);
igual('a NFS-e do resumo casa com o cancelamento dela', sx.idParaCancelamento(sx.resumoDaNota(nfse)), sx.chaveCancelada(cancNfse));

// o resumo do mês marca as canceladas, NF-e e NFS-e
const m = sp.montarXmls(CLI, [nfe(CH1, CLI, FORN, 101), nfe(CH2, FORN, CLI, 202), nfse, canc1, cancNfse, cce]);
igual('resumo: a emitida cancelada', m.resumo.emitidas.map(n => [n.numero, !!n.cancelada]), [['101', true]]);
igual('resumo: a recebida (sem cancelamento) e a NFS-e cancelada', m.resumo.recebidas.map(n => [n.tipo, n.numero, !!n.cancelada]), [['NF-e', '202', false], ['NFS-e', '9', true]]);
igual('o cancelamento da NFS-e do fornecedor entra nos XMLs que o cliente mandou', sp.soDoCliente(FORN, [nfse, cancNfse]).length, 2);

// ---------- os tipos e os cancelamentos de uma lista ----------
igual('tipos com nota (sem o CF-e)', S.tiposComNotas({ emitidas: { NFe: 2, CFe: 9 }, recebidas: { NFSe: 1, CTe: 0 } }), ['NF-e', 'NFS-e']);
igual('tipos: sem contagem, nenhum', S.tiposComNotas(null), []);
const arq = xs => xs.map(x => ({ nome: sx.nomeDoArquivo(x), xml: x }));
igual('cancelamentos de uma lista (só os cancelamentos, sem repetir)', S.cancelamentosDe(arq([canc1, canc1.replace('<nSeqEvento>1', '<nSeqEvento>2'), cce, ciencia, cancNfse, nfe(CH2, FORN, CLI, 202)])).sort(), [CH1, 'NFSE:' + FORN.replace(/^0+/, '') + ':9'].sort());
igual('as canceladas de um resumo do nads', S.canceladasDoResumo({ emitidas: [{ chave: CH1, cancelada: true }, { chave: CH3 }], recebidas: [{ tipo: 'NFS-e', numero: '9', emitente: { doc: FORN }, cancelada: true }] }), [CH1, 'NFSE:' + FORN.replace(/^0+/, '') + ':9']);

(async () => {
  // ---------- a memória do PC ----------
  const arqMem = path.join(tmp, 'robo', 'sieg-cancelamentos.json');
  let agora = Date.parse('2026-11-11T04:00:00Z');
  const mem = E.criarMemoriaDeCancelamentos(arqMem, { agora: () => agora });
  igual('memória: começa sem conhecer', mem.conhece('380', '2026-10'), false);
  igual('memória: tudo é novo', mem.novas('380', '2026-10', [CH1, CH1, '']), [CH1]);
  mem.anotar('380', '2026-10', [CH1]);
  igual('memória: anotado', [mem.conhece('0380', '2026-10'), mem.novas(380, '2026-10', [CH1, CH2])], [true, [CH2]]);
  igual('memória: outro mês é outro registro', mem.conhece('380', '2026-11'), false);
  igual('memória: gravada em arquivo (outra instância vê)', E.criarMemoriaDeCancelamentos(arqMem, { agora: () => agora }).novas('380', '2026-10', [CH1]), []);
  mem.marcarSemDownload('152', '2026-11');
  igual('memória: o mês sem download', [mem.semDownload('152', '2026-11'), mem.conhece('152', '2026-11')], [true, true]);
  mem.anotar('152', '2026-11', []);
  igual('memória: o download tira a marca', mem.semDownload('152', '2026-11'), false);
  mem.anotar('9', '2026-03', [CH3]);
  agora = Date.parse('2026-11-12T04:00:00Z');
  mem.anotar('380', '2026-10', [CH2]);   // grava: o mês de mais de 6 meses atrás sai
  igual('memória: o mês velho sai quando grava', [mem.conhece('9', '2026-03'), Object.keys(JSON.parse(fs.readFileSync(arqMem, 'utf8'))).sort()], [false, ['152_2026-11', '380_2026-10']]);
  igual('memória: arquivo ilegível não quebra', E.criarMemoriaDeCancelamentos(path.join(tmp, 'nao', 'existe.json')).conhece('1', '2026-01'), false);

  // ---------- a busca da madrugada ----------
  const memB = E.criarMemoriaDeCancelamentos(path.join(tmp, 'robo', 'b.json'));
  const resumos = {
    '380_2026-10': { emitidas: [{ chave: CH1, cancelada: true }], recebidas: [] },   // o CH1 já estava cancelado no último download
    '152_2026-10': { emitidas: [], recebidas: [] },
  };
  const portal = {
    '111_2026-10': arq([nfe(CH1, CLI, FORN, 101), canc1, nfe(CH2, FORN, CLI, 202), canc2, cce]),
    '222_2026-10': arq([nfe(CH2, FORN, CLI, 202), ciencia]),
  };
  const lidos = [], baixados = [], pedidos = [];
  const cont = { emitidas: { NFe: 1 }, recebidas: { NFe: 1 } };
  const itens = [
    { codigo: '380', cnpj: '111', comp: '2026-10', contagem: cont },            // um cancelamento novo (CH2) e um que já estava (CH1)
    { codigo: '152', cnpj: '222', comp: '2026-10', contagem: cont },            // nenhum cancelamento
    { codigo: '475', cnpj: '333', comp: '2026-11', contagem: cont },            // o mês nunca foi baixado
    { codigo: '9', cnpj: '444', comp: '2026-10', contagem: { emitidas: { CFe: 3 }, recebidas: {} } },   // só CF-e: não olha
  ];
  const deps = {
    itens, memoria: memB,
    lerResumo: async (codigo, comp) => { lidos.push(codigo + '_' + comp); return resumos[codigo + '_' + comp] || null; },
    baixar: async (cnpj, comp, tipos) => { baixados.push([cnpj, comp, tipos]); return portal[cnpj + '_' + comp] || []; },
    pedir: async (it, novas) => { pedidos.push([it.codigo, it.comp, novas]); },
    pararTudo: err => /login/.test(err.message),
  };
  let r = await S.procurarCancelamentos(deps);
  igual('madrugada: leu o resumo uma vez de cada mês com nota', lidos, ['380_2026-10', '152_2026-10', '475_2026-11']);
  igual('madrugada: baixou pelo portal só os meses já baixados, com os tipos com nota', baixados, [['111', '2026-10', ['NF-e']], ['222', '2026-10', ['NF-e']]]);
  igual('madrugada: pediu o mês de novo só por causa do cancelamento novo', pedidos, [['380', '2026-10', [CH2]]]);
  igual('madrugada: os números', [r.olhados, r.pedidos, r.novos, r.semDownload, r.erros, r.parou], [2, 1, 1, 1, 0, '']);

  // a segunda noite: o pedido gravou no Drive e anotou (o que o atenderUm faz); nada é lido do banco e nada é pedido
  memB.anotar('380', '2026-10', S.cancelamentosDe(portal['111_2026-10']));
  lidos.length = 0; baixados.length = 0; pedidos.length = 0;
  r = await S.procurarCancelamentos(deps);
  igual('2ª noite: o banco não é lido', lidos, []);
  igual('2ª noite: o mês sem download não é baixado pelo portal', baixados.map(b => b[0]), ['111', '222']);
  igual('2ª noite: nada novo, nada pedido', [pedidos, r.pedidos], [[], 0]);

  // o fornecedor cancelou mais uma nota: aparece de novo
  portal['222_2026-10'] = arq([nfe(CH2, FORN, CLI, 202), canc2]);
  pedidos.length = 0;
  r = await S.procurarCancelamentos(deps);
  igual('cancelamento novo de uma recebida: o mês é pedido', pedidos, [['152', '2026-10', [CH2]]]);

  // o portal pediu login: para tudo; outro erro: segue para o próximo
  let chamadas = 0;
  r = await S.procurarCancelamentos(Object.assign({}, deps, { baixar: async () => { chamadas++; throw new Error('o portal do SIEG pediu login de novo'); } }));
  igual('sem login no portal: para na primeira', [chamadas, r.parou, r.olhados], [1, 'o portal do SIEG pediu login de novo', 0]);
  chamadas = 0;
  const avisos = [];
  r = await S.procurarCancelamentos(Object.assign({}, deps, { log: (...a) => avisos.push(a.join(' ')), baixar: async () => { chamadas++; throw new Error('o portal do SIEG respondeu 500'); } }));
  igual('outro erro: segue para o próximo e conta', [chamadas, r.erros, avisos.length], [2, 2, 2]);
  r = await S.procurarCancelamentos(Object.assign({}, deps, { deveParar: () => true }));
  igual('pausado pela Central dos robôs: nem começa', [r.parou, r.olhados], ['pausado', 0]);

  // ---------- a pasta CANCELADAS no Drive (o que já foi arquivado não é gravado de novo) ----------
  const raiz = path.join(tmp, 'drive');
  const regime = path.join(raiz, '2026', '380 - LEONARDO', 'FISCAL', 'LUCRO PRESUMIDO');
  const escrever = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
  // o fiscal por mês (11/11/2026): o XML em 14. XML\NF-e\10, a cancelada em 03. DOCUMENTOS FISCAIS\10\RECEBIDOS\CANCELADAS; e o
  // arquivado antes, sem a pasta do mês (EMITIDOS\CANCELADAS)
  escrever(path.join(regime, '14. XML', 'NF-e', '10', '10-2026_NF-e_101.xml'), nfe(CH1, CLI, FORN, 101).replace('2026-09-05', '2026-10-05'));
  escrever(path.join(regime, '03. DOCUMENTOS FISCAIS', 'EMITIDOS', 'CANCELADAS', '08-10-2026 - CANCELAMENTO NF-e 101.xml'), canc1);
  escrever(path.join(regime, '03. DOCUMENTOS FISCAIS', '10', 'RECEBIDOS', 'CANCELADAS', '09-10-2026 - CANCELAMENTO NF-e 202.xml'), canc2);
  escrever(path.join(regime, '03. DOCUMENTOS FISCAIS', 'RECEBIDOS', 'CANCELADAS', '01-09-2026 - CANCELAMENTO NF-e 7.xml'), cancCte);   // de antes do mês: não é lido
  escrever(path.join(regime, '03. DOCUMENTOS FISCAIS', 'EMITIDOS', 'CANCELADAS', '08-10-2026 - CANCELAMENTO NF-e 101 - X.pdf'), '%PDF');
  const g = await S.xmlsJaNoDrive('380', 'LEONARDO', '2026-10', null);
  igual('Drive pelo G:: as canceladas de EMITIDOS e RECEBIDOS contam como já salvas', [...g.nomes].sort(), [sx.nomeDoArquivo(nfe(CH1, CLI, FORN, 101).replace('2026-09-05', '2026-10-05')), sx.nomeDoArquivo(canc1), sx.nomeDoArquivo(canc2)].sort());

  // o mesmo pelo mapa do Drive (driveIndice), sem listar o G:
  const it = (i, p, n, t) => ({ i, p, n, t });
  const itensMapa = [
    it('f', 'c', 'FISCAL', 'd'), it('r', 'f', 'LUCRO PRESUMIDO', 'd'), it('x', 'r', '14. XML', 'd'), it('d', 'r', '03. DOCUMENTOS FISCAIS', 'd'),
    it('e', 'd', 'EMITIDOS', 'd'), it('ec', 'e', 'CANCELADAS', 'd'), it('a1', 'ec', '08-10-2026 - CANCELAMENTO NF-e 101.xml', 'f'),
    it('m', 'd', '10', 'd'), it('v', 'm', 'RECEBIDOS', 'd'), it('vc', 'v', 'CANCELADAS', 'd'), it('a2', 'vc', '09-10-2026 - CANCELAMENTO NF-e 202.xml', 'f'),
  ];
  const doc = dados => ({ get: async () => ({ data: () => dados, exists: true }), collection: () => ({ get: async () => ({ docs: [{ data: () => ({ itens: itensMapa }) }] }) }) });
  const db = { collection: () => ({ doc: id => (id === 'raiz' ? doc({ pastaNome: '2026', clientes: [{ codigo: 380, id: 'c', nomePasta: '380 - LEONARDO' }] }) : doc({})) }) };
  const g2 = await S.xmlsJaNoDrive('380', 'LEONARDO', '2026-10', db);
  igual('Drive pelo mapa: as canceladas contam como já salvas', [...g2.nomes].sort(), [sx.nomeDoArquivo(canc1), sx.nomeDoArquivo(canc2)].sort());

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(falhas ? falhas + ' FALHA(S) em ' + total + ' verificações' : 'OK - ' + total + ' verificações');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
