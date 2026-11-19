// O extrato das contas do escritório pela API do banco (19/11/2026: "ligar o Financeiro às APIs do Sicoob e do Efí, para
// ele puxar o extrato sozinho"). Uma vez por dia (a partir das 7h de Brasília) o robô da nuvem busca o mês de cada conta
// (nos primeiros dias, também o mês anterior) e grava como uma importação de extrato do Financeiro: as linhas em
// financeiroBanco (o mesmo id fixo do extrato por arquivo: puxar de novo não duplica) e uma importação por conta e mês em
// financeiroBancoImportacoes (api_<conta>_<AAAA-MM>), que a tela de Importar extrato mostra e desfaz como as outras. A regra
// (ler a resposta, emendar com o extrato manual, montar as importações) é a do core, em robo/gerado/financeiro.js.
//
// Por que no robô e não no navegador: as duas APIs pedem o certificado da conta (mTLS) e a chave da aplicação. Eles ficam
// no metadado da máquina robo-nilma, nunca no repositório (público) nem no Firestore:
//   financeiro-bancos      JSON com as contas (abaixo), sem o certificado
//   <certificado>          o .pfx/.p12 em Base64, um metadado por conta (o nome vai em "certificado")
//   <senha>                a senha do .pfx, quando tiver (o nome vai em "senha")
//
//   [{ "banco": "sicoob", "contaBancaria": "<id da conta no Cadastro da Nilma>", "ambiente": "homologacao",
//      "clientId": "...", "numeroConta": "123456", "certificado": "financeiro-sicoob-pfx", "senha": "financeiro-sicoob-senha" },
//    { "banco": "efi", "contaBancaria": "...", "ambiente": "homologacao",
//      "clientId": "...", "clientSecret": "...", "certificado": "financeiro-efi-p12" }]
//
// Na homologação (o padrão) o robô faz tudo menos gravar no Financeiro: os dados de teste do banco não podem virar
// lançamento. O que ele leria fica em robo/estado.extratoPelaApi, para conferir. Só "ambiente": "producao" grava.
// Sem o metadado financeiro-bancos (o PC do escritório, ou antes de configurar), o módulo não faz nada.
//
// Os endereços abaixo vêm da documentação dos bancos e ainda não foram conferidos com a resposta real; cada conta pode
// trocar qualquer um deles em "urls" (token, api, base), sem mexer no código.
//
//   node extrato-pela-api.js --agora     roda uma vez já (na VM), com o que está no metadado, e mostra o resultado
'use strict';

const https = require('https');
const f = require('./gerado/financeiro');

const META = 'http://metadata.google.internal/computeMetadata/v1/instance/attributes/';
const HORA_MINIMA = 7;
const TENTATIVAS_POR_DIA = 3;
const POR_LOTE = 400;
const MAX_ARQUIVOS_DO_EFI = 40;

const URLS = {
  sicoob: {
    producao: { token: 'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token', api: 'https://api.sicoob.com.br/conta-corrente/v4' },
    // o sandbox do Sicoob não usa certificado: o portal dá um token fixo ("tokenFixo" na conta)
    homologacao: { token: '', api: 'https://sandbox.sicoob.com.br/sicoob/sandbox/conta-corrente/v4' },
  },
  efi: {
    producao: { base: 'https://extratos.api.efipay.com.br', token: '/v1/oauth/token' },
    homologacao: { base: 'https://extratos-h.api.efipay.com.br', token: '/v1/oauth/token' },
  },
};

// ─── a configuração ──────────────────────────────────────────────────────────────────────────────────────────────────

/** As contas do metadado financeiro-bancos: { contas, erros }. Os erros nunca repetem chave nem senha. */
function lerConfig(texto) {
  let lista;
  try { lista = JSON.parse(String(texto || '').trim()); } catch (e) { return { contas: [], erros: ['o metadado financeiro-bancos não é um JSON válido'] }; }
  if (lista && !Array.isArray(lista) && Array.isArray(lista.contas)) lista = lista.contas;
  if (!Array.isArray(lista)) return { contas: [], erros: ['o metadado financeiro-bancos precisa ser uma lista de contas'] };
  const contas = [], erros = [];
  lista.forEach((c, i) => {
    const qual = 'conta ' + (i + 1) + (c && c.contaBancaria ? ' (' + c.contaBancaria + ')' : '');
    if (!c || typeof c !== 'object') { erros.push(qual + ': não é um objeto'); return; }
    if (c.banco !== 'sicoob' && c.banco !== 'efi') { erros.push(qual + ': banco precisa ser "sicoob" ou "efi"'); return; }
    const ambiente = c.ambiente === undefined ? 'homologacao' : c.ambiente;
    if (ambiente !== 'homologacao' && ambiente !== 'producao') { erros.push(qual + ': ambiente precisa ser "homologacao" ou "producao"'); return; }
    const falta = [];
    if (!c.contaBancaria) falta.push('contaBancaria');
    if (!c.clientId) falta.push('clientId');
    if (c.banco === 'sicoob' && !c.numeroConta) falta.push('numeroConta');
    if (c.banco === 'efi' && !c.clientSecret) falta.push('clientSecret');
    if (!c.certificado && !(c.banco === 'sicoob' && c.tokenFixo)) falta.push('certificado');
    if (falta.length) { erros.push(qual + ': falta ' + falta.join(', ')); return; }
    contas.push(Object.assign({}, c, { ambiente, urls: Object.assign({}, URLS[c.banco][ambiente], c.urls || {}) }));
  });
  return { contas, erros };
}

// ─── o caminho até o banco ───────────────────────────────────────────────────────────────────────────────────────────

/** Um metadado da máquina (texto) ou null (não existe, ou fora da nuvem do Google). */
async function lerMetadado(nome) {
  try {
    const r = await fetch(META + encodeURIComponent(nome), { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(3000) });
    return r.ok ? await r.text() : null;
  } catch (e) { return null; }
}

/** Uma chamada HTTPS, com o certificado do cliente (mTLS) quando tiver: { status, corpo (Buffer) }. */
function pedirHttps({ metodo, url, cabecalhos, corpo, pfx, senha }) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: metodo, headers: cabecalhos || {}, ...(pfx ? { pfx, passphrase: senha || undefined } : {}), timeout: 30000 }, res => {
      const partes = [];
      res.on('data', p => partes.push(p));
      res.on('end', () => resolve({ status: res.statusCode, corpo: Buffer.concat(partes) }));
    });
    req.on('timeout', () => req.destroy(new Error('o banco não respondeu em 30 s')));
    req.on('error', reject);
    if (corpo) req.write(corpo);
    req.end();
  });
}

/** O JSON da resposta; status fora de 2xx vira erro com o começo do corpo (sem o token). */
function jsonDe(r, oque) {
  const texto = r.corpo.toString('utf8');
  if (r.status < 200 || r.status >= 300) throw new Error(oque + ': o banco respondeu ' + r.status + (texto ? ' (' + texto.slice(0, 200).replace(/\s+/g, ' ') + ')' : ''));
  try { return JSON.parse(texto); } catch (e) { throw new Error(oque + ': a resposta não é JSON'); }
}

async function certificadoDa(conta, lerSegredo) {
  if (!conta.certificado) return {};
  const b64 = await lerSegredo(conta.certificado);
  if (!b64) throw new Error('o certificado (metadado ' + conta.certificado + ') não está na máquina');
  const senha = conta.senha ? await lerSegredo(conta.senha) : '';
  return { pfx: Buffer.from(b64.trim(), 'base64'), senha: senha ? senha.trim() : '' };
}

const diasDoMes = mes => Number(f.ultimoDiaDoMes(mes).slice(8));

/** Sicoob: o token (client_credentials com o certificado) e o extrato de cada mês, com o saldo do fim do que veio. */
async function buscarNoSicoob(conta, meses, hoje, pedir, cert) {
  let token = conta.tokenFixo || '';
  if (!token) {
    const corpo = new URLSearchParams({ grant_type: 'client_credentials', client_id: conta.clientId, scope: 'cco_extrato cco_saldo' }).toString();
    const r = jsonDe(await pedir({ metodo: 'POST', url: conta.urls.token, cabecalhos: { 'Content-Type': 'application/x-www-form-urlencoded' }, corpo, ...cert }), 'token do Sicoob');
    token = r.access_token;
    if (!token) throw new Error('token do Sicoob: a resposta veio sem access_token');
  }
  const lidas = [];
  let saldo;
  for (const mes of meses) {
    const [ano, m] = mes.split('-');
    const diaFinal = hoje.slice(0, 7) === mes ? Number(hoje.slice(8)) : diasDoMes(mes);
    const q = new URLSearchParams({ diaInicial: '1', diaFinal: String(diaFinal), agruparCNAB: 'true', numeroContaCorrente: String(conta.numeroConta) });
    const url = conta.urls.api + '/extrato/' + Number(m) + '/' + ano + '?' + q.toString();
    const r = jsonDe(await pedir({ metodo: 'GET', url, cabecalhos: { Authorization: 'Bearer ' + token, client_id: conta.clientId, Accept: 'application/json' }, ...cert }), 'extrato do Sicoob de ' + m + '/' + ano);
    const lido = f.lidasDoSicoob(r);
    lidas.push(...lido.lidas);
    const data = hoje.slice(0, 7) === mes ? hoje : f.ultimoDiaDoMes(mes);
    const valor = lido.saldoAnterior != null ? lido.saldoAnterior + lido.lidas.reduce((s, l) => s + l.valor, 0)
      : hoje.slice(0, 7) === mes ? lido.saldoAtual : undefined;
    if (valor != null) saldo = { valor, data };
  }
  return { lidas, saldo };
}

/** Efí: o token (Basic com o certificado), a lista de arquivos CNAB 240 do período e o lote desta conta em cada um. */
async function buscarNaEfi(conta, meses, hoje, pedir, cert, numeroDaConta) {
  const base = conta.urls.base;
  const basic = Buffer.from(conta.clientId + ':' + conta.clientSecret).toString('base64');
  const tok = jsonDe(await pedir({ metodo: 'POST', url: (/^https?:/.test(conta.urls.token) ? '' : base) + conta.urls.token, cabecalhos: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/json' }, corpo: JSON.stringify({ grant_type: 'client_credentials' }), ...cert }), 'token do Efí');
  if (!tok.access_token) throw new Error('token do Efí: a resposta veio sem access_token');
  const cab = { Authorization: 'Bearer ' + tok.access_token };
  const resposta = jsonDe(await pedir({ metodo: 'GET', url: base + '/v1/extrato-cnab/arquivos', cabecalhos: cab, ...cert }), 'lista de extratos do Efí');
  const lista = Array.isArray(resposta) ? resposta : Array.isArray(resposta.arquivos) ? resposta.arquivos : Array.isArray(resposta.data) ? resposta.data : [];
  const desde = meses[0] + '-01';
  const doPeriodo = lista
    .filter(a => a && a.nome && String(a.periodo_fim || a.data_geracao || '').slice(0, 10) >= desde)
    .sort((a, b) => String(b.data_geracao || '').localeCompare(String(a.data_geracao || '')))
    .slice(0, MAX_ARQUIVOS_DO_EFI);
  const arquivos = [];
  for (const a of doPeriodo) {
    const r = await pedir({ metodo: 'GET', url: base + '/v1/extrato-cnab/download/' + encodeURIComponent(a.nome), cabecalhos: cab, ...cert });
    if (r.status < 200 || r.status >= 300) throw new Error('extrato do Efí ' + a.nome + ': o banco respondeu ' + r.status);
    const lote = f.loteDaConta(f.lotesDoCnab240(r.corpo.toString('latin1')), numeroDaConta);
    if (lote) arquivos.push({ geradoEm: String(a.data_geracao || ''), lote });
  }
  const junto = f.juntarArquivosDoExtrato(arquivos);
  return { lidas: junto.lidas.filter(l => l.data >= desde && l.data <= hoje), saldo: junto.saldo };
}

// ─── o banco do nads ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A conta bancária do Cadastro da Nilma (Cadastro › Contas bancárias) pelo id; null se não existe ou está encerrada. */
async function contaDoCadastro(db, id) {
  const s = await db.collection('cadastro').doc(f.slug(f.EMPRESA_DO_ESCRITORIO.nome)).get();
  const bancos = (s.exists && Array.isArray(s.data().bancos)) ? s.data().bancos : [];
  return bancos.find(b => b && b.id === id && !b.ate) || null;
}

/** A conta do plano do financeiro desta conta bancária (criada na primeira vez, como na importação por arquivo). */
async function contaDoPlano(db, conta, simular) {
  const plano = (await db.collection('financeiroPlano').get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
  const p = f.contaDoPlanoParaOBanco(plano, f.descricaoDaContaBancaria(conta));
  if (p.existe || simular) return p.existe ? p.id : '';
  const ref = await db.collection('financeiroPlano').add({ codigo: p.codigo, descricao: p.descricao, tipo: 'ATIVO', nivel: p.nivel, pai: p.pai, ativo: true, movimentavel: true });
  return ref.id;
}

/** O último dia do extrato manual desta conta e as linhas manuais desse dia (para a emenda). */
async function extratoManual(db, contaBancaria) {
  const imps = (await db.collection('financeiroBancoImportacoes').where('contaBancaria', '==', contaBancaria).get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
  const ultimo = f.ultimoDiaManual(imps, contaBancaria);
  if (!ultimo) return { ultimo: null, doDia: [] };
  const doDia = (await db.collection('financeiroBanco').where('data', '==', ultimo).get()).docs.map(d => d.data())
    .filter(x => x.contaBancaria === contaBancaria && !f.ehImportacaoPelaApi(String(x.importacao || '')));
  return { ultimo, doDia };
}

/** Grava as importações: só as linhas novas (as que já estão, pelo id, ficam) e o documento da importação do mês. */
async function gravarImportacoes(db, importacoes, quem, simular) {
  const out = [];
  for (const imp of importacoes) {
    const refs = imp.linhas.map(l => db.collection('financeiroBanco').doc(l.id));
    const ja = refs.length ? (await db.getAll(...refs)).filter(s => s.exists).map(s => ({ id: s.id, importacao: (s.data() || {}).importacao })) : [];
    const { novas, resumo } = f.fecharImportacao(imp, ja);
    const i = imp.importacao;
    out.push({ mes: i.id.slice(-7), linhas: imp.linhas.length, novas: novas.length, saldoFinal: i.saldoFinal == null ? null : i.saldoFinal });
    if (simular) continue;
    for (let k = 0; k < novas.length; k += POR_LOTE) {
      const b = db.batch();
      for (const l of novas.slice(k, k + POR_LOTE)) {
        b.set(db.collection('financeiroBanco').doc(l.id), Object.assign(
          { data: l.data, historico: l.historico, valor: l.valor, tipo: l.tipo, banco: l.banco, importacao: l.importacao },
          l.contaBancaria ? { contaBancaria: l.contaBancaria } : {}, l.conta ? { conta: l.conta } : {}));
      }
      await b.commit();
    }
    const dados = Object.assign({}, i, resumo, { importadoEm: new Date().toISOString(), importadoPor: quem });
    delete dados.id;
    await db.collection('financeiroBancoImportacoes').doc(i.id).set(dados);
  }
  return out;
}

// ─── uma rodada ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Busca e grava cada conta; uma que falha não para as outras. -> [{ banco, contaBancaria, ambiente, meses?, erro? }] */
async function rodarExtratoPelaApi({ db, contas, lerSegredo = lerMetadado, pedir = pedirHttps, hoje, log = () => {} }) {
  const meses = f.mesesParaBuscar(hoje);
  const resultados = [];
  for (const c of contas) {
    const simular = c.ambiente !== 'producao';
    const r = { banco: c.banco, contaBancaria: c.contaBancaria, ambiente: c.ambiente };
    try {
      const conta = await contaDoCadastro(db, c.contaBancaria);
      if (!conta) throw new Error('a conta ' + c.contaBancaria + ' não está (aberta) nas contas bancárias da Nilma no Cadastro');
      const cert = await certificadoDa(c, lerSegredo);
      const veio = c.banco === 'sicoob' ? await buscarNoSicoob(c, meses, hoje, pedir, cert) : await buscarNaEfi(c, meses, hoje, pedir, cert, conta.conta);
      const manual = await extratoManual(db, conta.id);
      const lidas = f.emendarComOManual(veio.lidas, manual.ultimo, manual.doDia);
      const plano = await contaDoPlano(db, conta, simular);
      const imps = f.importacoesPelaApi({ banco: c.banco, conta, contaDoPlano: plano || undefined, lidas, saldo: veio.saldo, hoje, ultimoDiaManual: manual.ultimo });
      r.meses = await gravarImportacoes(db, imps, 'Robô (API do ' + f.NOME_DO_BANCO_PELA_API[c.banco] + ')', simular);
      r.lidas = veio.lidas.length;
      if (manual.ultimo) r.emendaEm = manual.ultimo;
      log('extrato pela API' + (simular ? ' (homologação, sem gravar)' : '') + ': ' + conta.nome + ' ' + (conta.conta || '') + ' — '
        + (r.meses.map(x => x.mes + ' ' + x.novas + ' nova(s) de ' + x.linhas).join(', ') || 'nada no período'));
    } catch (err) {
      r.erro = err.message;
      log('extrato pela API: ' + c.banco + ' ' + c.contaBancaria + ' falhou: ' + err.message);
    }
    resultados.push(r);
  }
  return resultados;
}

/** O dia (AAAA-MM-DD) e a hora em Brasília, em qualquer máquina. */
function agoraEmBrasilia(ms) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))) p[x.type] = x.value;
  return { dia: p.year + '-' + p.month + '-' + p.day, hora: Number(p.hour) };
}

/** Liga o módulo no robô da nuvem (vigia-robo.js): uma rodada por dia, a partir das 7h; com erro, tenta de novo na hora seguinte. */
function iniciarExtratoPelaApi(db, log, o = {}) {
  const lerSegredo = o.lerSegredo || lerMetadado;
  const estadoRef = db.collection('robo').doc('estado');
  let rodando = false, feitoEm = '', tentativas = { dia: '', n: 0 };
  async function talvez() {
    const { dia, hora } = agoraEmBrasilia(Date.now());
    if (rodando || feitoEm === dia || hora < HORA_MINIMA) return;
    if (tentativas.dia !== dia) tentativas = { dia, n: 0 };
    if (tentativas.n >= TENTATIVAS_POR_DIA) return;
    rodando = true;
    try {
      const texto = await lerSegredo('financeiro-bancos');
      if (!texto) { feitoEm = dia; return; }
      const { contas, erros } = lerConfig(texto);
      erros.forEach(e => log('extrato pela API: ' + e));
      if (!contas.length) { feitoEm = dia; return; }
      const estado = (await estadoRef.get()).data() || {};
      if ((estado.extratoPelaApi || {}).dia === dia && (estado.extratoPelaApi || {}).ok) { feitoEm = dia; return; }
      tentativas.n++;
      const resultados = await rodarExtratoPelaApi({ db, contas, lerSegredo, hoje: dia, log });
      const ok = resultados.every(r => !r.erro);
      await estadoRef.set({ extratoPelaApi: { dia, ok, em: new Date().toISOString(), contas: resultados, ...(erros.length ? { erros } : {}) } }, { merge: true });
      if (ok) feitoEm = dia;
    } catch (err) {
      log('extrato pela API falhou: ' + err.message);
    } finally { rodando = false; }
  }
  setTimeout(talvez, 3 * 60 * 1000);
  setInterval(talvez, 60 * 60 * 1000);
  log('extrato pela API ligado (uma vez por dia, a partir das ' + HORA_MINIMA + 'h; sem o metadado financeiro-bancos não faz nada)');
}

module.exports = { lerConfig, rodarExtratoPelaApi, iniciarExtratoPelaApi, agoraEmBrasilia, lerMetadado, pedirHttps, jsonDe, certificadoDa, URLS };

if (require.main === module && process.argv.includes('--agora')) {
  (async () => {
    const texto = await lerMetadado('financeiro-bancos');
    if (!texto) { console.log('sem o metadado financeiro-bancos nesta máquina'); return; }
    const { contas, erros } = lerConfig(texto);
    erros.forEach(e => console.log('config:', e));
    const db = require('./firestore-client').getDb('entregas-2e5e2');
    const r = await rodarExtratoPelaApi({ db, contas, hoje: agoraEmBrasilia(Date.now()).dia, log: console.log });
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })().catch(err => { console.error(err); process.exit(1); });
}
