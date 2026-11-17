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
// reinicia. Mensagem que chega no chip não é lida aqui (por enquanto): fica no celular, como no WhatsApp comum.
const fs = require('fs');
const path = require('path');
const R = require('./whatsapp-regras');

const PASTA_DA_SESSAO = path.join(__dirname, 'whatsapp-sessao');
const ARQUIVO_DOS_ENVIOS = path.join(__dirname, 'whatsapp-envios.json');
/** as mensagens mandadas esperando o tique de entregue/lido: id → { caminho do pedido, em, entregueEm, lidoEm } */
const ARQUIVO_DO_RASTREIO = path.join(__dirname, 'whatsapp-rastreio.json');
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

const agoraIso = () => new Date().toISOString();
const dormir = ms => new Promise(ok => setTimeout(ok, ms));

function gravarEstado(novo) {
  estado = Object.assign({}, novo);
  if (!st) return;
  st.roboRef.set({ whatsapp: R.estadoParaOBanco(estado, Date.now()) }, { merge: true }).catch(err => st.log('whatsapp: não gravei a situação:', err.message));
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

/** Liga junto com o vigia (só na nuvem). Com sessão no disco, reconecta; sem, espera o QR ser pedido. */
function iniciarWhatsapp({ db, log, roboRef, painel }) {
  st = { db, log, roboRef, painel };
  lerEnvios();
  lerRastreio();
  if (temSessao()) conectar(false).catch(falhou);
  else gravarEstado({ situacao: 'desconectado', motivo: 'ainda não conectado: peça o QR code na Central dos robôs' });
}

/** Desliga com o vigia, sem desconectar o celular (a sessão fica no disco para a próxima vez). */
function pararWhatsapp() {
  pararSocket();
}

function naoLigado() {
  return new Error('o WhatsApp só roda no robô da nuvem, e ele não ligou aqui');
}

/**
 * Um pedido da fila (tipo 'whatsapp'). Devolve o que vai no próprio pedido; erro vira exceção com o motivo. `ref`: o pedido
 * no banco (para os tiques); `anexo`: { ler, apagar } do PDF que a tela subiu em partes (o mesmo do disparo, no vigia).
 */
async function atenderPedido(p, ref, anexo) {
  if (!st) throw naoLigado();
  if (estado.situacao !== 'conectado' || !sock) throw new Error('o WhatsApp do robô não está conectado (' + (estado.motivo || estado.situacao) + ')');
  let cliente = null;
  if (p.clienteId) {
    const snap = await st.db.collection('clientes').doc(String(p.clienteId)).get();
    cliente = snap.exists ? snap.data() : null;
  }
  const motivo = R.motivoParaNaoMandar(p, cliente);
  if (motivo) throw new Error(motivo);
  const arquivo = p.anexo && anexo ? await anexo.ler() : null;
  const motivoDoArquivo = R.motivoDoAnexo(arquivo);
  if (motivoDoArquivo) throw new Error(motivoDoArquivo);
  const freio = R.motivoDoFreio(enviados, Date.now());
  if (freio) throw new Error(freio);
  const espera = R.esperaAntesDeMandar(ultimoEnvio, Date.now(), Math.random());
  if (espera) await dormir(espera);
  if (!sock || estado.situacao !== 'conectado') throw new Error('o WhatsApp desconectou antes de mandar');
  const numero = R.numeroDoWhatsApp(p.para);
  let achado = null;
  for (const n of R.variantesDoNumero(numero)) {
    const [a] = await sock.onWhatsApp(R.jidDe(n));
    if (a && a.exists) { achado = a; break; }
  }
  if (!achado) throw new Error(R.numeroFormatado(numero) + ' não tem WhatsApp');
  const texto = String(p.texto).trim();
  // com o PDF, a mensagem vai de legenda dele (uma mensagem só, como o Acessórias)
  const msg = await sock.sendMessage(achado.jid, arquivo
    ? { document: arquivo.buffer, mimetype: arquivo.mime, fileName: arquivo.nome, caption: texto }
    : { text: texto });
  guardarEnvio(Date.now());
  const idDaMensagem = (msg && msg.key && msg.key.id) || '';
  if (idDaMensagem && ref && ref.path) { rastreio[idDaMensagem] = { caminho: ref.path, em: Date.now() }; guardarRastreio(); }
  if (arquivo && anexo) await anexo.apagar().catch(() => {});
  st.log('whatsapp: mandou para', p.clienteNome || R.numeroFormatado(numero));
  return { status: 'enviado', enviadoEm: agoraIso(), whatsappId: idDaMensagem, de: estado.numero, ...(arquivo ? { anexoEnviado: arquivo.nome } : {}) };
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

module.exports = { iniciarWhatsapp, pararWhatsapp, atenderPedido, atenderComando };
