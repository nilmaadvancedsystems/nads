// Testes do extrato pela API (extrato-pela-api.js) sem chamar o banco: respostas de exemplo do Sicoob (JSON) e do Efí
// (token, lista e arquivo CNAB 240) e um Firestore de mentira em memória.   node teste-extrato-pela-api.js
'use strict';
const { lerConfig, rodarExtratoPelaApi, agoraEmBrasilia } = require('./extrato-pela-api');

let total = 0, falhas = 0;
const igual = (nome, a, b) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) { falhas++; console.log('FALHOU ', nome, JSON.stringify(a), '≠', JSON.stringify(b)); } };

// ─── um Firestore de mentira: só o que o módulo usa ──────────────────────────────────────────────────────────────────
function bancoFalso(inicial) {
  const cols = new Map();
  const col = n => { if (!cols.has(n)) cols.set(n, new Map()); return cols.get(n); };
  for (const [n, docs] of Object.entries(inicial || {})) for (const [id, d] of Object.entries(docs)) col(n).set(id, JSON.parse(JSON.stringify(d)));
  let novoId = 0;
  const snap = (n, id) => ({ id, exists: col(n).has(id), data: () => col(n).get(id) });
  const leituras = { n: 0 };
  const db = {
    leituras, cols,
    collection: n => ({
      doc: id => ({ _n: n, _id: id, get: async () => { leituras.n++; return snap(n, id); }, set: async d => { col(n).set(id, JSON.parse(JSON.stringify(d))); } }),
      get: async () => { const docs = [...col(n).keys()].map(id => snap(n, id)); leituras.n += docs.length; return { docs }; },
      where: (campo, op, v) => ({ get: async () => { const docs = [...col(n).keys()].filter(id => col(n).get(id)[campo] === v).map(id => snap(n, id)); leituras.n += docs.length; return { docs }; } }),
      add: async d => { const id = 'novo' + (++novoId); col(n).set(id, d); return { id }; },
    }),
    getAll: async (...refs) => { leituras.n += refs.length; return refs.map(r => snap(r._n, r._id)); },
    batch: () => { const ops = []; return { set: (r, d) => ops.push([r, d]), commit: async () => { for (const [r, d] of ops) col(r._n).set(r._id, JSON.parse(JSON.stringify(d))); } }; },
  };
  return db;
}

// ─── as respostas de exemplo ─────────────────────────────────────────────────────────────────────────────────────────
const SICOOB_NOV = {
  resultado: {
    saldoAnterior: '1000.00', saldoAtual: '1405.50',
    transacoes: [
      { tipo: 'CREDITO', valor: '500.00', data: '2026-11-10T00:00:00-03:00', descricao: 'PIX RECEBIDO', descInfComplementar: 'CLIENTE ABC' },
      { tipo: 'DEBITO', valor: '94.50', data: '2026-11-12T00:00:00-03:00', descricao: 'TARIFA PACOTE' },
    ],
  },
};
function linhaCnab(campos) {
  const l = Array.from({ length: 240 }, () => ' ');
  for (const [pos, v] of campos) for (let i = 0; i < v.length; i++) l[pos - 1 + i] = v[i];
  return l.join('');
}
const v18 = c => String(c).padStart(18, '0');
const CNAB_EFI = [
  linhaCnab([[1, '364'], [8, '0']]),
  linhaCnab([[1, '364'], [8, '1'], [53, '00001'], [59, '000000998877'], [71, '1'], [143, '01112026'], [151, v18(200000)], [169, 'C']]),
  linhaCnab([[1, '364'], [8, '3'], [14, 'E'], [143, '11112026'], [151, v18(15000)], [169, 'C'], [177, 'PIX RECEBIDO']]),
  linhaCnab([[1, '364'], [8, '3'], [14, 'E'], [143, '12112026'], [151, v18(2500)], [169, 'D'], [177, 'TARIFA']]),
  linhaCnab([[1, '364'], [8, '5'], [143, '12112026'], [151, v18(212500)], [169, 'C']]),
  linhaCnab([[1, '364'], [8, '9']]),
].join('\r\n');

function pedirFalso(chamadas) {
  return async p => {
    chamadas.push({ metodo: p.metodo, url: p.url, comCertificado: !!p.pfx, senha: p.senha || '', cabecalhos: p.cabecalhos || {} });
    const json = o => ({ status: 200, corpo: Buffer.from(JSON.stringify(o)) });
    if (/openid-connect\/token/.test(p.url)) return json({ access_token: 'tk-sicoob', expires_in: 300 });
    if (/conta-corrente\/v4\/extrato\/11\/2026/.test(p.url)) return json(SICOOB_NOV);
    if (/efipay\.com\.br\/v1\/oauth\/token/.test(p.url)) return json({ access_token: 'tk-efi', expires_in: 3600 });
    if (/extrato-cnab\/arquivos$/.test(p.url)) return json([
      { nome: 'extrato_20261112.ret', data_geracao: '2026-11-13 06:00:00', periodo_inicio: '2026-11-01', periodo_fim: '2026-11-12' },
      { nome: 'extrato_20260930.ret', data_geracao: '2026-10-01 06:00:00', periodo_inicio: '2026-09-01', periodo_fim: '2026-09-30' },
    ]);
    if (/extrato-cnab\/download\/extrato_20261112\.ret$/.test(p.url)) return { status: 200, corpo: Buffer.from(CNAB_EFI, 'latin1') };
    return { status: 404, corpo: Buffer.from('{"erro":"não achei"}') };
  };
}

const SEGREDOS = { 'financeiro-sicoob-pfx': Buffer.from('pfx-de-mentira').toString('base64'), 'financeiro-sicoob-senha': 'senha123\n', 'financeiro-efi-p12': Buffer.from('p12').toString('base64') };
const lerSegredo = async n => SEGREDOS[n] || null;

const CONTA_SICOOB = { id: 'sicoob-3144-123456', marca: 'sicoob', nome: 'Sicoob', agencia: '3144', conta: '12345-6', apelido: 'PJ' };
const CONTA_EFI = { id: 'efi-1-998877', marca: 'efi', nome: 'Efí', agencia: '0001', conta: '998877-1' };
const inicial = () => ({
  cadastro: { 'nilma-contabilidade-ltda': { nome: 'NILMA CONTABILIDADE LTDA', codigo: 284, bancos: [CONTA_SICOOB, CONTA_EFI, { id: 'velha', marca: 'sicoob', nome: 'Sicoob', ate: '2025-12' }] } },
  financeiroPlano: {
    p11: { codigo: '1.1', descricao: 'Ativo Circulante', tipo: 'ATIVO', nivel: 2, pai: null, ativo: true, movimentavel: false },
    pSicoob: { codigo: '1.1.03', descricao: 'Sicoob C/C 12345-6 (PJ)', tipo: 'ATIVO', nivel: 3, pai: 'p11', ativo: true, movimentavel: true },
  },
  // o extrato do Sicoob importado à mão até 10/11, com a linha de 5,00 desse dia
  financeiroBancoImportacoes: { arq1: { banco: 'Sicoob', contaBancaria: CONTA_SICOOB.id, de: '2026-11-01', ate: '2026-11-10', quantos: 1, arquivo: 'extrato.pdf' } },
  financeiroBanco: { manual1: { data: '2026-11-10', historico: 'PIX RECEB.OUTRA IF CLIENTE ABC', valor: 500, tipo: 'E', banco: 'Sicoob', importacao: 'arq1', contaBancaria: CONTA_SICOOB.id } },
});

(async () => {
  // ── a configuração ──
  const cfg = lerConfig(JSON.stringify([
    { banco: 'sicoob', contaBancaria: CONTA_SICOOB.id, ambiente: 'producao', clientId: 'cid', numeroConta: '123456', certificado: 'financeiro-sicoob-pfx', senha: 'financeiro-sicoob-senha' },
    { banco: 'efi', contaBancaria: CONTA_EFI.id, clientId: 'eid', clientSecret: 'segredo-que-nao-pode-aparecer', certificado: 'financeiro-efi-p12' },
    { banco: 'itau', contaBancaria: 'x' },
    { banco: 'efi', contaBancaria: 'y', clientId: 'a', clientSecret: 'segredo-que-nao-pode-aparecer' },
    { banco: 'sicoob', contaBancaria: 'z', ambiente: 'teste', clientId: 'a' },
  ]));
  igual('config: duas contas boas', cfg.contas.map(c => [c.banco, c.ambiente]), [['sicoob', 'producao'], ['efi', 'homologacao']]);
  igual('config: os erros dizem o que falta, sem repetir segredo', cfg.erros, [
    'conta 3 (x): banco precisa ser "sicoob" ou "efi"', 'conta 4 (y): falta certificado', 'conta 5 (z): ambiente precisa ser "homologacao" ou "producao"']);
  igual('config: a homologação do Efí usa o endereço de homologação', cfg.contas[1].urls.base, 'https://extratos-h.api.efipay.com.br');
  igual('config: JSON quebrado', lerConfig('{').erros, ['o metadado financeiro-bancos não é um JSON válido']);
  igual('config: o sandbox do Sicoob com token fixo dispensa o certificado',
    lerConfig(JSON.stringify([{ banco: 'sicoob', contaBancaria: 'a', clientId: 'b', numeroConta: '1', tokenFixo: 't' }])).contas.length, 1);
  const urlTrocada = lerConfig(JSON.stringify([{ banco: 'efi', contaBancaria: 'a', clientId: 'b', clientSecret: 'c', certificado: 'd', urls: { base: 'https://outro' } }])).contas[0].urls;
  igual('config: a conta troca um endereço sem perder os outros', [urlTrocada.base, urlTrocada.token], ['https://outro', '/v1/oauth/token']);

  // ── uma rodada: Sicoob em produção (grava), Efí em homologação (só simula) ──
  const db = bancoFalso(inicial());
  const chamadas = [];
  const r1 = await rodarExtratoPelaApi({ db, contas: cfg.contas, lerSegredo, pedir: pedirFalso(chamadas), hoje: '2026-11-19' });
  igual('rodada: sem erro', r1.map(r => r.erro || null), [null, null]);
  igual('sicoob: token com o certificado e a senha, e o extrato de 11/2026 até hoje', chamadas.filter(c => /sicoob/.test(c.url)).map(c => [c.metodo, c.url.replace(/\?.*/, ''), c.comCertificado, c.senha]), [
    ['POST', 'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token', true, 'senha123'],
    ['GET', 'https://api.sicoob.com.br/conta-corrente/v4/extrato/11/2026', true, 'senha123'],
  ]);
  const urlDoExtrato = new URL(chamadas[1].url);
  igual('sicoob: os parâmetros do extrato', [urlDoExtrato.searchParams.get('diaInicial'), urlDoExtrato.searchParams.get('diaFinal'), urlDoExtrato.searchParams.get('numeroContaCorrente')], ['1', '19', '123456']);
  igual('sicoob: o client_id e o token no cabeçalho', [chamadas[1].cabecalhos.client_id, chamadas[1].cabecalhos.Authorization], ['cid', 'Bearer tk-sicoob']);
  // a emenda: a linha de 10/11 (5,00) já veio no PDF; a API só acrescenta a de 12/11
  igual('sicoob: emendou no dia 10/11', [r1[0].lidas, r1[0].emendaEm, r1[0].meses], [2, '2026-11-10', [{ mes: '2026-11', linhas: 1, novas: 1, saldoFinal: 1405.5 }]]);
  const doSicoob = [...db.cols.get('financeiroBanco').entries()].filter(([, l]) => l.importacao === 'api_sicoob-3144-123456_2026-11');
  igual('sicoob: gravou a linha nova com a conta e a conta do plano', doSicoob.map(([, l]) => [l.data, l.historico, l.valor, l.tipo, l.contaBancaria, l.conta]), [
    ['2026-11-12', 'TARIFA PACOTE', 94.5, 'S', CONTA_SICOOB.id, 'pSicoob']]);
  const imp = db.cols.get('financeiroBancoImportacoes').get('api_sicoob-3144-123456_2026-11');
  igual('sicoob: a importação do mês', [imp.banco, imp.marca, imp.arquivo, imp.de, imp.ate, imp.quantos, imp.entradas, imp.saidas, imp.saldoFinal, imp.rotuloDaConta, imp.importadoPor, 'id' in imp], [
    'Sicoob', 'sicoob', 'API do Sicoob · 11/2026', '2026-11-12', '2026-11-19', 1, 0, 94.5, 1405.5, 'PJ · Ag. 3144 · C/C 12345-6', 'Robô (API do Sicoob)', false]);

  igual('efí: token, lista e só o arquivo do período (o de setembro fica)', chamadas.filter(c => /efipay/.test(c.url)).map(c => [c.metodo, c.url, c.comCertificado]), [
    ['POST', 'https://extratos-h.api.efipay.com.br/v1/oauth/token', true],
    ['GET', 'https://extratos-h.api.efipay.com.br/v1/extrato-cnab/arquivos', true],
    ['GET', 'https://extratos-h.api.efipay.com.br/v1/extrato-cnab/download/extrato_20261112.ret', true],
  ]);
  const basic = chamadas.find(c => /oauth\/token/.test(c.url) && /efipay/.test(c.url)).cabecalhos.Authorization;
  igual('efí: Basic com o client id e secret', Buffer.from(basic.slice(6), 'base64').toString(), 'eid:segredo-que-nao-pode-aparecer');
  igual('efí (homologação): leu e montou, sem gravar nada', [r1[1].lidas, r1[1].meses], [2, [{ mes: '2026-11', linhas: 2, novas: 2, saldoFinal: 2125 }]]);
  igual('efí (homologação): nenhuma linha nem importação do Efí no banco', [
    [...db.cols.get('financeiroBanco').values()].some(l => l.contaBancaria === CONTA_EFI.id),
    db.cols.get('financeiroBancoImportacoes').has('api_efi-1-998877_2026-11'),
    db.cols.get('financeiroPlano').size], [false, false, 2]);

  // ── no dia seguinte: nada novo, o resumo continua ──
  const r2 = await rodarExtratoPelaApi({ db, contas: [cfg.contas[0]], lerSegredo, pedir: pedirFalso([]), hoje: '2026-11-20' });
  igual('dia seguinte: nada novo', r2[0].meses, [{ mes: '2026-11', linhas: 1, novas: 0, saldoFinal: 1405.5 }]);
  igual('dia seguinte: o mesmo resumo, até o novo dia', (({ quantos, saidas, ate }) => [quantos, saidas, ate])(db.cols.get('financeiroBancoImportacoes').get('api_sicoob-3144-123456_2026-11')), [1, 94.5, '2026-11-20']);
  igual('dia seguinte: não duplicou', [...db.cols.get('financeiroBanco').values()].filter(l => l.contaBancaria === CONTA_SICOOB.id).length, 2);

  // ── o Efí em produção cria a conta do plano na primeira vez ──
  const db2 = bancoFalso(inicial());
  const prod = Object.assign({}, cfg.contas[1], { ambiente: 'producao' });
  const r3 = await rodarExtratoPelaApi({ db: db2, contas: [prod], lerSegredo, pedir: pedirFalso([]), hoje: '2026-11-19' });
  const novaConta = [...db2.cols.get('financeiroPlano').entries()].find(([id]) => id.startsWith('novo'));
  igual('efí (produção): criou a conta do plano 1.1.04', novaConta && [novaConta[1].codigo, novaConta[1].descricao, novaConta[1].pai], ['1.1.04', 'Efí C/C 998877-1', 'p11']);
  igual('efí (produção): gravou as duas linhas e o saldo', [r3[0].meses[0].novas, db2.cols.get('financeiroBancoImportacoes').get('api_efi-1-998877_2026-11').saldoFinal], [2, 2125]);

  // ── os erros: um não para o outro, e não vaza segredo ──
  const db3 = bancoFalso(inicial());
  const semConta = Object.assign({}, cfg.contas[0], { contaBancaria: 'velha' });
  const semCert = Object.assign({}, cfg.contas[1], { certificado: 'nao-existe' });
  const recusa = async p => (/token/.test(p.url) ? { status: 401, corpo: Buffer.from('{"error":"invalid_client"}') } : pedirFalso([])(p));
  const r4 = await rodarExtratoPelaApi({ db: db3, contas: [semConta, semCert, cfg.contas[0]], lerSegredo, pedir: recusa, hoje: '2026-11-19' });
  igual('erros: conta encerrada, certificado faltando e o banco recusando, cada um com o seu', r4.map(r => r.erro), [
    'a conta velha não está (aberta) nas contas bancárias da Nilma no Cadastro',
    'o certificado (metadado nao-existe) não está na máquina',
    'token do Sicoob: o banco respondeu 401 ({"error":"invalid_client"})',
  ]);
  igual('erros: nada gravado', db3.cols.get('financeiroBancoImportacoes').size, 1);

  // ── a hora de Brasília ──
  igual('Brasília: 02h UTC ainda é o dia anterior', agoraEmBrasilia(Date.UTC(2026, 10, 20, 2, 0)), { dia: '2026-11-19', hora: 23 });

  console.log(falhas ? falhas + ' de ' + total + ' FALHARAM' : 'extrato pela API: ' + total + ' testes ok');
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
