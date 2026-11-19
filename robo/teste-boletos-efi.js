// Testes do boleto do Efí (boletos-efi.js) sem chamar o banco: respostas de exemplo do Efí (token e boleto em um passo),
// um PDF de mentira e um Firestore de mentira em memória.   node teste-boletos-efi.js
'use strict';
const { contaDeCobranca, pedidosDosContratos, atenderPedidos, consultarPagamentos, soltarPresos } = require('./boletos-efi');
const { lerConfig } = require('./extrato-pela-api');

let total = 0, falhas = 0;
const igual = (nome, a, b) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) { falhas++; console.log('FALHOU ', nome, JSON.stringify(a), '≠', JSON.stringify(b)); } };

// ─── um Firestore de mentira, por caminho ("colecao/doc/sub/doc") ────────────────────────────────────────────────────
function bancoFalso(inicial) {
  const docs = new Map(Object.entries(JSON.parse(JSON.stringify(inicial || {}))));
  const ref = caminho => ({
    id: caminho.split('/').pop(), caminho,
    get: async () => snap(caminho),
    set: async d => { docs.set(caminho, d && d.dados && Buffer.isBuffer(d.dados) ? { dados: d.dados } : JSON.parse(JSON.stringify(d))); },
    update: async campos => {
      if (!docs.has(caminho)) throw new Error('não existe: ' + caminho);
      const d = docs.get(caminho);
      for (const [k, v] of Object.entries(campos)) {
        const partes = k.split('.');
        let o = d;
        for (const p of partes.slice(0, -1)) { if (!o[p] || typeof o[p] !== 'object') o[p] = {}; o = o[p]; }
        o[partes.at(-1)] = JSON.parse(JSON.stringify(v));
      }
    },
    collection: n => colecao(caminho + '/' + n),
  });
  const snap = caminho => ({ id: caminho.split('/').pop(), ref: ref(caminho), exists: docs.has(caminho), data: () => docs.get(caminho) });
  const colecao = c => ({ doc: id => ref(c + '/' + id) });
  return {
    docs,
    collection: colecao,
    runTransaction: async fn => fn({ get: r => r.get(), update: (r, campos) => r.update(campos) }),
    lista: c => [...docs.keys()].filter(k => k.startsWith(c + '/') && k.split('/').length === 2).map(snap),
  };
}

const RESPOSTA_DO_BOLETO = { code: 200, data: {
  charge_id: 4321, status: 'waiting', total: 85000, expire_at: '2026-11-10',
  barcode: '36490.00019 00000.000000 00000.000000 1 99990000085000',
  pix: { qrcode: '00020101021226830014BR.GOV.BCB.PIX', qrcode_image: 'data:image/svg+xml;base64,AAA' },
  link: 'https://pagamento.efipay.com.br/x', billet_link: 'https://boleto.efipay.com.br/x', pdf: { charge: 'https://download.efipay.com.br/x.pdf' },
} };
function pedirFalso(chamadas, resposta = RESPOSTA_DO_BOLETO) {
  return async p => {
    chamadas.push({ metodo: p.metodo, url: p.url, corpo: p.corpo ? JSON.parse(p.corpo) : null, auth: (p.cabecalhos || {}).Authorization, comCertificado: !!p.pfx });
    const json = (o, status = 200) => ({ status, corpo: Buffer.from(JSON.stringify(o)) });
    if (/\/v1\/authorize$/.test(p.url)) return json({ access_token: 'tk-cob', refresh_token: 'r', expires_in: 600 });
    if (/\/v1\/charge\/one-step$/.test(p.url)) return typeof resposta === 'function' ? resposta() : json(resposta);
    return json({ erro: 'não achei' }, 404);
  };
}
const PDF = Buffer.from('%PDF-1.4 boleto de mentira');
const lerSegredo = async n => ({ 'financeiro-efi-p12': Buffer.from('p12').toString('base64') })[n] || null;
const config = amb => lerConfig(JSON.stringify([
  { banco: 'sicoob', contaBancaria: 's', clientId: 'a', numeroConta: '1', tokenFixo: 't' },
  { banco: 'efi', contaBancaria: 'efi-1-998877', ambiente: amb, cobranca: true, clientId: 'eid', clientSecret: 'esecret', certificado: 'financeiro-efi-p12' },
])).contas;

const pedido = (mais = {}) => Object.assign({ status: 'pedido', valor: 850, vencimento: '2026-11-10', destinatarios: ['financeiro@alfa.com.br'], pedidoEm: '2026-11-19T10:00:00Z', pedidoPor: 'Vitor' }, mais);
const inicial = () => ({
  'config/boletoEfi': { multa: 2, jurosAoMes: 1, diaPadrao: 10 },
  'financeiroHonorarios/h1': { clienteId: '', codigo: '101', nome: 'ALFA COMERCIO EXEMPLO LTDA', cnpj: '11222333000181', valor: 850, ativo: true,
    boletosEfi: { '2026-10': pedido(), '2026-09': pedido({ status: 'emitido', chargeId: 1, linha: '1' }) } },
  'financeiroHonorarios/h2': { clienteId: '', codigo: '102', nome: 'BETA SERVICOS EXEMPLO LTDA', cnpj: '12345678909', valor: 420, ativo: true },
});

(async () => {
  // ── a conta que emite ──
  igual('conta: a do Efí marcada, com o endereço de homologação', [contaDeCobranca(config('homologacao')).contaBancaria, contaDeCobranca(config('homologacao')).urlCobrancas], ['efi-1-998877', 'https://cobrancas-h.api.efipay.com.br']);
  igual('conta: produção', contaDeCobranca(config('producao')).urlCobrancas, 'https://cobrancas.api.efipay.com.br');
  igual('conta: sem Efí, nada', contaDeCobranca(config('producao').filter(c => c.banco === 'sicoob')), null);

  // ── os pedidos ──
  const db0 = bancoFalso(inicial());
  igual('pedidos: só o "pedido" (o emitido fica)', pedidosDosContratos(db0.lista('financeiroHonorarios')).map(p => [p.contratoId, p.competencia]), [['h1', '2026-10']]);

  // ── produção: emite, baixa o PDF e cria o boleto em Financeiro › Boletos ──
  const db = bancoFalso(inicial());
  const chamadas = [], baixados = [];
  const feitos = await atenderPedidos({ db, conta: contaDeCobranca(config('producao')), docs: db.lista('financeiroHonorarios'), pedir: pedirFalso(chamadas), baixar: async u => { baixados.push(u); return PDF; }, lerSegredo, agora: () => '2026-11-19T10:01:00Z' });
  igual('produção: um emitido', feitos.map(x => [x.contratoId, x.competencia, x.status, x.chargeId]), [['h1', '2026-10', 'emitido', 4321]]);
  igual('produção: token e boleto no endereço de produção, com o certificado', chamadas.map(c => [c.metodo, c.url, c.comCertificado]), [
    ['POST', 'https://cobrancas.api.efipay.com.br/v1/authorize', true], ['POST', 'https://cobrancas.api.efipay.com.br/v1/charge/one-step', true]]);
  igual('produção: Basic com o client id e secret; depois o Bearer', [Buffer.from(chamadas[0].auth.slice(6), 'base64').toString(), chamadas[1].auth], ['eid:esecret', 'Bearer tk-cob']);
  const corpo = chamadas[1].corpo;
  igual('produção: o corpo do boleto com a multa e os juros de config/boletoEfi', [corpo.items[0].value, corpo.payment.banking_billet.expire_at, corpo.payment.banking_billet.configurations, corpo.payment.banking_billet.customer.juridical_person.cnpj, corpo.metadata.custom_id],
    [85000, '2026-11-10', { fine: 200, interest: 33 }, '11222333000181', 'h1_2026-10']);
  const b = db.docs.get('financeiroHonorarios/h1').boletosEfi['2026-10'];
  igual('produção: o contrato com o resultado', [b.status, b.ambiente, b.chargeId, b.linha, b.pix, b.link, b.boletoId, b.emitidoEm, b.pedidoPor, 'erro' in b], [
    'emitido', 'producao', 4321, '36490000190000000000000000000000199990000085000', '00020101021226830014BR.GOV.BCB.PIX', 'https://boleto.efipay.com.br/x', 'efi_4321', '2026-11-19T10:01:00Z', 'Vitor', false]);
  igual('produção: baixou o PDF do link do Efí', baixados, ['https://download.efipay.com.br/x.pdf']);
  const lb = db.docs.get('financeiroBoletos/efi_4321');
  igual('produção: o boleto em Financeiro › Boletos, pronto para o disparo', [lb.competencia, lb.arquivo, lb.contratoId, lb.linha, lb.valor, lb.vencimento, lb.destinatarios, lb.partes, lb.tamanho, lb.criadoPor, 'envio' in lb], [
    '2026-10', 'Boleto 101 10-2026.pdf', 'h1', '36490000190000000000000000000000199990000085000', 850, '2026-11-10', ['financeiro@alfa.com.br'], 1, PDF.length, 'Robô (Efí)', false]);
  igual('produção: o PDF nos pedaços', db.docs.get('financeiroBoletos/efi_4321/partes/0').dados.toString(), PDF.toString());

  // ── de novo (a escuta dispara com o próprio resultado): nada a fazer ──
  const deNovo = await atenderPedidos({ db, conta: contaDeCobranca(config('producao')), docs: db.lista('financeiroHonorarios'), pedir: pedirFalso([]), baixar: async () => PDF, lerSegredo });
  igual('de novo: não emite outra vez', deNovo, []);

  // ── homologação: emite no teste, grava no contrato, não cria em Financeiro › Boletos ──
  const db2 = bancoFalso(inicial());
  const ch2 = [];
  await atenderPedidos({ db: db2, conta: contaDeCobranca(config('homologacao')), docs: db2.lista('financeiroHonorarios'), pedir: pedirFalso(ch2), baixar: async () => { throw new Error('não devia baixar'); }, lerSegredo });
  const b2 = db2.docs.get('financeiroHonorarios/h1').boletosEfi['2026-10'];
  igual('homologação: emitido de teste, sem boleto na lista', [b2.status, b2.ambiente, 'boletoId' in b2, [...db2.docs.keys()].some(k => k.startsWith('financeiroBoletos'))], ['emitido', 'homologacao', false, false]);
  igual('homologação: o endereço de homologação', ch2[1].url, 'https://cobrancas-h.api.efipay.com.br/v1/charge/one-step');

  // ── o Efí recusa: erro com o motivo ──
  const db3 = bancoFalso(inicial());
  await atenderPedidos({ db: db3, conta: contaDeCobranca(config('producao')), docs: db3.lista('financeiroHonorarios'), pedir: pedirFalso([], () => ({ status: 400, corpo: Buffer.from('{"error":"validation_error","error_description":"cnpj inválido"}') })), baixar: async () => PDF, lerSegredo });
  const b3 = db3.docs.get('financeiroHonorarios/h1').boletosEfi['2026-10'];
  igual('recusado: erro com o que o Efí disse', [b3.status, b3.erro], ['erro', 'boleto no Efí: o banco respondeu 400 ({"error":"validation_error","error_description":"cnpj inválido"})']);

  // ── o PDF não baixa: o boleto fica emitido (existe no Efí), com o aviso ──
  const db4 = bancoFalso(inicial());
  await atenderPedidos({ db: db4, conta: contaDeCobranca(config('producao')), docs: db4.lista('financeiroHonorarios'), pedir: pedirFalso([]), baixar: async () => { throw new Error('o PDF do Efí respondeu 500'); }, lerSegredo });
  const b4 = db4.docs.get('financeiroHonorarios/h1').boletosEfi['2026-10'];
  igual('sem PDF: emitido com o aviso, sem boleto na lista', [b4.status, b4.erro, 'boletoId' in b4], ['emitido', 'Emitido no Efí, mas não entrou em Financeiro › Boletos: o PDF do Efí respondeu 500', false]);

  // ── outro robô já pegou: não emite ──
  const db5 = bancoFalso(inicial());
  const docs5 = db5.lista('financeiroHonorarios');
  await db5.collection('financeiroHonorarios').doc('h1').update({ 'boletosEfi.2026-10.status': 'emitindo' });
  const ch5 = [];
  igual('já pego: nada', await atenderPedidos({ db: db5, conta: contaDeCobranca(config('producao')), docs: docs5, pedir: pedirFalso(ch5), baixar: async () => PDF, lerSegredo }), []);
  igual('já pego: nenhuma chamada ao Efí', ch5.length, 0);

  // ── o preso em "emitindo" (o robô caiu no meio) vira erro, sem emitir de novo ──
  await soltarPresos(db5.lista('financeiroHonorarios'));
  const b5 = db5.docs.get('financeiroHonorarios/h1').boletosEfi['2026-10'];
  igual('preso: vira erro pedindo para conferir no Efí', [b5.status, /confira no Efí/.test(b5.erro)], ['erro', true]);

  // ── a baixa (fase 3): a consulta de cada hora ──
  const emitido = (mais = {}) => Object.assign(pedido({ status: 'emitido', ambiente: 'producao', chargeId: 4321, linha: '1', emitidoEm: '2026-11-19T10:01:00Z' }), mais);
  const baseDaBaixa = () => {
    const i = inicial();
    i['financeiroHonorarios/h1'].boletosEfi = { '2026-10': emitido(), '2026-09': emitido({ chargeId: 4000, status: 'pago' }) };
    i['financeiroHonorarios/h2'].boletosEfi = { '2026-10': emitido({ chargeId: 5555 }), '2026-08': emitido({ chargeId: 6666, emitidoEm: '2026-03-01T10:00:00Z' }) };
    return i;
  };
  const respostas = {
    4321: { code: 200, data: { charge_id: 4321, status: 'paid', total: 85000, paid_value: 86700, payment: { method: 'banking_billet', paid_at: '2026-11-12 14:03:00' } } },
    5555: { code: 200, data: { charge_id: 5555, status: 'waiting', total: 42000 } },
  };
  const pedirCobranca = (chamadas, resp = respostas) => async p => {
    chamadas.push({ metodo: p.metodo, url: p.url, auth: (p.cabecalhos || {}).Authorization });
    if (/\/v1\/authorize$/.test(p.url)) return { status: 200, corpo: Buffer.from(JSON.stringify({ access_token: 'tk-cob' })) };
    const id = (p.url.match(/\/v1\/charge\/(\d+)$/) || [])[1];
    if (id && resp[id]) return { status: 200, corpo: Buffer.from(JSON.stringify(resp[id])) };
    return { status: 404, corpo: Buffer.from('{"error":"charge_not_found"}') };
  };
  const db6 = bancoFalso(baseDaBaixa());
  const ch6 = [];
  const b6 = await consultarPagamentos({ db: db6, conta: contaDeCobranca(config('producao')), docs: db6.lista('financeiroHonorarios'), pedir: pedirCobranca(ch6), lerSegredo, hoje: '2026-11-20', agora: () => '2026-11-20T09:00:00Z' });
  igual('baixa: consulta só os emitidos recentes (o pago e o de março ficam)', ch6.map(c => [c.metodo, c.url, c.auth]), [
    ['POST', 'https://cobrancas.api.efipay.com.br/v1/authorize', 'Basic ' + Buffer.from('eid:esecret').toString('base64')],
    ['GET', 'https://cobrancas.api.efipay.com.br/v1/charge/4321', 'Bearer tk-cob'], ['GET', 'https://cobrancas.api.efipay.com.br/v1/charge/5555', 'Bearer tk-cob']]);
  igual('baixa: o pago e o em aberto', b6.map(x => [x.contratoId, x.competencia, x.situacao]), [['h1', '2026-10', 'pago'], ['h2', '2026-10', 'aberto']]);
  const pago = db6.docs.get('financeiroHonorarios/h1').boletosEfi['2026-10'];
  igual('baixa: o boleto pago com o dia', [pago.status, pago.pagoEm, pago.chargeId], ['pago', '2026-11-12', 4321]);
  igual('baixa: o recebimento do honorário (valor e dia pagos, forma boleto)', db6.docs.get('financeiroRecebimentos/h1_2026-10'), {
    contratoId: 'h1', competencia: '2026-10', valor: 867, recebidoEm: '2026-11-12', forma: 'boleto', observacoes: 'Baixa automática pelo Efí (cobrança 4321)', por: 'Robô (Efí)', em: '2026-11-20T09:00:00Z' });
  igual('baixa: o em aberto continua emitido, sem recebimento', [db6.docs.get('financeiroHonorarios/h2').boletosEfi['2026-10'].status, db6.docs.has('financeiroRecebimentos/h2_2026-10')], ['emitido', false]);

  // o recebimento já marcado à mão não é trocado; o boleto vira pago mesmo assim
  const base7 = baseDaBaixa();
  base7['financeiroRecebimentos/h1_2026-10'] = { contratoId: 'h1', competencia: '2026-10', valor: 850, recebidoEm: '2026-11-11', forma: 'pix', por: 'Vitor', em: 'x' };
  const db7 = bancoFalso(base7);
  const b7 = await consultarPagamentos({ db: db7, conta: contaDeCobranca(config('producao')), docs: db7.lista('financeiroHonorarios'), pedir: pedirCobranca([]), lerSegredo, hoje: '2026-11-20' });
  igual('baixa: o marcado à mão fica', [db7.docs.get('financeiroRecebimentos/h1_2026-10').por, b7[0].jaEstava, db7.docs.get('financeiroHonorarios/h1').boletosEfi['2026-10'].status], ['Vitor', true, 'pago']);

  // cancelado no Efí; e um que o Efí não acha não para os outros
  const db8 = bancoFalso(baseDaBaixa());
  const b8 = await consultarPagamentos({ db: db8, conta: contaDeCobranca(config('producao')), docs: db8.lista('financeiroHonorarios'),
    pedir: pedirCobranca([], { 5555: { data: { status: 'canceled' } } }), lerSegredo, hoje: '2026-11-20' });
  igual('baixa: o que falha tem o erro e o cancelado é marcado', b8.map(x => [x.contratoId, x.situacao || null, x.erro || null]), [
    ['h1', null, 'cobrança 4321 no Efí: o banco respondeu 404 ({"error":"charge_not_found"})'], ['h2', 'cancelado', null]]);
  igual('baixa: o cancelado no contrato', db8.docs.get('financeiroHonorarios/h2').boletosEfi['2026-10'].status, 'cancelado');

  // homologação: só os boletos de teste; marca pago, mas não cria recebimento
  const base9 = baseDaBaixa();
  base9['financeiroHonorarios/h1'].boletosEfi['2026-10'].ambiente = 'homologacao';
  const db9 = bancoFalso(base9);
  const ch9 = [];
  await consultarPagamentos({ db: db9, conta: contaDeCobranca(config('homologacao')), docs: db9.lista('financeiroHonorarios'), pedir: pedirCobranca(ch9), lerSegredo, hoje: '2026-11-20' });
  igual('homologação: consulta só o de teste, no endereço de teste', ch9.filter(c => c.metodo === 'GET').map(c => c.url), ['https://cobrancas-h.api.efipay.com.br/v1/charge/4321']);
  igual('homologação: pago sem recebimento', [db9.docs.get('financeiroHonorarios/h1').boletosEfi['2026-10'].status, db9.docs.has('financeiroRecebimentos/h1_2026-10')], ['pago', false]);

  // nada para consultar: nem pede o token
  const ch10 = [];
  igual('nada a consultar: nenhuma chamada', [await consultarPagamentos({ db: bancoFalso(inicial()), conta: contaDeCobranca(config('producao')), docs: bancoFalso(inicial()).lista('financeiroHonorarios'), pedir: pedirCobranca(ch10), lerSegredo, hoje: '2026-11-20' }), ch10.length], [[], 0]);

  console.log(falhas ? falhas + ' de ' + total + ' FALHARAM' : 'boletos do Efí: ' + total + ' testes ok');
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
