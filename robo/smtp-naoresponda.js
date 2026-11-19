'use strict';
// Os e-mails para os clientes pela caixa naoresponda@nilmacontabilidade.com (19/11/2026). O e-mail de senha da Área do
// Cliente saía pela caixa do robô (Gmail) e caía no spam do cliente; o dono criou a caixa naoresponda no painel da
// Hostinger, que é onde está o e-mail do domínio (o SPF do domínio já autoriza a Hostinger).
//
// A caixa é da Hostinger, não do Google: o robô manda por SMTP (smtp.hostinger.com, porta 465, com TLS), sem biblioteca
// nova. A senha da caixa nunca fica no código nem no banco: o dono põe no metadado "smtp-naoresponda-senha" da máquina
// robo-nilma (ou na variável SMTP_NAORESPONDA_SENHA). Sem a senha, ou se o SMTP falhar, o e-mail sai como antes, pela
// caixa do robô (o reserva): o cliente não fica sem o e-mail.

const tls = require('tls');
const os = require('os');
const crypto = require('crypto');
const { montarMensagem } = require('./mensagem-gmail');

const ENDERECO = 'naoresponda@nilmacontabilidade.com';
const REMETENTE = 'Nilma Contabilidade <' + ENDERECO + '>';
const SERVIDOR = { host: 'smtp.hostinger.com', port: 465 };
const URL_META = 'http://metadata.google.internal/computeMetadata/v1/instance/attributes/smtp-naoresponda-senha';

// A conversa SMTP num socket já aberto (TLS na nuvem; texto puro no teste). -> o código da resposta final do DATA.
function conversarSmtp(socket, { usuario, senha, de, para, mensagem, nome = os.hostname() || 'robo-nilma' }) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let esperando = null;
    const chegadas = [];   // resposta que chega antes de alguém esperar
    const fim = setTimeout(() => falhar(new Error('o servidor de e-mail não respondeu a tempo')), 60 * 1000);
    function falhar(e) { clearTimeout(fim); socket.destroy(); reject(e); }
    socket.setEncoding('utf8');
    socket.on('error', falhar);
    socket.on('data', pedaco => {
      buffer += pedaco;
      // uma resposta termina na linha "250 ..." (com espaço depois do código); "250-..." continua
      const linhas = buffer.split('\r\n');
      buffer = linhas.pop();
      for (const l of linhas) {
        if (/^\d{3} /.test(l) || /^\d{3}$/.test(l)) { const e = esperando; esperando = null; if (e) e(l); else chegadas.push(l); }
      }
    });
    const resposta = () => new Promise(r => { if (chegadas.length) r(chegadas.shift()); else esperando = r; });
    async function passo(comando, esperado, mostrar = comando) {
      if (comando !== null) socket.write(comando + '\r\n');
      const l = await resposta();
      if (!String(l).startsWith(esperado)) throw new Error('o servidor de e-mail recusou (' + (mostrar || 'conexão') + '): ' + l);
      return l;
    }
    (async () => {
      await passo(null, '220', 'conexão');
      await passo('EHLO ' + nome, '250', 'EHLO');
      await passo('AUTH LOGIN', '334');
      await passo(Buffer.from(usuario).toString('base64'), '334', 'usuário');
      await passo(Buffer.from(senha).toString('base64'), '235', 'senha');   // a senha nunca vai para o log
      await passo('MAIL FROM:<' + de + '>', '250', 'MAIL FROM');
      await passo('RCPT TO:<' + para + '>', '25', 'RCPT TO');
      await passo('DATA', '354');
      // linha que começa com ponto ganha outro ponto (o fim da mensagem é "." sozinho)
      const corpo = mensagem.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
      const final = await passo(corpo + '\r\n.', '250', 'mensagem');
      socket.write('QUIT\r\n');
      clearTimeout(fim);
      socket.end();
      resolve(final);
    })().catch(falhar);
  });
}

// A mensagem crua (o mesmo montador dos e-mails do robô) com os cabeçalhos que o Gmail punha sozinho: Date e Message-ID.
function mensagemCrua(dados) {
  const id = '<' + crypto.randomBytes(12).toString('hex') + '@nilmacontabilidade.com>';
  const cabecalhos = ['Date: ' + new Date().toUTCString().replace('GMT', '+0000'), 'Message-ID: ' + id].concat(dados.cabecalhos || []);
  return Buffer.from(montarMensagem(Object.assign({}, dados, { de: REMETENTE, cabecalhos })), 'base64url').toString('utf8');
}

/** deps: { reserva: { enviar }, log, lerSenha?, conectar? } -> { enviar, endereco } */
function criarCorreioNaoresponda({ reserva, log, lerSenha = senhaDaMaquina, conectar = conectarTls }) {
  async function enviar(dados) {
    const senha = await lerSenha().catch(() => '');
    if (!senha) return reserva.enviar(dados);
    try {
      const para = String(dados.para || '').trim();
      const socket = await conectar();
      await conversarSmtp(socket, { usuario: ENDERECO, senha, de: ENDERECO, para, mensagem: mensagemCrua(dados) });
      return 'smtp';
    } catch (e) {
      log('Caixa naoresponda: não saiu pela Hostinger (' + e.message + '); vai pela caixa do robô');
      return reserva.enviar(dados);
    }
  }
  return { enviar, endereco: ENDERECO };
}

function conectarTls() {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host: SERVIDOR.host, port: SERVIDOR.port, servername: SERVIDOR.host }, () => resolve(s));
    s.once('error', reject);
    s.setTimeout(30 * 1000, () => s.destroy(new Error('a conexão com o servidor de e-mail demorou')));
  });
}

// A senha: a variável de ambiente ou o metadado da máquina da nuvem (lido no máximo a cada 5 minutos).
const cache = { em: 0, valor: '' };
async function senhaDaMaquina() {
  if (process.env.SMTP_NAORESPONDA_SENHA) return process.env.SMTP_NAORESPONDA_SENHA;
  if (Date.now() - cache.em < 5 * 60 * 1000) return cache.valor;
  cache.em = Date.now();
  try {
    const r = await fetch(URL_META, { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(3000) });
    cache.valor = r.ok ? (await r.text()).trim() : '';
  } catch (e) { cache.valor = ''; }
  return cache.valor;
}

module.exports = { criarCorreioNaoresponda, conversarSmtp, mensagemCrua, ENDERECO };
