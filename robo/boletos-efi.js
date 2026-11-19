// O boleto dos honorários pelo Efí (19/11/2026, fase 2 das APIs dos bancos): boleto com o QR do Pix ("bolix"), emitido
// quando alguém aperta Emitir boleto em nads › Financeiro › Honorários. Roda no robô da nuvem (vigia-robo.js):
//
//   1. a tela grava o pedido no contrato: financeiroHonorarios/{id}.boletosEfi.{AAAA-MM} = { status: 'pedido', valor,
//      vencimento, destinatarios, pedidoEm, pedidoPor } (a regra é a do core, financeiro/boletoEfi.ts);
//   2. aqui: pega o pedido ('pedido' -> 'emitindo', numa transação: dois robôs não emitem o mesmo), emite no Efí
//      (POST /v1/charge/one-step, a API de Cobranças) com a multa e os juros de config/boletoEfi, e grava 'emitido' com a
//      linha digitável, o Pix copia e cola e o link — ou 'erro' com o motivo;
//   3. em produção, baixa o PDF do Efí e cria o boleto em Financeiro › Boletos (financeiroBoletos/{id}, com os pedaços em
//      .../partes/{n}), já com o cliente e os e-mails: de lá o Diretor dispara e o boletos-financeiro.js manda.
//
// A conta do Efí é a do metadado financeiro-bancos (extrato-pela-api.js) com "cobranca": true. Na homologação o boleto é
// de teste: grava o resultado no contrato (a tela mostra "Boleto de teste"), mas não cria nada em Financeiro › Boletos.
// Sem a conta, o módulo não faz nada (nem escuta o banco).
//
// O que ficou 'emitindo' (o robô caiu no meio) não é emitido de novo sozinho: vira erro pedindo para conferir no Efí, porque
// a cobrança pode ter sido criada lá.
//
// A baixa (fase 3, 19/11/2026, decisão do dono: consulta a cada hora, sem webhook — nada de porta aberta na máquina): a cada
// hora o robô pergunta ao Efí (GET /v1/charge/:id) pelos boletos 'emitido' dos últimos 120 dias. O pago vira 'pago' (com o
// dia) e, em produção, o recebimento do honorário em financeiroRecebimentos/{contrato}_{AAAA-MM} (forma boleto ou Pix, o
// valor e o dia pagos; o que já estava marcado à mão não é trocado). O cancelado no Efí vira 'cancelado'. Na homologação
// marca o boleto de teste como pago, mas não cria recebimento.
'use strict';

const f = require('./gerado/financeiro');
const api = require('./extrato-pela-api');

const URLS_DE_COBRANCA = { producao: 'https://cobrancas.api.efipay.com.br', homologacao: 'https://cobrancas-h.api.efipay.com.br' };
const TAMANHO_DA_PARTE = 900 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const QUEM = 'Robô (Efí)';

/** A conta do Efí que emite (a com "cobranca": true; com uma conta Efí só, ela). null = não emite. */
function contaDeCobranca(contas) {
  const efi = (contas || []).filter(c => c.banco === 'efi');
  const marcada = efi.find(c => c.cobranca === true);
  const conta = marcada || (efi.length === 1 && efi[0].cobranca !== false ? efi[0] : null);
  if (!conta) return null;
  return Object.assign({}, conta, { urlCobrancas: (conta.urls && conta.urls.cobrancas) || URLS_DE_COBRANCA[conta.ambiente] });
}

/** Os pedidos de boleto ('pedido') dos contratos: [{ ref, contratoId, competencia, contrato, boleto }] */
function pedidosDosContratos(docs) {
  const out = [];
  for (const d of docs) {
    const dados = d.data() || {};
    const boletos = f.boletosEfiDoBanco(dados.boletosEfi) || {};
    for (const [competencia, boleto] of Object.entries(boletos)) {
      if (boleto.status === 'pedido') out.push({ ref: d.ref, contratoId: d.id, competencia, contrato: Object.assign({ id: d.id }, dados), boleto });
    }
  }
  return out.sort((a, b) => a.boleto.pedidoEm.localeCompare(b.boleto.pedidoEm));
}

/** Os que ficaram 'emitindo' (o robô caiu no meio): [{ ref, competencia }] */
function presosDosContratos(docs) {
  const out = [];
  for (const d of docs) {
    const boletos = f.boletosEfiDoBanco((d.data() || {}).boletosEfi) || {};
    for (const [competencia, b] of Object.entries(boletos)) if (b.status === 'emitindo') out.push({ ref: d.ref, competencia, boleto: b });
  }
  return out;
}

/** Pega o pedido para si: 'pedido' -> 'emitindo'. false = outro já pegou (ou mudou). */
async function pegar(db, ref, competencia) {
  return db.runTransaction(async t => {
    const s = await t.get(ref);
    const b = (f.boletosEfiDoBanco((s.data() || {}).boletosEfi) || {})[competencia];
    if (!b || b.status !== 'pedido') return false;
    t.update(ref, { ['boletosEfi.' + competencia + '.status']: 'emitindo' });
    return true;
  });
}

/** O PDF do boleto, do link do Efí (um GET simples; sem o certificado). */
async function baixarPdf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('o PDF do Efí respondeu ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

/** O boleto em Financeiro › Boletos, com o PDF em pedaços; devolve o id. */
async function criarNaListaDeBoletos(db, { contrato, competencia, boleto, emitido, pdf, agora }) {
  const partes = [];
  for (let i = 0; i < pdf.length; i += TAMANHO_DA_PARTE) partes.push(pdf.subarray(i, Math.min(i + TAMANHO_DA_PARTE, pdf.length)));
  const ref = db.collection('financeiroBoletos').doc('efi_' + emitido.chargeId);
  const nome = 'Boleto ' + (contrato.codigo || contrato.id) + ' ' + competencia.slice(5) + '-' + competencia.slice(0, 4) + '.pdf';
  for (let i = 0; i < partes.length; i++) await ref.collection('partes').doc(String(i)).set({ dados: partes[i] });
  await ref.set({
    competencia, arquivo: nome, contratoId: contrato.id, achadoPor: 'documento', linha: emitido.linha, valor: boleto.valor, vencimento: boleto.vencimento,
    destinatarios: boleto.destinatarios.slice(0, 10), tamanho: pdf.length, partes: partes.length,
    criadoEm: agora, criadoPor: QUEM, criadoPorUid: 'robo', origem: 'efi', chargeId: emitido.chargeId,
  });
  return ref.id;
}

/** O token da API de Cobranças do Efí (Basic com o client id e o secret, e o certificado quando tiver). */
async function tokenDasCobrancas(conta, pedir, cert) {
  const basic = Buffer.from(conta.clientId + ':' + conta.clientSecret).toString('base64');
  const tok = api.jsonDe(await pedir({ metodo: 'POST', url: conta.urlCobrancas + '/v1/authorize', cabecalhos: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/json' }, corpo: JSON.stringify({ grant_type: 'client_credentials' }), ...cert }), 'token das cobranças do Efí');
  if (!tok.access_token) throw new Error('token das cobranças do Efí: a resposta veio sem access_token');
  return tok.access_token;
}

/** Emite um pedido já pego: grava 'emitido' (com o boleto em Financeiro › Boletos, em produção) ou 'erro'. */
async function emitirUm({ db, conta, pedir, baixar, lerSegredo, cfg, pedido, log, agora }) {
  const { ref, competencia, contrato, boleto } = pedido;
  const campo = 'boletosEfi.' + competencia;
  try {
    const cert = await api.certificadoDa(conta, lerSegredo);
    const tok = { access_token: await tokenDasCobrancas(conta, pedir, cert) };
    const corpo = JSON.stringify(f.corpoDoBolix(contrato, competencia, boleto, cfg));
    const emitido = f.lerBolixEmitido(api.jsonDe(await pedir({ metodo: 'POST', url: conta.urlCobrancas + '/v1/charge/one-step', cabecalhos: { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' }, corpo, ...cert }), 'boleto no Efí'));
    const resultado = Object.assign({}, boleto, {
      status: 'emitido', ambiente: conta.ambiente, chargeId: emitido.chargeId, linha: emitido.linha, emitidoEm: agora(),
      ...(emitido.pix ? { pix: emitido.pix } : {}), ...(emitido.link ? { link: emitido.link } : {}),
    });
    if (conta.ambiente === 'producao') {
      try {
        if (!emitido.pdf) throw new Error('o Efí não mandou o link do PDF');
        const pdf = await baixar(emitido.pdf);
        if (!pdf.length || pdf.length > MAX_PDF) throw new Error('o PDF do Efí veio vazio ou grande demais');
        resultado.boletoId = await criarNaListaDeBoletos(db, { contrato, competencia, boleto, emitido, pdf, agora: agora() });
      } catch (err) {
        // o boleto existe no Efí: fica emitido, com o aviso de que não foi para Financeiro › Boletos
        resultado.erro = 'Emitido no Efí, mas não entrou em Financeiro › Boletos: ' + err.message;
      }
    }
    await ref.update({ [campo]: resultado });
    log('boleto do Efí' + (conta.ambiente === 'producao' ? '' : ' (homologação)') + ': ' + contrato.nome + ' ' + competencia + ' — cobrança ' + emitido.chargeId);
    return resultado;
  } catch (err) {
    await ref.update({ [campo]: Object.assign({}, boleto, { status: 'erro', erro: err.message }) }).catch(() => {});
    log('boleto do Efí: ' + contrato.nome + ' ' + competencia + ' falhou: ' + err.message);
    return Object.assign({}, boleto, { status: 'erro', erro: err.message });
  }
}

/** Atende os pedidos dos contratos (uma rodada): pega cada um e emite, um de cada vez. */
async function atenderPedidos({ db, conta, docs, pedir = api.pedirHttps, baixar = baixarPdf, lerSegredo = api.lerMetadado, log = () => {}, agora = () => new Date().toISOString() }) {
  const pedidos = pedidosDosContratos(docs);
  if (!pedidos.length) return [];
  const cfg = f.configDoBoletoDoBanco((await db.collection('config').doc('boletoEfi').get()).data());
  const feitos = [];
  for (const p of pedidos) {
    if (!(await pegar(db, p.ref, p.competencia))) continue;
    feitos.push(Object.assign({ contratoId: p.contratoId, competencia: p.competencia }, await emitirUm({ db, conta, pedir, baixar, lerSegredo, cfg, pedido: p, log, agora })));
  }
  return feitos;
}

/**
 * A baixa (uma rodada): pergunta ao Efí por cada boleto emitido e grava o que mudou. Um que falha não para os outros.
 * -> [{ contratoId, competencia, situacao, erro? }]
 */
async function consultarPagamentos({ db, conta, docs, pedir = api.pedirHttps, lerSegredo = api.lerMetadado, log = () => {}, hoje, agora = () => new Date().toISOString() }) {
  const porId = new Map(docs.map(d => [d.id, d]));
  const contratos = docs.map(d => ({ id: d.id, boletosEfi: f.boletosEfiDoBanco((d.data() || {}).boletosEfi) }));
  // só os da conta deste ambiente (o de teste não é consultado na produção, nem o contrário)
  const lista = f.boletosParaConsultar(contratos, hoje).filter(x => (x.boleto.ambiente || 'producao') === conta.ambiente);
  if (!lista.length) return [];
  const cert = await api.certificadoDa(conta, lerSegredo);
  const token = await tokenDasCobrancas(conta, pedir, cert);
  const feitos = [];
  for (const x of lista) {
    const r = { contratoId: x.contratoId, competencia: x.competencia };
    try {
      const c = f.lerCobrancaDoEfi(api.jsonDe(await pedir({ metodo: 'GET', url: conta.urlCobrancas + '/v1/charge/' + x.boleto.chargeId, cabecalhos: { Authorization: 'Bearer ' + token }, ...cert }), 'cobrança ' + x.boleto.chargeId + ' no Efí'));
      r.situacao = c.situacao;
      if (c.situacao === 'aberto') { feitos.push(r); continue; }
      const ref = porId.get(x.contratoId).ref;
      const campo = 'boletosEfi.' + x.competencia;
      if (c.situacao === 'cancelado') {
        await ref.update({ [campo]: Object.assign({}, x.boleto, { status: 'cancelado' }) });
        log('boleto do Efí cancelado: ' + x.contratoId + ' ' + x.competencia);
        feitos.push(r);
        continue;
      }
      if (conta.ambiente === 'producao') {
        const id = x.contratoId + '_' + x.competencia;
        const recRef = db.collection('financeiroRecebimentos').doc(id);
        // o recebimento já marcado à mão fica como está
        if (!(await recRef.get()).exists) await recRef.set(f.recebimentoDaBaixa(x.contratoId, x.competencia, x.boleto, c, hoje, QUEM, agora()));
        else r.jaEstava = true;
      }
      await ref.update({ [campo]: Object.assign({}, x.boleto, { status: 'pago', pagoEm: c.pagoEm || hoje }) });
      log('boleto do Efí pago' + (conta.ambiente === 'producao' ? '' : ' (homologação)') + ': ' + x.contratoId + ' ' + x.competencia + (c.valor != null ? ' R$ ' + c.valor.toFixed(2) : ''));
    } catch (err) {
      r.erro = err.message;
      log('baixa do boleto do Efí ' + x.contratoId + ' ' + x.competencia + ' falhou: ' + err.message);
    }
    feitos.push(r);
  }
  return feitos;
}

/** O que ficou 'emitindo' vira erro (sem emitir de novo: pode já existir no Efí). */
async function soltarPresos(docs, log = () => {}) {
  for (const p of presosDosContratos(docs)) {
    await p.ref.update({ ['boletosEfi.' + p.competencia]: Object.assign({}, p.boleto, { status: 'erro', erro: 'O robô reiniciou no meio da emissão: confira no Efí se o boleto foi criado antes de pedir de novo.' }) });
    log('boleto do Efí preso em "emitindo" virou erro: ' + p.ref.id + ' ' + p.competencia);
  }
}

/** Liga no robô da nuvem: escuta os contratos e atende cada pedido novo. Sem a conta do Efí no metadado, nada. */
async function iniciarBoletosEfi(db, log, o = {}) {
  const lerSegredo = o.lerSegredo || api.lerMetadado;
  const texto = await lerSegredo('financeiro-bancos');
  const conta = texto ? contaDeCobranca(api.lerConfig(texto).contas) : null;
  if (!conta) { log('boletos do Efí: sem a conta de cobrança no metadado financeiro-bancos, desligado'); return null; }
  let primeira = true, rodando = false, deNovo = null, ultimos = null, consultando = false;
  async function rodar(docs) {
    ultimos = docs;
    if (rodando) { deNovo = docs; return; }
    rodando = true;
    try {
      if (primeira) { primeira = false; await soltarPresos(docs, log); }
      await atenderPedidos({ db, conta, docs, lerSegredo, log });
    } catch (err) { log('boletos do Efí falhou: ' + err.message); }
    finally {
      rodando = false;
      if (deNovo) { const d = deNovo; deNovo = null; rodar(d); }
    }
  }
  const pararEscuta = db.collection('financeiroHonorarios').onSnapshot(s => rodar(s.docs), err => log('boletos do Efí: a escuta caiu: ' + err.message));
  // a baixa: a cada hora, com os contratos que a escuta já trouxe (nenhuma leitura a mais do banco)
  async function baixa() {
    if (consultando || !ultimos) return;
    consultando = true;
    try { await consultarPagamentos({ db, conta, docs: ultimos, lerSegredo, log, hoje: api.agoraEmBrasilia(Date.now()).dia }); }
    catch (err) { log('baixa dos boletos do Efí falhou: ' + err.message); }
    finally { consultando = false; }
  }
  const primeiraBaixa = setTimeout(baixa, 5 * 60 * 1000);
  const relogio = setInterval(baixa, 60 * 60 * 1000);
  log('boletos do Efí ligado (' + (conta.ambiente === 'producao' ? 'produção' : 'homologação: boletos de teste') + '; baixa a cada hora)');
  return () => { pararEscuta(); clearTimeout(primeiraBaixa); clearInterval(relogio); };
}

module.exports = { contaDeCobranca, pedidosDosContratos, atenderPedidos, consultarPagamentos, soltarPresos, iniciarBoletosEfi, URLS_DE_COBRANCA };
