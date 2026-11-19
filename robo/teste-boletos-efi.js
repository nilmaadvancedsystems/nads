// Testes do boleto do Efí (boletos-efi.js) sem chamar o banco: respostas de exemplo do Efí (token e boleto em um passo),
// um PDF de mentira e um Firestore de mentira em memória.   node teste-boletos-efi.js
'use strict';
const { contaDeCobranca, pedidosDosContratos, atenderPedidos, soltarPresos } = require('./boletos-efi');
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

  console.log(falhas ? falhas + ' de ' + total + ' FALHARAM' : 'boletos do Efí: ' + total + ' testes ok');
  process.exit(falhas ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
