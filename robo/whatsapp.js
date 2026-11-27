// O WhatsApp do robô (12/11/2026): o nads manda mensagem pelo WhatsApp de um CHIP NOVO do escritório, conectado pelo QR
// code como um WhatsApp Web (a biblioteca Baileys). As regras (trava, freio, número do cadastro) estão em whatsapp-regras.js.
//
// SÓ NA MÁQUINA DO GOOGLE (o vigia com ROBO_NA_NUVEM): o mesmo número conectado em duas máquinas derruba as duas.
//
// Como conversa com o nads, sem regra nova no banco:
//   - a situação vai em robo/estado.whatsapp (a mesma do Gmail, que admin e contábil leem): desligado, desconectado,
//     aguardando-qr (com o QR), conectando ou conectado (com o número); de 10 em 10 min, enquanto conectado, o
//     atualizadoEm é renovado, para o nads saber que o robô está vivo;
//   - os pedidos vêm pela fila do Gmail (solicitacoesEmail), que o vigia atende um de cada vez:
//       tipo 'whatsapp'              { para, texto, clienteId?, clienteNome?, origem } → enviado (whatsappId) ou erro
//       tipo 'whatsapp-conectar'     só admin: liga o QR code (vale uns 2 minutos)
//       tipo 'whatsapp-desconectar'  só admin: desconecta o chip e apaga a sessão
//
// A SESSÃO (a "senha" da conexão) fica só no disco desta máquina, em robo/whatsapp-sessao/ (fora do git, como o token do
// Gmail). Os instantes dos envios (o freio do dia) ficam em robo/whatsapp-envios.json, para não zerar quando o robô
// reinicia.
//
// PRONTO PARA O CHIP (27/11/2026, o dono: "deixe tudo pronto apenas para receber o chip"). As CHAVES ficam em
// config/whatsapp (o admin liga em Central dos robôs › Ajustes › WhatsApp; o robô escuta só esse documento), todas
// desligadas de começo; a regra é do core (packages/core/src/robos/whatsappAtendimento.ts, em robo/gerado/whatsapp.js):
//   - liberado: a trava. Fechada, o que iria a um cliente vai ao escritório como TESTE (pedirPeloWhatsapp);
//   - guias / boletos / mandei: o lote do Fiscal, o lote de Boletos e o Mandei põem o pedido na fila por pedirPeloWhatsapp;
//   - respostas: a mensagem que chega de um número a quem o robô mandou algo nos últimos 7 dias vai para o próprio pedido
//     (respostas.r1, r2..., respondidoEm, ultimaResposta). A quem mandou fica em robo/whatsapp-conversas.json (fora do git);
//   - autoatendimento: o menu (guias, boleto, documentos do DP, falar com o escritório), pela empresa do número no cadastro
//     do Entregas; a conversa fica em robo/whatsapp-atendimento.json. Com a trava fechada, só os números de teste usam, como
//     se fossem a "empresa de teste" das chaves. O "falar com o escritório" vira um registro whatsapp-recebida na fila
//     (status 'recebida': o vigia não atende), que a tela mostra em Respostas.
// Todo envio (fila, menu e documentos) passa um de cada vez pelo mesmo freio (emOrdem + enviar).
const fs = require('fs');
const path = require('path');

const R = require('./whatsapp-regras');
const W = require('./gerado/whatsapp');
const PASTA_DA_SESSAO = path.join(__dirname, 'whatsapp-sessao');
let ARQUIVO_DOS_ENVIOS = path.join(__dirname, 'whatsapp-envios.json');
/** as mensagens mandadas esperando o tique de entregue/lido: id → { caminho do pedido, em, entregueEm, lidoEm } */
let ARQUIVO_DO_RASTREIO = path.join(__dirname, 'whatsapp-rastreio.json');
/** a quem o robô mandou: número → { caminho do pedido, em, n (respostas já guardadas) } */
let ARQUIVO_DAS_CONVERSAS = path.join(__dirname, 'whatsapp-conversas.json');
/** a conversa do autoatendimento: número → ConversaDoAtendimento */
let ARQUIVO_DO_ATENDIMENTO = path.join(__dirname, 'whatsapp-atendimento.json');
const MAX_ARQUIVO_BYTES = 10 * 1024 * 1024;
const MAX_QRS = 5;                      // cada QR vale ~20 s: depois de uns 2 minutos sem ler, desiste
const RENOVAR_A_CADA_MS = 10 * 60000;   // o "estou vivo" enquanto conectado
const ESPERAS_PARA_RELIGAR = [5000, 15000, 60000, 5 * 60000];

let st = null;   // { db, log, roboRef, painel }
let sock = null;
let baileys = null;
let estado = { situacao: 'desligado', motivo: '' };
let comQr = false;
let qrs = 0;
let encerrando = false;
let tentativas = 0;
let religar = null;
let renovar = null;
let enviados = [];
let ultimoEnvio = 0;
let rastreio = {};
let chaves = Object.assign({}, W.CHAVES_DESLIGADAS);
let pararChaves = null;
let conversas = {};
let atendimentos = {};
let corrente = Promise.resolve();

const agoraIso = () => new Date().toISOString();
const dormir = ms => new Promise(ok => setTimeout(ok, ms));
let esperar = dormir;   // o teste troca por um que não espera

/** Os números de teste: os do código e os a mais das chaves (no banco: o repositório não leva número de cliente). */
function numerosDeTeste() {
  const lista = R.NUMEROS_DE_TESTE.slice();
  for (const n of chaves.numerosDeTeste) if (!lista.some(t => W.mesmoNumero(t, n))) lista.push(n);
  return lista;
}

/** Um envio de cada vez (a fila do vigia, o menu e os documentos do autoatendimento), para o freio valer para todos. */
function emOrdem(fn) {
  const r = corrente.then(fn);
  corrente = r.catch(() => {});
  return r;
}

function gravarEstado(novo) {
  estado = Object.assign({}, novo);
  if (!st) return;
  st.roboRef.set({ whatsapp: R.estadoParaOBanco(estado, Date.now(), { liberado: chaves.liberado, teste: numerosDeTeste() }) }, { merge: true }).catch(err => st.log('whatsapp: não gravei a situação:', err.message));
  if (st.painel) st.painel.modulo('whatsapp', 'WhatsApp', estado.situacao === 'conectado', estado.situacao === 'conectado' ? '' : estado.motivo || estado.situacao);
}

function lerEnvios() {
  try {
    const l = JSON.parse(fs.readFileSync(ARQUIVO_DOS_ENVIOS, 'utf8'));
    enviados = R.enviosQueContam(Array.isArray(l) ? l.filter(Number.isFinite) : [], Date.now());
    ultimoEnvio = enviados.length ? Math.max(...enviados) : 0;
  } catch (e) { enviados = []; }
}
function guardarEnvio(t) {
  enviados = R.enviosQueContam(enviados.concat(t), t);
  ultimoEnvio = t;
  try { fs.writeFileSync(ARQUIVO_DOS_ENVIOS, JSON.stringify(enviados)); } catch (e) { st.log('whatsapp: não guardei o envio no disco:', e.message); }
}

function lerRastreio() {
  try { rastreio = R.rastreioQueConta(JSON.parse(fs.readFileSync(ARQUIVO_DO_RASTREIO, 'utf8')), Date.now()); } catch (e) { rastreio = {}; }
}
function guardarRastreio() {
  rastreio = R.rastreioQueConta(rastreio, Date.now());
  try { fs.writeFileSync(ARQUIVO_DO_RASTREIO, JSON.stringify(rastreio)); } catch (e) { st.log('whatsapp: não guardei o rastreio no disco:', e.message); }
}
/** Um tique da Baileys (messages.update): entregue ou lida, grava no pedido da fila (sem ler nada do banco). */
function marcarEntrega(key, update) {
  const id = key && key.id;
  const r = id && rastreio[id];
  if (!r || !update || update.status == null) return;
  const novo = R.marcasDaEntrega(r, update.status, agoraIso());
  if (!novo) return;
  Object.assign(r, novo);
  guardarRastreio();
  st.db.doc(r.caminho).set(novo, { merge: true }).catch(err => st.log('whatsapp: não gravei o tique:', err.message));
}

function lerJson(arquivo) {
  try { const j = JSON.parse(fs.readFileSync(arquivo, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; }
}
function guardarJson(arquivo, dados, oque) {
  try { fs.writeFileSync(arquivo, JSON.stringify(dados)); } catch (e) { if (st) st.log('whatsapp: não guardei ' + oque + ' no disco:', e.message); }
}
/** Só as conversas dos últimos 7 dias (o resto não recebe mais resposta). */
function conversasQueContam(c, agora) {
  const fica = {};
  for (const [n, x] of Object.entries(c || {})) if (x && typeof x.caminho === 'string' && agora - (Number(x.em) || 0) < W.RESPOSTA_VALE_MS) fica[n] = x;
  return fica;
}
/** O robô mandou o pedido `caminho` para `numero`: a próxima resposta deste número vai para ele. */
function registrarConversa(numero, caminho) {
  conversas = conversasQueContam(conversas, Date.now());
  conversas[numero] = { caminho, em: Date.now(), n: 0 };
  guardarJson(ARQUIVO_DAS_CONVERSAS, conversas, 'as conversas');
}
/** quando o robô mandou o último pedido a este número (0 = nunca, nos últimos 7 dias) */
function ultimoPedidoPara(numero) {
  let em = 0;
  for (const [n, c] of Object.entries(conversas)) if (W.mesmoNumero(n, numero) && c.em > em) em = c.em;
  return em;
}

const temSessao = () => fs.existsSync(path.join(PASTA_DA_SESSAO, 'creds.json'));
function apagarSessao() {
  try { fs.rmSync(PASTA_DA_SESSAO, { recursive: true, force: true }); } catch (e) { st.log('whatsapp: não apaguei a sessão:', e.message); }
}

/** O registro da Baileys, quieto: só avisos e erros vão para o log do robô. */
function registro() {
  const nada = () => {};
  // como o pino: (objeto, frase) ou só (frase)
  const frase = (o, m) => {
    if (m) return String(m);
    if (typeof o === 'string') return o;
    const e = o && (o.err || o.error);
    const t = (o && o.msg) || (e && e.message) || '';
    if (t) return String(t);
    try { return JSON.stringify(o).slice(0, 200); } catch (x) { return ''; }
  };
  const r = {
    level: 'warn',
    child: () => r,
    trace: nada, debug: nada, info: nada,
    warn: (o, m) => st.log('whatsapp (aviso):', frase(o, m)),
    error: (o, m) => st.log('whatsapp (erro):', frase(o, m)),
    fatal: (o, m) => st.log('whatsapp (fatal):', frase(o, m)),
  };
  return r;
}

function pararSocket() {
  clearTimeout(religar); religar = null;
  clearInterval(renovar); renovar = null;
  if (sock) {
    encerrando = true;
    try { sock.ev.removeAllListeners(); } catch (e) { /* segue */ }
    try { sock.end(undefined); } catch (e) { /* segue */ }
    sock = null;
    encerrando = false;
  }
}

async function conectar(pedirQr) {
  pararSocket();
  comQr = !!pedirQr;
  qrs = 0;
  if (!baileys) baileys = await import('baileys');
  const makeWASocket = baileys.default && typeof baileys.default === 'function' ? baileys.default : baileys.makeWASocket;
  const { state, saveCreds } = await baileys.useMultiFileAuthState(PASTA_DA_SESSAO);
  let version;
  try { version = (await baileys.fetchLatestBaileysVersion()).version; } catch (e) { /* usa a que veio com a biblioteca */ }
  gravarEstado({ situacao: 'conectando', motivo: '' });
  const s = makeWASocket(Object.assign({
    auth: state,
    logger: registro(),
    // como um navegador conhecido (17/11/2026): com o nome "nads" o QR saía como "outro cliente" e o celular não
    // conectava; no celular aparece "Chrome (Ubuntu)" em Aparelhos conectados
    browser: baileys.Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,          // o celular continua recebendo as notificações
    // sem o histórico antigo; o recente fica (a Baileys avisa que sem ele os contatos novos do WhatsApp, os "LID", se
    // perdem e a sessão cai); o chip é novo, então é pouca coisa
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  }, version ? { version } : {}));
  sock = s;
  s.ev.on('creds.update', saveCreds);
  s.ev.on('messages.update', lista => {
    if (sock !== s) return;
    for (const u of lista || []) { try { marcarEntrega(u.key, u.update); } catch (e) { /* um tique a menos */ } }
  });
  // o que chega no chip (27/11/2026): a resposta ao pedido e o autoatendimento, só com as chaves ligadas
  s.ev.on('messages.upsert', ev => {
    if (sock !== s || !ev || ev.type !== 'notify') return;
    for (const m of ev.messages || []) receber(m).catch(err => st.log('whatsapp: não tratei a mensagem que chegou:', err.message));
  });
  s.ev.on('connection.update', u => {
    if (sock !== s) return;
    if (u.qr) {
      if (!comQr) {
        // a sessão do disco não vale mais: não fica pedindo QR sozinho (alguém precisa estar com o celular na mão)
        pararSocket();
        apagarSessao();
        gravarEstado({ situacao: 'desconectado', motivo: 'a conexão foi perdida: peça o QR code de novo na Central dos robôs' });
        return;
      }
      qrs++;
      if (qrs > MAX_QRS) {
        pararSocket();
        apagarSessao();
        gravarEstado({ situacao: 'desconectado', motivo: 'o QR code venceu sem ser lido: peça de novo' });
        return;
      }
      gravarEstado({ situacao: 'aguardando-qr', qr: u.qr, motivo: '' });
    }
    if (u.connection === 'open') {
      tentativas = 0;
      comQr = false;
      const id = String((s.user && s.user.id) || '');
      gravarEstado({ situacao: 'conectado', numero: id.split(':')[0].split('@')[0], nome: (s.user && (s.user.name || s.user.verifiedName)) || '', desde: agoraIso(), motivo: '' });
      st.log('whatsapp: conectado', R.numeroFormatado(estado.numero));
      clearInterval(renovar);
      renovar = setInterval(() => { if (estado.situacao === 'conectado') gravarEstado(estado); }, RENOVAR_A_CADA_MS);
    }
    if (u.connection === 'close') {
      if (encerrando) return;
      const codigo = u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output && u.lastDisconnect.error.output.statusCode;
      clearInterval(renovar); renovar = null;
      sock = null;
      if (codigo === baileys.DisconnectReason.loggedOut) {
        apagarSessao();
        gravarEstado({ situacao: 'desconectado', motivo: 'o celular desconectou o robô (ou o número foi bloqueado): peça o QR code de novo' });
        st.log('whatsapp: desconectado pelo celular');
        return;
      }
      if (codigo === baileys.DisconnectReason.restartRequired) { conectar(comQr).catch(err => falhou(err)); return; }
      const espera = ESPERAS_PARA_RELIGAR[Math.min(tentativas, ESPERAS_PARA_RELIGAR.length - 1)];
      tentativas++;
      gravarEstado({ situacao: 'conectando', motivo: 'a conexão caiu (' + (codigo || 'sem código') + '); tentando de novo' });
      religar = setTimeout(() => { conectar(comQr).catch(err => falhou(err)); }, espera);
    }
  });
}

function falhou(err) {
  st.log('whatsapp: não conectou:', err.message);
  gravarEstado({ situacao: 'desconectado', motivo: 'não conectou: ' + err.message });
}

/**
 * A libsignal (a criptografia dentro da Baileys) escreve no console as chaves da conversa ("Closing session: SessionEntry
 * {...}"), e o console do robô vai para o registro da máquina. 27/11/2026: essas linhas são engolidas (a regra é do core,
 * linhaComChaves); o resto passa igual. Uma vez só.
 */
let consoleFiltrado = false;
function filtrarConsole() {
  if (consoleFiltrado) return;
  consoleFiltrado = true;
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) {
    const original = console[nivel].bind(console);
    console[nivel] = (...args) => { if (!W.linhaComChaves(args[0])) original(...args); };
  }
}

/** Liga junto com o vigia (só na nuvem). Com sessão no disco, reconecta; sem, espera o QR ser pedido. */
function iniciarWhatsapp({ db, log, roboRef, painel }) {
  st = { db, log, roboRef, painel };
  filtrarConsole();
  lerEnvios();
  lerRastreio();
  conversas = conversasQueContam(lerJson(ARQUIVO_DAS_CONVERSAS), Date.now());
  atendimentos = lerJson(ARQUIVO_DO_ATENDIMENTO);
  // as chaves (27/11/2026): só este documento, escutado (uma leitura por mudança)
  pararChaves = db.collection('config').doc('whatsapp').onSnapshot(s => {
    const antes = JSON.stringify([chaves.liberado, chaves.numerosDeTeste]);
    chaves = W.lerChaves(s.exists ? s.data() : null);
    const ligadas = W.CHAVES_DO_WHATSAPP.filter(c => chaves[c.chave]).map(c => c.rotulo);
    log('whatsapp: chaves ' + (ligadas.length ? ligadas.join(', ') : 'todas desligadas'));
    if (antes !== JSON.stringify([chaves.liberado, chaves.numerosDeTeste])) gravarEstado(estado);
  }, err => log('whatsapp: não li as chaves (ficam como estavam):', err.message));
  if (temSessao()) conectar(false).catch(falhou);
  else gravarEstado({ situacao: 'desconectado', motivo: 'ainda não conectado: peça o QR code na Central dos robôs' });
}

/** Desliga com o vigia, sem desconectar o celular (a sessão fica no disco para a próxima vez). */
function pararWhatsapp() {
  if (pararChaves) { try { pararChaves(); } catch (e) { /* segue */ } pararChaves = null; }
  pararSocket();
}

function naoLigado() {
  return new Error('o WhatsApp só roda no robô da nuvem, e ele não ligou aqui');
}

/**
 * Manda uma mensagem (texto ou arquivo) para o número, com o freio do dia, o intervalo sorteado e a procura do número com e
 * sem o 9. Quem chama já está em emOrdem. Devolve o id da mensagem. `responder`: é a resposta do autoatendimento a quem
 * acabou de escrever (27/11/2026): espera de 3 a 8 s, não de 20 a 60.
 */
async function enviar(numero, conteudo, responder) {
  if (estado.situacao !== 'conectado' || !sock) throw new Error('o WhatsApp do robô não está conectado (' + (estado.motivo || estado.situacao) + ')');
  const freio = R.motivoDoFreio(enviados, Date.now());
  if (freio) throw new Error(freio);
  const espera = (responder ? W.esperaParaResponder : R.esperaAntesDeMandar)(ultimoEnvio, Date.now(), Math.random());
  if (espera) await esperar(espera);
  if (!sock || estado.situacao !== 'conectado') throw new Error('o WhatsApp desconectou antes de mandar');
  let achado = null;
  for (const n of R.variantesDoNumero(numero)) {
    const [a] = await sock.onWhatsApp(R.jidDe(n));
    if (a && a.exists) { achado = a; break; }
  }
  if (!achado) throw new Error(R.numeroFormatado(numero) + ' não tem WhatsApp');
  const msg = await sock.sendMessage(achado.jid, conteudo);
  guardarEnvio(Date.now());
  return (msg && msg.key && msg.key.id) || '';
}

/** O boleto do lote de Boletos que vai junto (27/11/2026): só o já enviado por e-mail e do mesmo cliente do pedido. */
async function anexoDoBoleto(p) {
  const ref = st.db.collection('financeiroBoletos').doc(String(p.boleto));
  const s = await ref.get();
  const b = s.exists ? s.data() : null;
  if (!b) throw new Error('o boleto do pedido não existe mais');
  if (!b.envio || b.envio.status !== 'enviado') throw new Error('o boleto ainda não foi enviado por e-mail');
  const contrato = (await st.db.collection('financeiroHonorarios').doc(String(b.contratoId || '-')).get()).data();
  if (!contrato || String(contrato.clienteId || '') !== String(p.clienteId || '')) throw new Error('o boleto não é do cliente do pedido');
  const buffer = await require('./lote-dp').bufferDoArquivo(ref, b);
  const quem = String(contrato.nome || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return { nome: 'Boleto de honorários' + (quem ? ' - ' + quem : '') + '.pdf', mime: 'application/pdf', buffer };
}

/**
 * Contra o que conferir o número do pedido com a trava aberta: o cliente do Entregas (clienteId: guias, boleto, Pedir
 * extratos) ou o ticket do Mandei (o WhatsApp do ticket). null = não achou.
 */
async function cadastroDoPedido(p) {
  if (p.origem === 'mandei' && p.ticket) {
    const t = (await st.db.collection('tickets').doc(String(p.ticket)).get()).data();
    return t && t.para ? { telefone: t.para.whatsapp || '' } : null;
  }
  if (!p.clienteId) return null;
  const snap = await st.db.collection('clientes').doc(String(p.clienteId)).get();
  return snap.exists ? snap.data() : null;
}

/**
 * Um pedido da fila (tipo 'whatsapp'). Devolve o que vai no próprio pedido; erro vira exceção com o motivo. `ref`: o pedido
 * no banco (para os tiques e as respostas); `anexo`: { ler, apagar } do PDF que a tela subiu em partes (o mesmo do disparo).
 */
async function atenderPedido(p, ref, anexo) {
  if (!st) throw naoLigado();
  if (estado.situacao !== 'conectado' || !sock) throw new Error('o WhatsApp do robô não está conectado (' + (estado.motivo || estado.situacao) + ')');
  const cliente = await cadastroDoPedido(p);
  const motivo = R.motivoParaNaoMandar(p, cliente, { liberado: chaves.liberado, teste: numerosDeTeste() });
  if (motivo) throw new Error(motivo);
  const arquivo = p.boleto ? await anexoDoBoleto(p) : p.anexo && anexo ? await anexo.ler() : null;
  const motivoDoArquivo = R.motivoDoAnexo(arquivo);
  if (motivoDoArquivo) throw new Error(motivoDoArquivo);
  const numero = R.numeroDoWhatsApp(p.para);
  const texto = String(p.texto).trim();
  // com o PDF, a mensagem vai de legenda dele (uma mensagem só, como o Acessórias)
  const idDaMensagem = await emOrdem(() => enviar(numero, arquivo
    ? { document: arquivo.buffer, mimetype: arquivo.mime, fileName: arquivo.nome, caption: texto }
    : { text: texto }));
  if (idDaMensagem && ref && ref.path) { rastreio[idDaMensagem] = { caminho: ref.path, em: Date.now() }; guardarRastreio(); }
  if (ref && ref.path) registrarConversa(numero, ref.path);
  if (arquivo && anexo && !p.boleto) await anexo.apagar().catch(() => {});
  st.log('whatsapp: mandou para', p.clienteNome || R.numeroFormatado(numero));
  return { status: 'enviado', enviadoEm: agoraIso(), whatsappId: idDaMensagem, de: estado.numero, ...(arquivo ? { anexoEnviado: arquivo.nome } : {}) };
}

/**
 * O pedido de WhatsApp que os envios do robô põem na fila (27/11/2026): `origem` é a chave ('guias', 'boletos', 'mandei').
 * Desligada a chave (ou fora da nuvem), não faz nada (null). Com a trava fechada vai ao escritório como TESTE. `d`:
 * { telefone? (sem ele, o do cliente do Entregas), cliente, clienteId?, mensagem(atende) → texto, extra, criadoPor?, criadoPorUid? }.
 */
async function pedirPeloWhatsapp(db, origem, d) {
  if (!st || !chaves[origem]) return null;
  let telefone = d.telefone;
  if (telefone === undefined && d.clienteId) {
    const c = (await db.collection('clientes').doc(String(d.clienteId)).get()).data();
    telefone = c ? c.telefone : '';
  }
  const pedido = W.pedidoParaCliente({ telefone, cliente: String(d.cliente || ''), texto: d.mensagem(chaves.autoatendimento) }, chaves.liberado, numerosDeTeste());
  if (!pedido) return { semEnvio: 'sem o WhatsApp no cadastro' };
  const agora = agoraIso();
  const w = await db.collection('solicitacoesEmail').add(Object.assign({
    tipo: 'whatsapp', status: 'pendente', para: pedido.para, texto: pedido.texto, clienteNome: String(d.cliente || ''), teste: pedido.teste,
    criadoEm: agora, criadoPor: d.criadoPor || 'robô', criadoPorUid: d.criadoPorUid || '',
  }, d.clienteId ? { clienteId: String(d.clienteId) } : {}, d.extra || {}));
  return { pedido: w.id, para: pedido.para, teste: pedido.teste };
}

/** As chaves de agora (os outros envios do robô perguntam aqui). */
const chavesDoWhatsapp = () => Object.assign({}, chaves);

// ---------- o que chega no chip (27/11/2026) ----------

async function receber(m) {
  if (!st) return;
  const r = W.lerMensagemRecebida(m);
  if (!r) return;
  const agora = Date.now();
  if (chaves.respostas) await guardarResposta(r, agora);
  if (chaves.autoatendimento && r.tipo === 'texto') await emOrdem(() => atender(r, agora));
}

/** A resposta vai para o último pedido mandado a este número (7 dias), até MAX_RESPOSTAS_POR_PEDIDO. */
async function guardarResposta(r, agora) {
  const caminho = W.pedidoRespondido(conversas, r.numero, agora);
  if (!caminho) return;
  const c = Object.values(conversas).find(x => x.caminho === caminho);
  if (!c || (c.n || 0) >= W.MAX_RESPOSTAS_POR_PEDIDO) return;
  c.n = (c.n || 0) + 1;
  guardarJson(ARQUIVO_DAS_CONVERSAS, conversas, 'as conversas');
  const resposta = W.respostaParaGravar(r, agoraIso());
  await st.db.doc(caminho).set({
    // um mapa (r1, r2...) com o merge: junta sem ler o pedido e sem o FieldValue (a tela põe em ordem pela chave)
    respostas: { ['r' + c.n]: resposta }, respondidoEm: resposta.em, ultimaResposta: W.textoDaResposta(resposta).slice(0, 200),
  }, { merge: true });
  st.log('whatsapp: resposta de', R.numeroFormatado(r.numero), 'guardada no pedido');
}

/** As empresas do número no cadastro do Entregas (o arquivo local do vigia); os números de teste são a empresa de teste. */
async function empresasDoNumero(numero, teste) {
  const snap = await require('./clientes-cache').clientesAtivos(st.db);
  const lista = [];
  snap.forEach(d => {
    const c = d.data() || {};
    const codigo = String(c.codigoOrigem || '').trim();
    if (!codigo) return;
    const casa = teste ? !!chaves.empresaDeTeste && codigo === chaves.empresaDeTeste : W.mesmoNumero(W.numeroDoWhatsapp(c.telefone), numero);
    if (casa) lista.push({ codigo, nome: String(c.nome || '').trim() || 'Cliente ' + codigo, clienteId: d.id });
  });
  return lista.slice(0, 9);
}

/**
 * Pergunta ao Claude do PC do escritório (robo/whatsapp-claude.js, no claude-do-pc.js) qual opção do menu o cliente quis:
 * deixa a pergunta em whatsappInterpretacoes/{id}, espera até ESPERA_DO_CLAUDE_MS e apaga. null = sem resposta (o PC
 * desligado, o Claude sem limite, ou não deu para saber). O teste troca por um de mentira.
 */
let perguntarAoClaude = async (textoDoCliente, empresa) => {
  const ref = await st.db.collection('whatsappInterpretacoes').add({ status: 'pendente', pergunta: W.perguntaAoClaude(textoDoCliente, empresa), criadoEm: agoraIso() });
  try {
    return await new Promise(ok => {
      let parar = () => {};
      const fim = setTimeout(() => { parar(); ok(null); }, W.ESPERA_DO_CLAUDE_MS);
      parar = ref.onSnapshot(s => {
        const d = s.data() || {};
        if (d.status !== 'feito' && d.status !== 'erro') return;
        clearTimeout(fim); parar();
        ok(d.status === 'feito' && Number.isInteger(d.opcao) ? d.opcao : null);
      }, () => { clearTimeout(fim); ok(null); });
    });
  } finally {
    await ref.delete().catch(() => {});
  }
};

/** O autoatendimento: a regra (core) diz o que responder e o que buscar; aqui só busca e manda. */
async function atender(r, agora) {
  const teste = numerosDeTeste().some(t => W.mesmoNumero(t, r.numero));
  if (!chaves.liberado && !teste) return;
  const empresas = await empresasDoNumero(r.numero, teste);
  const guardada = atendimentos[r.numero] || null;
  let passo = null;
  // o texto livre ("me manda o DAS") vai ao Claude do PC do escritório (chave ia): ele só escolhe a opção do menu
  if (chaves.ia && W.vaiAoClaude(r.texto) && empresas.length) {
    const empresa = (guardada && guardada.empresa && empresas.find(e => e.codigo === guardada.empresa.codigo)) || (empresas.length === 1 ? empresas[0] : null);
    const opcao = empresa ? await perguntarAoClaude(r.texto, empresa.nome).catch(() => null) : null;
    if (opcao !== null) passo = W.passoComOClaude(guardada, opcao, empresas, agora, ultimoPedidoPara(r.numero));
  }
  if (!passo) passo = W.passoDoAtendimento(guardada, r.texto, empresas, agora, ultimoPedidoPara(r.numero));
  atendimentos[r.numero] = Object.assign({}, passo.conversa, { empresas: [] });
  guardarJson(ARQUIVO_DO_ATENDIMENTO, atendimentos, 'o autoatendimento');
  if (passo.responder) await enviar(r.numero, { text: passo.responder }, true);
  if (passo.acao) await fazer(passo.acao, r);
}

let drive = () => require('./drive-indice').getDrive();   // o teste troca por um de mentira

/** Um arquivo do Drive (os ids vêm dos registros do próprio robô): { nome, mime, buffer }. */
async function doDrive(id) {
  const meta = await drive().files.get({ fileId: id, fields: 'name,mimeType,size', supportsAllDrives: true });
  if (Number(meta.data.size) > MAX_ARQUIVO_BYTES) throw new Error('o arquivo passa de 10 MB');
  const r = await drive().files.get({ fileId: id, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer', timeout: 120000 });
  return { nome: String(meta.data.name || 'documento'), mime: String(meta.data.mimeType || 'application/octet-stream'), buffer: Buffer.from(r.data) };
}

/** O que o escritório já mandou à empresa: { registro, baixar(arquivo) } ou null. Só lê quando o cliente pede. */
async function documentosDe(tipo, e) {
  const db = st.db;
  if (tipo === 'guias' || tipo === 'dp') {
    const snap = await db.collection('solicitacoesEmail').where('codigo', '==', e.codigo).where('tipo', '==', tipo === 'guias' ? 'envioFiscal' : 'envioDp').get();
    const registros = snap.docs.map(d => d.data()).filter(x => x.status === 'enviado').map(x => ({
      competencia: String(x.competencia || ''), enviadoEm: String(x.enviadoEm || ''),
      arquivos: tipo === 'guias'
        ? (Array.isArray(x.guiasDrive) ? x.guiasDrive : []).filter(g => g && g.id).map(g => ({ nome: String(g.nome || ''), id: String(g.id) }))
        : (Array.isArray(x.arquivos) ? x.arquivos : []).filter(id => typeof id === 'string' && id).map(id => ({ nome: '', id })),
    }));
    const registro = W.envioMaisRecente(registros);
    return registro ? { registro, baixar: a => doDrive(a.id) } : null;
  }
  // o boleto: os contratos da empresa nos Honorários e o último boleto já enviado por e-mail
  const contratos = await db.collection('financeiroHonorarios').where('codigo', '==', e.codigo).get();
  const registros = [];
  const dados = new Map();
  for (const c of contratos.docs) {
    const bs = await db.collection('financeiroBoletos').where('contratoId', '==', c.id).get();
    for (const b of bs.docs) {
      const x = b.data();
      if (!x.envio || x.envio.status !== 'enviado') continue;
      dados.set(b.id, x);
      registros.push({ competencia: String(x.competencia || ''), enviadoEm: String(x.envio.enviadoEm || ''), arquivos: [{ nome: 'Boleto de honorários - ' + e.nome + '.pdf', id: b.id }] });
    }
  }
  const registro = W.envioMaisRecente(registros);
  if (!registro) return null;
  return {
    registro,
    baixar: async a => ({ nome: a.nome, mime: 'application/pdf', buffer: await require('./lote-dp').bufferDoArquivo(db.collection('financeiroBoletos').doc(a.id), dados.get(a.id)) }),
  };
}

/** A opção que o cliente escolheu: o pedido para falar com o escritório ou os arquivos. */
async function fazer(acao, r) {
  const e = acao.empresa;
  const agora = agoraIso();
  if (acao.tipo === 'escritorio') {
    await st.db.collection('solicitacoesEmail').add({
      tipo: 'whatsapp-recebida', status: 'recebida', origem: 'autoatendimento', pedeEscritorio: true, numero: r.numero, codigo: e.codigo,
      clienteId: e.clienteId, clienteNome: e.nome, empresa: e.nome, ultimaResposta: 'pediu para falar com o escritório', respondidoEm: agora,
      criadoEm: agora, criadoPor: 'robô',
    });
    st.log('whatsapp: ' + e.nome + ' pediu para falar com o escritório');
    return;
  }
  const achado = await documentosDe(acao.tipo, e).catch(err => { st.log('whatsapp: não achei os documentos (' + acao.tipo + ') de', e.codigo, '-', err.message); return null; });
  const legenda = W.textoDosDocumentos(acao.tipo, e, achado && achado.registro);
  if (!achado) { await enviar(r.numero, { text: legenda }, true); return; }
  let mandou = 0;
  for (const a of achado.registro.arquivos) {
    let arq;
    try { arq = await achado.baixar(a); } catch (err) { st.log('whatsapp: não baixei', a.nome || a.id, '-', err.message); continue; }
    if (!arq || !arq.buffer || !arq.buffer.length || arq.buffer.length > MAX_ARQUIVO_BYTES) continue;
    await enviar(r.numero, { document: arq.buffer, mimetype: arq.mime, fileName: (a.nome || arq.nome).slice(0, 120), ...(mandou ? {} : { caption: legenda }) }, true);
    mandou++;
  }
  if (!mandou) await enviar(r.numero, { text: 'Não conseguimos pegar os arquivos agora. Fale com o escritório pelo WhatsApp ' + W.numeroFormatado(W.NUMERO_DO_ESCRITORIO) + '.' }, true);
  st.log('whatsapp: autoatendimento mandou', mandou, 'arquivo(s) (' + acao.tipo + ') para', e.nome);
}


/** 'whatsapp-conectar' e 'whatsapp-desconectar': só admin. */
async function atenderComando(p) {
  if (!st) throw naoLigado();
  const u = p.criadoPorUid ? await st.db.collection('usuarios').doc(String(p.criadoPorUid)).get() : null;
  if (!R.podeComandar(u && u.exists ? u.data() : null)) throw new Error('só o administrador conecta ou desconecta o WhatsApp');
  const quem = p.criadoPor || 'admin';
  if (p.tipo === 'whatsapp-conectar') {
    if (estado.situacao === 'conectado') return { status: 'concluido', concluidoEm: agoraIso(), resumo: 'já estava conectado' };
    pararSocket();
    apagarSessao();          // começa do zero: o QR é de uma sessão nova
    await conectar(true);
    st.log('whatsapp: QR code pedido por', quem);
    return { status: 'concluido', concluidoEm: agoraIso(), resumo: 'QR code no ar' };
  }
  if (p.tipo === 'whatsapp-desconectar') {
    // sai do celular primeiro (o chip deixa de mostrar o "nads" nos aparelhos conectados), sem os avisos de queda
    const s = sock;
    sock = null;
    clearTimeout(religar); religar = null;
    clearInterval(renovar); renovar = null;
    if (s) {
      try { s.ev.removeAllListeners('connection.update'); } catch (e) { /* segue */ }
      try { await s.logout(); } catch (e) { /* já estava fora */ }
      try { s.end(undefined); } catch (e) { /* segue */ }
    }
    apagarSessao();
    gravarEstado({ situacao: 'desconectado', motivo: 'desconectado por ' + quem });
    st.log('whatsapp: desconectado por', quem);
    return { status: 'concluido', concluidoEm: agoraIso(), resumo: 'desconectado' };
  }
  throw new Error('comando de WhatsApp desconhecido: ' + p.tipo);
}

/**
 * Só para o teste (robo/teste-whatsapp.js): um banco e um socket de mentira, as chaves do teste, os arquivos numa pasta
 * temporária e sem a espera entre as mensagens. Nunca chamado pelo vigia.
 */
function prepararParaOTeste({ db, sockFalso, driveFalso, chavesDoTeste, pasta, log, esperarFalso, claudeFalso }) {
  if (claudeFalso) perguntarAoClaude = claudeFalso;
  st = { db, log: log || (() => {}), roboRef: { set: async () => {} }, painel: null };
  sock = sockFalso;
  estado = { situacao: 'conectado', numero: '553800000000', motivo: '' };
  chaves = W.lerChaves(chavesDoTeste);
  ARQUIVO_DOS_ENVIOS = path.join(pasta, 'whatsapp-envios.json');
  ARQUIVO_DO_RASTREIO = path.join(pasta, 'whatsapp-rastreio.json');
  ARQUIVO_DAS_CONVERSAS = path.join(pasta, 'whatsapp-conversas.json');
  ARQUIVO_DO_ATENDIMENTO = path.join(pasta, 'whatsapp-atendimento.json');
  enviados = []; ultimoEnvio = 0; rastreio = {}; conversas = {}; atendimentos = {};
  esperar = esperarFalso || (async () => {});
  if (driveFalso) drive = () => driveFalso;
}

module.exports = { prepararParaOTeste, filtrarConsole, iniciarWhatsapp, pararWhatsapp, atenderPedido, atenderComando, pedirPeloWhatsapp, chavesDoWhatsapp, receber };
