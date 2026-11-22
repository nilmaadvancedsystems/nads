// Testes do sieg-ibscbs.js (21/11/2026): a conferência do IBS/CBS com respostas de exemplo da calculadora da Receita, sem
// chamar a API (um fetch falso). Rode:  node teste-sieg-ibscbs.js
const S = require('./sieg-ibscbs');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a !== b) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + a + '\n        esperado: ' + b); }
}

// dados de mentira (o repositório é público)
const CLIENTE = '12345678000195';
const chave = n => '31' + '2610' + CLIENTE + '55' + '001' + String(n).padStart(9, '0') + '1' + '12345678' + '9';
const grupo = (vIBSUF, vCBS) => '<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib><gIBSCBS><vBC>100.00</vBC>'
  + '<gIBSUF><pIBSUF>0.1000</pIBSUF><vIBSUF>' + vIBSUF + '</vIBSUF></gIBSUF><gIBSMun><pIBSMun>0.0000</pIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun>'
  + '<vIBS>' + vIBSUF + '</vIBS><gCBS><pCBS>0.9000</pCBS><vCBS>' + vCBS + '</vCBS></gCBS></gIBSCBS></IBSCBS>';
const nfe = (n, ibscbs, dh = '2026-10-05T10:00:00-03:00') => '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe' + chave(n) + '" versao="4.00">'
  + '<ide><mod>55</mod><serie>1</serie><nNF>' + n + '</nNF><dhEmi>' + dh + '</dhEmi><cMunFG>3106200</cMunFG></ide>'
  + '<emit><CNPJ>' + CLIENTE + '</CNPJ><xNome>EMITENTE</xNome><CRT>3</CRT></emit><dest><CNPJ>98765432000110</CNPJ><xNome>DESTINO</xNome></dest>'
  + '<det nItem="1"><prod><NCM>10063021</NCM><uCom>KG</uCom><qCom>1</qCom><vProd>100.00</vProd></prod><imposto>' + ibscbs + '</imposto></det>'
  + '<total><ICMSTot><vNF>100.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>';

const ARQUIVOS = [
  { nome: '1.xml', xml: nfe(1, grupo('0.10', '0.90')) },           // certa
  { nome: '2.xml', xml: nfe(2, grupo('0.50', '0.90')) },           // IBS da UF errado
  { nome: '3.xml', xml: nfe(3, '') },                               // sem o grupo
  { nome: '4.xml', xml: nfe(4, grupo('0.10', '0.90')) },           // cancelada: fica fora
  { nome: '5.xml', xml: nfe(5, grupo('0.10', '0.90'), '2025-12-30T10:00:00-03:00') }, // 2025: fica fora
  { nome: 'ev.xml', xml: '<procEventoNFe><tpEvento>110111</tpEvento></procEventoNFe>' },
];

// a resposta de exemplo da calculadora (o formato de docs/exemplos.md do regime regular): sempre 0,10 de IBS UF e 0,90 de CBS
const CALCULADO = {
  IBSCBS: { CST: '000', cClassTrib: '000001', gIBSCBS: { vBC: '100.00', gIBSUF: { pIBSUF: '0.10', vIBSUF: '0.10' }, gIBSMun: { pIBSMun: '0.00', vIBSMun: '0.00' }, vIBS: '0.10', gCBS: { pCBS: '0.90', vCBS: '0.90' } } },
};

/** um fetch falso: a calculadora no ar, com as rotas que o robô usa; pedidos anotados em `vistos` */
function fetchFalso({ foraDoAr = false, operacao422 = '', xsd422 = '' } = {}) {
  const vistos = [];
  const resposta = (status, corpo) => ({ status, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) });
  const buscar = async (url, op) => {
    if (foraDoAr) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    const rota = url.replace(S.URL_PADRAO, '');
    vistos.push(op.method + ' ' + rota);
    if (rota === '/calculadora/dados-abertos/versao') return resposta(200, { versaoApp: '1.7.2', versaoDb: '2026.11' });
    if (rota.startsWith('/calculadora/xml/validate')) return xsd422 ? resposta(422, { status: 422, title: 'Erro de validação de XML', detail: xsd422 }) : resposta(200, 'true');
    if (rota === '/calculadora/observabilidade/regime-geral') {
      if (operacao422) return resposta(422, { status: 422, detail: operacao422 });
      const o = JSON.parse(op.body);
      return resposta(200, { objetos: o.itens.map(i => ({ nObj: i.numero, estadoItem: 'CALCULO_SIMULADO', tribCalc: CALCULADO })) });
    }
    return resposta(404, '');
  };
  return { buscar, vistos };
}

(async () => {
  // ---- o mês com a calculadora no ar ----
  const f = fetchFalso();
  const calc = S.criarCalculadora({ buscar: f.buscar });
  igual('versão da calculadora', await calc.versao(), '1.7.2 · base 2026.11');
  const andou = [];
  const r = await S.conferirMes({ arquivos: ARQUIVOS, cnpj: CLIENTE, canceladas: [chave(4)], calc, aoAndar: (i, n) => andou.push(i + '/' + n), agora: () => new Date('2026-11-21T12:00:00Z') });
  igual('contagem das emitidas', r.emitidas, { conferidas: 2, certas: 1, divergentes: 1, semGrupo: 1, naoConferidas: 0, baseDiferente2026: 0 });
  igual('nada recebido', r.recebidas.conferidas, 0);
  igual('só a divergente na lista', r.notas.map(n => n.numero), ['2']);
  igual('o campo divergente', r.notas[0].divergencias, [
    { item: 1, campo: 'IBS da UF', naNota: '0,50', calculadora: '0,10' },
    { item: 1, campo: 'IBS (total do item)', naNota: '0,50', calculadora: '0,10' },
  ]);
  igual('a versão e a hora no resumo', [r.versao, r.em], ['1.7.2 · base 2026.11', '2026-11-21T12:00:00.000Z']);
  igual('o andamento nota a nota', andou, ['1/3', '2/3', '3/3']);
  // a nota sem grupo não vai para a calculadora; as outras vão validar e calcular
  igual('pedidos à calculadora', f.vistos.filter(v => v.startsWith('POST')).length, 4);
  igual('a validação vai como grupo da NF-e', f.vistos.includes('POST /calculadora/xml/validate?tipo=nfe&subtipo=grupo'), true);

  // ---- fora do ar: null, sem gravar, e o aviso uma vez só ----
  const fora = S.criarCalculadora({ buscar: fetchFalso({ foraDoAr: true }).buscar });
  igual('fora do ar: sem versão', await fora.versao(), null);
  igual('fora do ar: conferirMes null', await S.conferirMes({ arquivos: ARQUIVOS, cnpj: CLIENTE, calc: fora }), null);
  const gravados = [];
  const db = { collection: c => ({ doc: id => ({ update: async v => { gravados.push([c, id, Object.keys(v)]); } }) }) };
  const linhas = [];
  const log = (...m) => linhas.push(m.join(' '));
  await S.conferirEGravar({ db, id: '66_2026-10', arquivos: ARQUIVOS, cnpj: CLIENTE, calc: fora, log });
  await S.conferirEGravar({ db, id: '67_2026-10', arquivos: ARQUIVOS, cnpj: CLIENTE, calc: fora, log });
  igual('fora do ar: nada gravado', gravados, []);
  igual('fora do ar: uma linha só no registro', linhas.length, 1);

  // ---- no ar: grava no siegNotas do mês ----
  await S.conferirEGravar({ db, id: '66_2026-10', arquivos: ARQUIVOS, cnpj: CLIENTE, canceladas: [chave(4)], calc, log });
  igual('grava o ibsCbs no siegNotas', gravados, [['siegNotas', '66_2026-10', ['ibsCbs']]]);
  igual('a linha do registro', linhas[1], 'SIEG: IBS/CBS de 66_2026-10 - 2 conferidas (1 com divergência), 1 sem o grupo IBSCBS — calculadora 1.7.2 · base 2026.11');
  // mês sem nenhuma NF-e de 2026: não grava
  await S.conferirEGravar({ db, id: '68_2025-12', arquivos: [ARQUIVOS[4]], cnpj: CLIENTE, calc, log });
  igual('mês sem nota de 2026: nada gravado', gravados.length, 1);
  // o banco recusou: não lança
  const dbRuim = { collection: () => ({ doc: () => ({ update: async () => { throw new Error('documento grande demais'); } }) }) };
  igual('banco recusou: devolve null', await S.conferirEGravar({ db: dbRuim, id: '69_2026-10', arquivos: ARQUIVOS, cnpj: CLIENTE, calc, log }), null);
  igual('banco recusou: avisa', /não consegui conferir ou gravar \(documento grande demais\)/.test(linhas[linhas.length - 1]), true);

  // ---- o XSD recusou e a operação inteira recusada ----
  const xsd = S.criarCalculadora({ buscar: fetchFalso({ xsd422: 'Erro na linha 1, coluna 90: cvc-complex-type.2.4.a' }).buscar });
  const rx = await S.conferirMes({ arquivos: [ARQUIVOS[0]], cnpj: CLIENTE, calc: xsd });
  igual('XSD recusou: divergência do leiaute', rx.notas[0].divergencias[0], { item: 0, campo: 'leiaute do grupo IBSCBS (XSD)', naNota: 'Erro na linha 1, coluna 90: cvc-complex-type.2.4.a', calculadora: 'o grupo precisa seguir o leiaute' });
  const op = S.criarCalculadora({ buscar: fetchFalso({ operacao422: 'Município 3106200 não encontrado' }).buscar });
  const ro = await S.conferirMes({ arquivos: [ARQUIVOS[0]], cnpj: CLIENTE, calc: op });
  igual('operação recusada: não conferida, com o motivo', [ro.emitidas.naoConferidas, ro.notas.length], [1, 0]);
  const unica = await S.conferirMes({ arquivos: [ARQUIVOS[0]], cnpj: CLIENTE, calc: op });
  igual('operação recusada: o motivo chega ao item', unica.emitidas, { conferidas: 0, certas: 0, divergentes: 0, semGrupo: 0, naoConferidas: 1, baseDiferente2026: 0 });

  // ---- o motivo da resposta de erro ----
  igual('motivo: detail do problem', S.motivoDaResposta('{"title":"t","detail":"d"}'), 'd');
  igual('motivo: texto cru', S.motivoDaResposta('erro qualquer'), 'erro qualquer');

  console.log(falhas ? falhas + ' de ' + total + ' falharam' : 'ok: ' + total + ' testes');
  process.exit(falhas ? 1 : 0);
})();
