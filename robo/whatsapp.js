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
/** os instantes das respostas a quem escreveu (o freio delas, à parte) */
let ARQUIVO_DAS_RESPOSTAS = path.join(__dirname, 'whatsapp-respostas-envios.json');
/** as mensagens mandadas esperando o tique de entregue/lido: id → { caminho do pedido, em, entregueEm, lidoEm } */
let ARQUIVO_DO_RASTREIO = path.join(__dirname, 'whatsapp-rastreio.json');
/** a quem o robô mandou: número → { caminho do pedido, em, n (respostas já guardadas) } */
let ARQUIVO_DAS_CONVERSAS = path.join(__dirname, 'whatsapp-conversas.json');
/** a conversa do autoatendimento: número → ConversaDoAtendimento */
let ARQUIVO_DO_ATENDIMENTO = path.join(__dirname, 'whatsapp-atendimento.json');
/** os avisos já mandados (chave → quando) e o último dia em que rodaram */
let ARQUIVO_DOS_AVISOS = path.join(__dirname, 'whatsapp-avisos.json');
let relogioDosAvisos = null;
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
let respostasEnviadas = [];
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
// as respostas a quem escreveu (27/11/2026, "faz a opção 2"): o freio próprio, maior (100 por hora, 500 por dia)
function lerRespostasEnviadas() {
  try {
    const l = JSON.parse(fs.readFileSync(ARQUIVO_DAS_RESPOSTAS, 'utf8'));
    respostasEnviadas = R.enviosQueContam(Array.isArray(l) ? l.filter(Number.isFinite) : [], Date.now());
  } catch (e) { respostasEnviadas = []; }
}
function guardarRespostaEnviada(t) {
  respostasEnviadas = R.enviosQueContam(respostasEnviadas.concat(t), t);
  ultimoEnvio = t;
  try { fs.writeFileSync(ARQUIVO_DAS_RESPOSTAS, JSON.stringify(respostasEnviadas)); } catch (e) { st.log('whatsapp: não guardei a resposta no disco:', e.message); }
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
  lerRespostasEnviadas();
  lerRastreio();
  conversas = conversasQueContam(lerJson(ARQUIVO_DAS_CONVERSAS), Date.now());
  atendimentos = lerJson(ARQUIVO_DO_ATENDIMENTO);
  // os avisos do dia (guia vencendo, certificado, boleto vencido): confere de meia em meia hora, roda uma vez depois das 9h
  clearInterval(relogioDosAvisos);
  relogioDosAvisos = setInterval(() => { rodarAvisos(Date.now()).catch(err => log('whatsapp: os avisos do dia falharam:', err.message)); }, 30 * 60000);
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
  clearInterval(relogioDosAvisos); relogioDosAvisos = null;
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
  // o freio: o que o escritório manda sozinho, 30 por hora e 150 por dia; a resposta a quem escreveu, 100 e 500 (27/11/2026)
  const freio = responder ? W.motivoDoFreioDaResposta(respostasEnviadas, Date.now()) : R.motivoDoFreio(enviados, Date.now());
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
  // toda mensagem com o nome "NADS (Autoatendimento Nilma Contabilidade)" na frente (27/11/2026): o texto e a legenda do
  // primeiro arquivo; o arquivo sozinho (sem legenda) vai como está
  const comNome = Object.assign({}, conteudo);
  if (typeof comNome.text === 'string') comNome.text = W.comCabecalho(comNome.text);
  if (typeof comNome.caption === 'string' && comNome.caption.trim()) comNome.caption = W.comCabecalho(comNome.caption);
  const msg = await sock.sendMessage(achado.jid, comNome);
  if (responder) guardarRespostaEnviada(Date.now()); else guardarEnvio(Date.now());
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
  // quem falou com o robô (os avisos do dia só vão a quem conversou nos últimos 60 dias)
  atendimentos[r.numero] = Object.assign({}, W.CONVERSA_NOVA, atendimentos[r.numero] || {}, { vistoEm: agora });
  if (chaves.respostas) await guardarResposta(r, agora);
  if (chaves.arquivos && W.TIPOS_DE_ARQUIVO_RECEBIDO.includes(r.tipo)) await emOrdem(() => guardarArquivo(m, r, agora));
  if (chaves.autoatendimento && r.tipo === 'texto') await emOrdem(() => atender(r, agora));
}

/** A mídia da mensagem (o PDF, a foto) em bytes, pela Baileys. O teste troca por uma de mentira. */
let baixarMidia = async m => baileys.downloadMediaMessage(m, 'buffer', {}, { logger: registro(), reuploadRequest: sock.updateMediaMessage });

/**
 * O arquivo que o cliente mandou vai para o Drive (chave arquivos, 27/11/2026): pelo envio do formulário do Mandei
 * (enviosSecretario + partes; o robo/envios-do-nads.js grava). Só de número do cadastro (ou de teste, como a empresa de
 * teste); a resposta a um Mandei (o último pedido a este número) entra no ticket. Uma confirmação a cada 2 minutos.
 */
async function guardarArquivo(m, r, agora) {
  const teste = numerosDeTeste().some(t => W.mesmoNumero(t, r.numero));
  if (!chaves.liberado && !teste) return;
  const empresas = await empresasDoNumero(r.numero, teste);
  const conversa = atendimentos[r.numero] || null;
  const empresa = (conversa && conversa.empresa && empresas.find(e => e.codigo === conversa.empresa.codigo)) || (empresas.length === 1 ? empresas[0] : null);
  if (!empresa) {
    // número fora do cadastro (fica só no celular) ou em mais de uma empresa (a equipe confere: o arquivo não vai para a pasta errada)
    if (empresas.length > 1) await avisarAEquipe(empresas[0], r, 'mandou um arquivo (' + (r.arquivo || r.tipo) + ') e o número está em mais de uma empresa');
    return;
  }
  const buffer = await baixarMidia(m);
  const motivo = W.motivoParaNaoGuardar(r.tipo, buffer ? buffer.length : 0);
  if (motivo) { st.log('whatsapp: arquivo de', empresa.nome, 'não guardado:', motivo); return; }
  // a resposta a um Mandei: a última mensagem do robô a este número foi o link de um ticket
  let ticketDoMandei = '';
  const caminho = W.pedidoRespondido(conversas, r.numero, agora);
  if (caminho) {
    const p = (await st.db.doc(caminho).get()).data() || {};
    if (p.origem === 'mandei' && typeof p.link === 'string' && p.link) ticketDoMandei = p.link;
  }
  const nome = W.nomeDoArquivoRecebido(r, r.mime || '', agora);
  const envio = W.envioDoArquivoRecebido({ empresa, nome, tamanho: buffer.length, agora, ticketDoMandei: ticketDoMandei || undefined });
  const ref = await st.db.collection('enviosSecretario').add(envio);
  const pedaco = W.PEDACO_DO_ARQUIVO_RECEBIDO;
  for (let n = 0; n < envio.partes; n++) await ref.collection('partes').doc(String(n)).set({ dados: buffer.subarray(n * pedaco, (n + 1) * pedaco) });
  await ref.update({ status: 'pendente' });
  if (ticketDoMandei) {
    // na lista do formulário, como o anexo pelo link (sem a pergunta: veio pelo WhatsApp)
    const link = st.db.collection('ticketsLinks').doc(ticketDoMandei);
    const atual = (await link.get()).data() || {};
    const arquivos = (Array.isArray(atual.arquivos) ? atual.arquivos : []).concat([{ id: ref.id, nome: nome.slice(0, 200), tamanho: buffer.length, itemId: '', enviadoEm: new Date(agora).toISOString() }]);
    await link.update({ arquivos });
  }
  const h = W.historicoCom((conversa && conversa.historico) || [], { de: 'cliente', texto: '(mandou o arquivo ' + nome + ')' });
  const confirmar = !conversa || !conversa.confirmouEm || agora - conversa.confirmouEm > W.CONFIRMACAO_DE_NOVO_MS;
  atendimentos[r.numero] = Object.assign({}, W.CONVERSA_NOVA, conversa || {}, { empresa, empresas: [], historico: h }, confirmar ? { confirmouEm: agora } : {});
  guardarJson(ARQUIVO_DO_ATENDIMENTO, atendimentos, 'o autoatendimento');
  st.log('whatsapp: arquivo de ' + empresa.nome + ' para o Drive' + (ticketDoMandei ? ' (Mandei)' : '') + ': ' + nome);
  if (confirmar) await enviar(r.numero, { text: W.textoDoArquivoRecebido(nome, !!ticketDoMandei) }, true);
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
 * Pede ao Claude do PC do escritório (robo/whatsapp-claude.js, no claude-do-pc.js) que escreva a resposta ao cliente: deixa
 * a pergunta em whatsappInterpretacoes/{id} (modo 'escrever'), espera até ESPERA_DO_CLAUDE_MS e apaga. Devolve a saída do
 * Claude (texto) ou null (o PC desligado, o Claude sem limite, sem resposta). O teste troca por um de mentira.
 */
let perguntarAoClaude = async pergunta => {
  const ref = await st.db.collection('whatsappInterpretacoes').add({ status: 'pendente', modo: 'escrever', pergunta, criadoEm: agoraIso() });
  try {
    return await new Promise(ok => {
      let parar = () => {};
      const fim = setTimeout(() => { parar(); ok(null); }, W.ESPERA_DO_CLAUDE_MS);
      parar = ref.onSnapshot(s => {
        const d = s.data() || {};
        if (d.status !== 'feito' && d.status !== 'erro') return;
        clearTimeout(fim); parar();
        ok(d.status === 'feito' && typeof d.saida === 'string' ? d.saida : null);
      }, () => { clearTimeout(fim); ok(null); });
    });
  } finally {
    await ref.delete().catch(() => {});
  }
};

/** O pedido para falar com a equipe (o 4, o "não entendi" 2x, ou o Claude chamando): fica na fila como whatsapp-recebida. */
async function avisarAEquipe(e, r, oque) {
  const agora = agoraIso();
  await st.db.collection('solicitacoesEmail').add({
    tipo: 'whatsapp-recebida', status: 'recebida', origem: 'autoatendimento', pedeEscritorio: true, numero: r.numero, codigo: e.codigo,
    clienteId: e.clienteId, clienteNome: e.nome, empresa: e.nome, ultimaResposta: String(oque).slice(0, 200), respondidoEm: agora,
    criadoEm: agora, criadoPor: 'robô',
  });
  st.log('whatsapp: ' + e.nome + ' pediu para falar com o escritório');
  await criarTarefaDaEquipe(e, r, oque).catch(err => st.log('whatsapp: não criei a tarefa da equipe de', e.nome, '-', err.message));
}

/**
 * A tarefa no Início do responsável do Contábil da empresa (o Cadastro do nads; sem ele, um Diretor), como a do documento
 * vencendo (papeis-vencendo.js): uma por empresa por dia (o id é fixo e a gravação é create). A regra é do core.
 */
async function criarTarefaDaEquipe(e, r, oque) {
  const db = st.db;
  const agora = Date.now();
  const ref = db.collection('nadsTarefasDelegadas').doc(W.idDaTarefaDoWhatsapp(String(e.codigo), agora));
  if ((await ref.get()).exists) return false;
  const equipe = (await db.collection('usuarios').get()).docs.map(d => Object.assign({ uid: d.id }, d.data())).filter(u => u.ativo !== false && u.nome);
  const diretor = equipe.find(u => u.nivel === 'diretor' || u.nivel === 'dono') || null;
  const codigo = Number(e.codigo);
  let nomeResp = '';
  if (Number.isFinite(codigo)) {
    const cad = await db.collection('cadastro').where('codigo', '==', codigo).limit(1).get().catch(() => null);
    nomeResp = cad && !cad.empty ? String(((cad.docs[0].data() || {}).responsaveis || {}).contabil || '') : '';
  }
  const u = (nomeResp && equipe.find(x => W.chaveDoNome(x.nome) === W.chaveDoNome(nomeResp) && (x.departamento === 'contabil' || (x.roles || []).includes('contabil')))) || diretor;
  if (!u) { st.log('whatsapp: ninguém para receber a tarefa de', e.nome); return false; }
  const ultima = await db.collection('nadsTarefasDelegadas').orderBy('numero', 'desc').limit(1).get();
  const numero = (Number(ultima.empty ? 0 : ultima.docs[0].get('numero')) || 0) + 1;
  const historico = (atendimentos[r.numero] && atendimentos[r.numero].historico) || [];
  const t = W.tarefaDoWhatsapp({ empresa: e, motivo: String(oque), historico, numero: r.numero }, { uid: u.uid, nome: String(u.nome) }, { numero, em: new Date(agora).toISOString(), agora });
  const campos = Object.assign({}, t, { pessoas: W.pessoasDaTarefa(t) });
  delete campos.id;
  try { await ref.create(campos); } catch (err) { if (err.code !== 6) throw err; return false; }
  st.log('whatsapp: tarefa #' + numero + ' para ' + u.nome + ' (' + e.nome + ')');
  return true;
}

/** Manda os arquivos (cada um baixado na hora); a legenda vai no primeiro. Devolve quantos foram. */
async function mandarArquivos(numero, arquivos, baixar, legenda) {
  let mandou = 0;
  for (const a of arquivos) {
    let arq;
    try { arq = await baixar(a); } catch (err) { st.log('whatsapp: não baixei', a.nome || a.id, '-', err.message); continue; }
    if (!arq || !arq.buffer || !arq.buffer.length || arq.buffer.length > MAX_ARQUIVO_BYTES) continue;
    // o nome que o cliente entende ("DAS Outubro 2026 - Empresa.pdf"); o do Drive não muda
    await enviar(numero, { document: arq.buffer, mimetype: arq.mime, fileName: (a.nomeNoWhatsapp || a.nome || arq.nome).slice(0, 150), ...(mandou || !legenda ? {} : { caption: legenda }) }, true);
    mandou++;
  }
  return mandou;
}

/** quantas guias o robô lê (valor e vencimento) antes de perguntar ao Claude */
const MAX_GUIAS_LIDAS = 6;
/** o que já foi lido, por id do arquivo (a guia não muda): id → { valor, vencimento } */
const guiasLidas = new Map();

/**
 * O valor e o vencimento de uma guia, lidos no PDF com o mesmo leitor do lote do Fiscal (o camposDaGuia das regras do
 * arquivador: DAS, DARF, DAE e DAM). Guardado por id. `baixar` só é chamado se ainda não leu. O teste troca por um de mentira.
 */
let lerAGuia = async (id, baixar) => {
  if (guiasLidas.has(id)) return guiasLidas.get(id);
  const arq = await baixar();
  const t = await require('./arquivador-novo').textoDoPdf(arq.buffer);
  const R2 = require('./arquivador-regras');
  const u = R2.norm((t.paginas || []).slice(0, 3).join('\n'));
  const regra = R2.REGRAS_PDF.find(x => ['DAS', 'DARF', 'DAE', 'DAM'].includes(x.tipo) && x.re.test(u));
  const c = (regra && regra.campos(u)) || {};
  const lido = { valor: String(c.valor || ''), vencimento: String(c.vencimento || '') };
  if (guiasLidas.size > 500) guiasLidas.clear();
  guiasLidas.set(id, lido);
  return lido;
};

/**
 * O que mais o Claude pode usar (27/11/2026, itens 4 a 7): as informações (certidões em certidoes/{codigo}, o que falta mandar
 * do mês anterior pela régua de cobrança, os honorários do Efí) e os documentos: as certidões que a Área do Cliente já tem
 * (areasCliente/{token}/documentos, em pedaços base64) e as NFS-e autorizadas do escritório (o PDF sai do XML). Cada parte
 * que falhar fica de fora sem derrubar as outras. Só lê quando o cliente escreve.
 */
async function extrasDaEmpresa(e) {
  const db = st.db;
  const cod = String(e.codigo);
  const agora = Date.now();
  const tenta = async (oque, f) => { try { return await f(); } catch (err) { st.log('whatsapp: não li ' + oque + ' de', cod, '-', err.message); return null; } };
  const cert = await tenta('as certidões', async () => { const s = await db.collection('certidoes').doc(cod).get(); return s.exists ? s.data() : null; });
  const pend = await tenta('as pendências', async () => {
    const cli = e.clienteId ? (await db.collection('clientes').doc(String(e.clienteId)).get()).data() : null;
    if (!cli) return null;
    const competencia = W.mesesParaProcurar(agora, 2)[1];
    const doc = (await db.collection('documentosMensal').doc(e.clienteId + '_' + competencia).get()).data() || null;
    return { competencia, faltando: require('./regua-cobranca').faltandoDo(cli, doc) };
  });
  const honorarios = await tenta('os honorários', async () => {
    const contratos = await db.collection('financeiroHonorarios').where('codigo', '==', cod).get();
    const lista = [];
    for (const c of contratos.docs) for (const [competencia, b] of Object.entries(c.get('boletosEfi') || {})) lista.push(Object.assign({ competencia }, b));
    return lista;
  });
  const informacoes = W.informacoesDaEmpresa({ certidoes: cert, faltando: pend && pend.faltando, competenciaDasPendencias: pend && pend.competencia, honorarios: honorarios || [], agora });
  const achados = {};
  const mes = W.mesesParaProcurar(agora, 1)[0];
  await tenta('as certidões da Área do Cliente', async () => {
    const ponteiro = await db.collection('areasClientePorEmpresa').doc(cod).get();
    const token = ponteiro.exists ? String(ponteiro.get('token') || '') : '';
    if (!/^[0-9a-f]{40}$/.test(token)) return;
    const col = db.collection('areasCliente').doc(token).collection('documentos');
    const docs = (await col.where('tipo', '==', 'certidao').get()).docs.filter(d => Number(d.get('partes')) > 0);
    if (!docs.length) return;
    const partes = new Map(docs.map(d => [d.id, Number(d.get('partes'))]));
    achados.certidao = {
      registros: docs.map(d => ({ competencia: mes, enviadoEm: String(d.get('validoAte') || ''), arquivos: [{ nome: String(d.get('nome') || 'Certidão.pdf'), id: d.id }] })),
      baixar: async a => {
        const pedacos = [];
        for (let n = 0; n < (partes.get(a.id) || 0); n++) pedacos.push(String(((await col.doc(a.id + '~' + n).get()).data() || {}).base64 || ''));
        return { nome: a.nome, mime: 'application/pdf', buffer: Buffer.from(pedacos.join(''), 'base64') };
      },
    };
  });
  await tenta('as NFS-e', async () => {
    const notas = (await db.collection('nfseEmissoes').where('empresaCodigo', '==', Number(cod)).get()).docs
      .filter(d => d.get('status') === 'autorizada' && d.get('xmlNfse') && !/homolog/i.test(String(d.get('ambiente') || '')));
    if (!notas.length) return;
    const xml = new Map(notas.map(d => [d.id, String(d.get('xmlNfse'))]));
    achados.nfse = {
      registros: notas.map(d => ({ competencia: String(d.get('autorizadaEm') || '').slice(0, 7), enviadoEm: String(d.get('autorizadaEm') || ''), arquivos: [{ nome: 'NFS-e ' + (d.get('numeroNfse') || d.id) + '.pdf', id: d.id }] })),
      baixar: async a => ({ nome: a.nome, mime: 'application/pdf', buffer: Buffer.from(await require('./gerado/danfse').pdfDaDanfse(xml.get(a.id))) }),
    };
  });
  return { informacoes, achados };
}

/**
 * O Claude escreve (chave ia, 27/11/2026: "quero que o claude realmente escreva"): junta os documentos da empresa (o já
 * enviado e a pasta do Drive), manda ao Claude com as últimas falas, confere a resposta (só códigos da lista) e manda o
 * texto e os arquivos. false = o Claude não respondeu direito: quem chamou segue com o menu.
 */
async function escreverComOClaude(r, empresa, guardada, agora) {
  const citados = W.mesesCitados(r.texto, agora);
  const achados = {};
  const grupos = [];
  for (const [tipo, acao] of [['guia', 'guias'], ['boleto', 'boleto'], ['dp', 'dp']]) {
    const a = await registrosDe(acao, empresa, citados).catch(err => { st.log('whatsapp: não li os documentos (' + acao + ') de', empresa.codigo, '-', err.message); return null; });
    if (a) { achados[tipo] = a; grupos.push({ tipo, registros: a.registros }); }
  }
  // as certidões (da Área do Cliente), as NFS-e do escritório e as informações (certidões, o que falta, honorários)
  const extras = await extrasDaEmpresa(empresa).catch(err => { st.log('whatsapp: não li as informações de', empresa.codigo, '-', err.message); return null; });
  if (extras) for (const [tipo, a] of Object.entries(extras.achados)) { achados[tipo] = a; grupos.push({ tipo, registros: a.registros }); }
  const documentos = W.documentosParaOClaude(grupos, citados);
  // o valor e o vencimento de cada guia, lidos no PDF (27/11/2026: "que dia vence"): as mais recentes, ao mesmo tempo
  if (achados.guia) {
    const guias = documentos.filter(d => d.tipo === 'guia').slice(0, MAX_GUIAS_LIDAS);
    await Promise.all(guias.map(async d => {
      const lido = await lerAGuia(d.id, () => achados.guia.baixar({ id: d.id, nome: d.nome })).catch(() => null);
      if (lido) Object.assign(d, lido);
    }));
  }
  const historico = (guardada && guardada.historico) || [];
  const saida = await perguntarAoClaude(W.conversaParaOClaude({ empresa: empresa.nome, agora, documentos, historico, recebido: r.texto, informacoes: extras ? extras.informacoes : [] })).catch(() => null);
  const resp = W.respostaDoEscritor(saida, documentos);
  if (!resp) return false;
  const h = W.historicoCom(W.historicoCom(historico, { de: 'cliente', texto: r.texto }), { de: 'robo', texto: resp.resposta });
  // a conversa fica aberta no menu (o número digitado continua valendo), com as falas para a próxima vez
  atendimentos[r.numero] = Object.assign({}, W.CONVERSA_NOVA, guardada || {}, { etapa: 'menu', empresa, empresas: [], menuEm: agora, aguardando: false, invalidas: 0, historico: h });
  guardarJson(ARQUIVO_DO_ATENDIMENTO, atendimentos, 'o autoatendimento');
  await enviar(r.numero, { text: resp.resposta }, true);
  let mandou = 0;
  for (const d of resp.documentos) {
    const a = achados[d.tipo];
    if (a) mandou += await mandarArquivos(r.numero, [{ id: d.id, nome: d.nome, nomeNoWhatsapp: W.nomeParaOCliente(d, empresa.nome) }], a.baixar, '');
  }
  if (resp.equipe) await avisarAEquipe(empresa, r, 'o Claude chamou a equipe: ' + r.texto);
  st.log('whatsapp: o Claude respondeu a ' + empresa.nome + ' (' + mandou + ' arquivo(s)' + (resp.equipe ? ', chamou a equipe' : '') + ')');
  return true;
}

/** O autoatendimento: a regra (core) diz o que responder e o que buscar; aqui só busca e manda. */
async function atender(r, agora) {
  const teste = numerosDeTeste().some(t => W.mesmoNumero(t, r.numero));
  if (!chaves.liberado && !teste) return;
  const empresas = await empresasDoNumero(r.numero, teste);
  const guardada = atendimentos[r.numero] || null;
  // o texto livre ("me manda o DAS") com a chave ia: o Claude do escritório escreve a resposta
  if (chaves.ia && W.vaiAoClaude(r.texto) && empresas.length) {
    const empresa = (guardada && guardada.empresa && empresas.find(e => e.codigo === guardada.empresa.codigo)) || (empresas.length === 1 ? empresas[0] : null);
    if (empresa && await escreverComOClaude(r, empresa, guardada, agora)) return;
  }
  const passo = W.passoDoAtendimento(guardada, r.texto, empresas, agora, ultimoPedidoPara(r.numero));
  const h = W.historicoCom(W.historicoCom((guardada && guardada.historico) || [], { de: 'cliente', texto: r.texto }),
    { de: 'robo', texto: passo.responder || (passo.acao ? '(mandou: ' + passo.acao.tipo + ')' : '') });
  atendimentos[r.numero] = Object.assign({}, passo.conversa, { empresas: [], historico: h });
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

/**
 * Os documentos da empresa: { registros, baixar(arquivo) }. Guias e DP: o que o escritório já enviou pelo nads e, desde
 * 27/11/2026 ("procura no drive"), as listas da pasta do Drive dos últimos meses (fiscalArquivos / dpArquivos, sem o que o
 * DP tirou em dpEnviosFora). Boleto: só o lote já mandado por e-mail. Só lê quando o cliente pede.
 */
async function registrosDe(tipo, e, citados = []) {
  const db = st.db;
  if (tipo === 'guias' || tipo === 'dp') {
    const snap = await db.collection('solicitacoesEmail').where('codigo', '==', e.codigo).where('tipo', '==', tipo === 'guias' ? 'envioFiscal' : 'envioDp').get();
    const enviados = snap.docs.map(d => d.data()).filter(x => x.status === 'enviado').map(x => ({
      competencia: String(x.competencia || ''), enviadoEm: String(x.enviadoEm || ''),
      arquivos: tipo === 'guias'
        ? (Array.isArray(x.guiasDrive) ? x.guiasDrive : []).filter(g => g && g.id).map(g => ({ nome: String(g.nome || ''), id: String(g.id) }))
        : (Array.isArray(x.arquivos) ? x.arquivos : []).filter(id => typeof id === 'string' && id).map(id => ({ nome: '', id })),
    }));
    const colecao = tipo === 'guias' ? 'fiscalArquivos' : 'dpArquivos';
    // os últimos meses e os que o cliente citou ("me manda os documentos de janeiro", 27/11/2026)
    const procurar = [...new Set(W.mesesParaProcurar(Date.now()).concat(citados))];
    const meses = await Promise.all(procurar.map(async competencia => {
      const d = await db.collection(colecao).doc(competencia).get();
      const fora = tipo === 'dp' ? await db.collection('dpEnviosFora').doc(competencia).get() : null;
      return { competencia, doc: d.exists ? d.data() : null, fora: fora && fora.exists ? fora.data() : null };
    }));
    const daPasta = W.registrosDaPasta(meses, String(e.codigo));
    // o envio do DP guarda só os ids: o nome vem da lista da pasta
    const nomes = new Map();
    daPasta.forEach(x => x.arquivos.forEach(a => nomes.set(a.id, a.nome)));
    enviados.forEach(x => x.arquivos.forEach(a => { if (!a.nome) a.nome = nomes.get(a.id) || ''; }));
    return { registros: enviados.concat(daPasta), baixar: a => doDrive(a.id) };
  }
  // o boleto: os contratos da empresa nos Honorários e os boletos já enviados por e-mail
  const contratos = await db.collection('financeiroHonorarios').where('codigo', '==', e.codigo).get();
  const registros = [];
  const dados = new Map();
  for (const c of contratos.docs) {
    const bs = await db.collection('financeiroBoletos').where('contratoId', '==', c.id).get();
    for (const b of bs.docs) {
      const x = b.data();
      // o já enviado por e-mail e, desde 27/11/2026 (a 2ª via), o boleto emitido pelo Efí (efi_<chargeId>), mesmo sem o envio
      const doEfi = b.id.startsWith('efi_') && Number(x.partes) > 0;
      if ((!x.envio || x.envio.status !== 'enviado') && !doEfi) continue;
      dados.set(b.id, x);
      registros.push({ competencia: String(x.competencia || ''), enviadoEm: String((x.envio && x.envio.enviadoEm) || ''), arquivos: [{ nome: 'Boleto de honorários - ' + e.nome + '.pdf', id: b.id }] });
    }
  }
  return {
    registros,
    baixar: async a => ({ nome: a.nome, mime: 'application/pdf', buffer: await require('./lote-dp').bufferDoArquivo(db.collection('financeiroBoletos').doc(a.id), dados.get(a.id)) }),
  };
}

/** A opção que o cliente escolheu no menu: o pedido para falar com a equipe ou os arquivos do mês mais recente. */
async function fazer(acao, r) {
  const e = acao.empresa;
  if (acao.tipo === 'escritorio') { await avisarAEquipe(e, r, 'pediu para falar com o escritório'); return; }
  const achado = await registrosDe(acao.tipo, e).catch(err => { st.log('whatsapp: não achei os documentos (' + acao.tipo + ') de', e.codigo, '-', err.message); return null; });
  const registro = achado ? W.envioMaisRecente(achado.registros) : null;
  const legenda = W.textoDosDocumentos(acao.tipo, e, registro);
  if (!registro) { await enviar(r.numero, { text: legenda }, true); return; }
  const tipo = { guias: 'guia', boleto: 'boleto', dp: 'dp' }[acao.tipo];
  const arquivos = registro.arquivos.map(a => Object.assign({}, a, { nomeNoWhatsapp: W.nomeParaOCliente({ tipo, nome: a.nome, competencia: registro.competencia }, e.nome) }));
  const mandou = await mandarArquivos(r.numero, arquivos, achado.baixar, legenda);
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
function prepararParaOTeste({ db, sockFalso, driveFalso, chavesDoTeste, pasta, log, esperarFalso, claudeFalso, leitorFalso, midiaFalsa }) {
  if (midiaFalsa) baixarMidia = midiaFalsa;
  if (claudeFalso) perguntarAoClaude = claudeFalso;
  if (leitorFalso) lerAGuia = leitorFalso;
  st = { db, log: log || (() => {}), roboRef: { set: async () => {} }, painel: null };
  sock = sockFalso;
  estado = { situacao: 'conectado', numero: '553800000000', motivo: '' };
  chaves = W.lerChaves(chavesDoTeste);
  ARQUIVO_DOS_ENVIOS = path.join(pasta, 'whatsapp-envios.json');
  ARQUIVO_DAS_RESPOSTAS = path.join(pasta, 'whatsapp-respostas-envios.json');
  ARQUIVO_DO_RASTREIO = path.join(pasta, 'whatsapp-rastreio.json');
  ARQUIVO_DAS_CONVERSAS = path.join(pasta, 'whatsapp-conversas.json');
  ARQUIVO_DO_ATENDIMENTO = path.join(pasta, 'whatsapp-atendimento.json');
  ARQUIVO_DOS_AVISOS = path.join(pasta, 'whatsapp-avisos.json');
  enviados = []; respostasEnviadas = []; ultimoEnvio = 0; rastreio = {}; conversas = {}; atendimentos = {};
  esperar = esperarFalso || (async () => {});
  if (driveFalso) drive = () => driveFalso;
}

/**
 * Os avisos do dia (27/11/2026, itens 8 a 10; cada um com a sua chave): uma vez por dia, depois das 9h de Brasília, para quem
 * conversou com o robô nos últimos 60 dias: a guia que vence depois de amanhã (lida no PDF), o certificado digital do Cofre
 * a 15, 5 e 1 dia, e o boleto do Efí vencido e em aberto. Vão pela fila (pedirPeloWhatsapp: a trava e o freio de sempre),
 * para o número que conversou. A regra é do core (avisosDoDia); o que já foi mandado fica em whatsapp-avisos.json.
 */
async function rodarAvisos(agora) {
  if (!st || !(chaves.avisoGuias || chaves.avisoCertificado || chaves.avisoBoleto)) return 0;
  const hojeBr = new Date(agora - 3 * 3600000);
  const hoje = hojeBr.toISOString().slice(0, 10);
  if (hojeBr.getUTCHours() < W.HORA_DOS_AVISOS) return 0;
  const reg = lerJson(ARQUIVO_DOS_AVISOS);
  if (reg.ultimoDia === hoje) return 0;
  reg.ultimoDia = hoje;
  reg.mandados = reg.mandados || {};
  guardarJson(ARQUIVO_DOS_AVISOS, reg, 'os avisos');
  const jaMandados = new Set(Object.keys(reg.mandados));
  const db = st.db;
  let mandou = 0;
  for (const [numero, conversa] of Object.entries(atendimentos)) {
    if (!W.conversouHaPouco(conversa && conversa.vistoEm, agora)) continue;
    const teste = numerosDeTeste().some(t => W.mesmoNumero(t, numero));
    if (!chaves.liberado && !teste) continue;
    const empresas = await empresasDoNumero(numero, teste).catch(() => []);
    const e = (conversa.empresa && empresas.find(x => x.codigo === conversa.empresa.codigo)) || (empresas.length === 1 ? empresas[0] : null);
    if (!e) continue;
    const dados = { empresa: e };
    if (chaves.avisoGuias) {
      const g = await registrosDe('guias', e).catch(() => null);
      const registro = g ? W.envioMaisRecente(g.registros) : null;
      if (registro) {
        dados.guias = [];
        for (const a of registro.arquivos.slice(0, 4)) {
          const lido = await lerAGuia(a.id, () => g.baixar(a)).catch(() => null);
          dados.guias.push(Object.assign({ nome: a.nome, competencia: registro.competencia }, lido || {}));
        }
      }
    }
    if (chaves.avisoCertificado && Number.isFinite(Number(e.codigo))) {
      const c = await db.collection('cofre').where('codigo', '==', Number(e.codigo)).limit(1).get().catch(() => null);
      if (c && !c.empty) dados.certificado = String(c.docs[0].get('validade') || '');
    }
    if (chaves.avisoBoleto) {
      const contratos = await db.collection('financeiroHonorarios').where('codigo', '==', String(e.codigo)).get().catch(() => null);
      dados.boletos = [];
      if (contratos) for (const c of contratos.docs) for (const [competencia, b] of Object.entries(c.get('boletosEfi') || {})) dados.boletos.push(Object.assign({ competencia }, b));
    }
    for (const a of W.avisosDoDia([dados], { avisoGuias: chaves.avisoGuias, avisoCertificado: chaves.avisoCertificado, avisoBoleto: chaves.avisoBoleto }, agora, jaMandados)) {
      const w = await pedirPeloWhatsapp(db, a.tipo, { telefone: numero, cliente: e.nome, clienteId: e.clienteId, mensagem: () => a.texto, extra: { origem: a.tipo } }).catch(err => { st.log('whatsapp: o aviso não foi para a fila:', err.message); return null; });
      if (!w || !w.pedido) continue;
      jaMandados.add(a.chave);
      reg.mandados[a.chave] = new Date(agora).toISOString();
      mandou++;
    }
  }
  // só os avisos dos últimos 90 dias ficam lembrados
  for (const [k, em] of Object.entries(reg.mandados)) if (agora - Date.parse(em) > 90 * 864e5) delete reg.mandados[k];
  guardarJson(ARQUIVO_DOS_AVISOS, reg, 'os avisos');
  if (mandou) st.log('whatsapp: ' + mandou + ' aviso(s) do dia na fila');
  return mandou;
}

module.exports = { prepararParaOTeste, rodarAvisos, filtrarConsole, iniciarWhatsapp, pararWhatsapp, atenderPedido, atenderComando, pedirPeloWhatsapp, chavesDoWhatsapp, receber };
