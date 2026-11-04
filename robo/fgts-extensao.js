// O FGTS do NILMA-SERVER pela extensão (03/11/2026). O Chrome aberto pelo robô com a porta de controle (fgts-chrome.js)
// esbarrava no "não sou um robô" do gov.br e na confirmação de identidade da conta Google ("se for no perfil não"): agora
// o robô abre o Chrome normal, no perfil da nilmacontabilidade, e a extensão robo/fgts-extensao (instalada uma vez nesse
// perfil, "Carregar sem compactação" de NADS_LOCAL\robo\fgts-extensao) faz os passos que o robô pede por um endereço só
// deste computador (127.0.0.1, com um código guardado na pasta do robô).
//
// O caminho é o mesmo do fgts-chrome.js e do Claude: o login com o certificado (o Chrome escolhe sozinho, pela regra
// AutoSelectCertificateForUrls), o ROTEIRO_PERFIL e o ROTEIRO_GUIA. O PDF baixado vem para NADS_LOCAL\robo\fgts-baixados
// (a extensão avisa o caminho; o robô copia), e o fgts-claude.js arquiva como sempre. No fim da fila, fecha o Chrome.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { ROBO } = require('./pastas-locais');

const CHROME = process.env.FGTS_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PERFIL_NOME = process.env.FGTS_PERFIL_NOME || 'Default';
const PASTA_EXT = path.join(ROBO, 'fgts-extensao');
const BAIXADOS = path.join(ROBO, 'fgts-baixados');
const PORTA = Number(process.env.FGTS_PORTA_EXT || 9335);
const PORTAL = 'https://fgtsdigital.sistema.gov.br/portal/servicos';
const GUIA_RAPIDA = 'https://fgtsdigital.sistema.gov.br/cobranca/#/gestao-guias/emissao-guia-rapida';
const dormir = ms => new Promise(r => setTimeout(r, ms));

/** O roteiro (o texto que o Claude colava) como função da extensão: async function (DADOS) { … }. */
function comoFuncao(roteiro) {
  const linhas = String(roteiro).split('\n');
  if (!/^await \(async \(\) => \{\s*$/.test(linhas[0]) || !/^\}\)\(\)\s*$/.test(linhas[linhas.length - 1])) throw new Error('roteiro em formato inesperado');
  const corpo = linhas.slice(1, -1).filter(l => !/^\s*const DADOS = \{.*\};\s*$/.test(l));
  return 'async function (DADOS) {\n' + corpo.join('\n') + '\n}';
}

function token() {
  const arq = path.join(ROBO, 'fgts-extensao-codigo.txt');
  try { const t = fs.readFileSync(arq, 'utf8').trim(); if (t.length >= 32) return t; } catch (_) { /* primeira vez */ }
  const t = crypto.randomBytes(24).toString('hex');
  fs.mkdirSync(ROBO, { recursive: true });
  fs.writeFileSync(arq, t);
  return t;
}

/** Monta a pasta da extensão (os arquivos do repositório + config.js e roteiros.js). true = mudou algo (o Chrome precisa reabrir). */
function prepararExtensao(roteiros) {
  fs.mkdirSync(PASTA_EXT, { recursive: true });
  fs.mkdirSync(BAIXADOS, { recursive: true });
  const arquivos = {
    'manifest.json': fs.readFileSync(path.join(__dirname, 'fgts-extensao', 'manifest.json'), 'utf8'),
    'servico.js': fs.readFileSync(path.join(__dirname, 'fgts-extensao', 'servico.js'), 'utf8'),
    'config.js': 'self.NADS_FGTS = ' + JSON.stringify({ porta: PORTA, token: token() }) + ';\n',
    'roteiros.js': '// gerado pelo robô (robo/fgts-extensao.js) a partir dos roteiros do fgts-claude.js; não editar aqui\nself.ROTEIROS = {\n  perfil: ' + comoFuncao(roteiros.perfil) + ',\n  guia: ' + comoFuncao(roteiros.guia) + ',\n};\n',
  };
  let mudou = false;
  for (const [nome, texto] of Object.entries(arquivos)) {
    const f = path.join(PASTA_EXT, nome);
    let antes = null;
    try { antes = fs.readFileSync(f, 'utf8'); } catch (_) { /* novo */ }
    if (antes !== texto) { fs.writeFileSync(f, texto); mudou = true; }
  }
  return mudou;
}

// a conversa com a extensão: ela pede trabalho (espera longa em /tarefa) e devolve em /resposta
const fila = [];
const esperando = new Map();
let pedindo = null;
let ultimoContato = 0;
let servidor = null;
let aoLog = () => {};

function ligarServidor() {
  if (servidor) return;
  const codigo = token();
  servidor = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.searchParams.get('token') !== codigo) { res.writeHead(403); res.end(); return; }
    if (req.method === 'GET' && u.pathname === '/tarefa') {
      ultimoContato = Date.now();
      if (fila.length) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(fila.shift())); return; }
      if (pedindo) { pedindo.writeHead(204); pedindo.end(); }
      pedindo = res;
      const t = setTimeout(() => { if (pedindo === res) { pedindo = null; res.writeHead(204); res.end(); } }, 25000);
      res.on('close', () => { clearTimeout(t); if (pedindo === res) pedindo = null; });
      return;
    }
    if (req.method === 'POST' && (u.pathname === '/resposta' || u.pathname === '/baixou')) {
      let corpo = '';
      req.on('data', b => { corpo += b; if (corpo.length > 1e6) req.destroy(); });
      req.on('end', () => {
        res.writeHead(200); res.end();
        let j = null; try { j = JSON.parse(corpo); } catch (_) { return; }
        if (u.pathname === '/resposta') { const e = esperando.get(j.id); if (e) { esperando.delete(j.id); e(j); } return; }
        // o PDF que o Chrome baixou: uma cópia na pasta do robô (onde o fgts-claude espera)
        try { if (/\.pdf$/i.test(j.arquivo) && fs.existsSync(j.arquivo)) fs.copyFileSync(j.arquivo, path.join(BAIXADOS, path.basename(j.arquivo))); } catch (err) { aoLog('FGTS (extensão): não copiei o PDF baixado:', err.message); }
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  servidor.on('error', err => aoLog('FGTS (extensão): o endereço local não abriu:', err.message));
  servidor.listen(PORTA, '127.0.0.1');
}

/** Manda um comando para a extensão e espera a resposta ({ valor } ou { erro }). */
function mandar(cmd, ms = 90000) {
  const id = crypto.randomBytes(6).toString('hex');
  return new Promise(resolve => {
    const t = setTimeout(() => { esperando.delete(id); resolve({ erro: 'a extensão não respondeu (' + cmd.tipo + ')' }); }, ms);
    esperando.set(id, r => { clearTimeout(t); resolve(r); });
    const c = Object.assign({ id }, cmd);
    if (pedindo) { const p = pedindo; pedindo = null; p.writeHead(200, { 'Content-Type': 'application/json' }); p.end(JSON.stringify(c)); }
    else fila.push(c);
  });
}

const conectada = () => Date.now() - ultimoContato < 35000;

/**
 * O "Perguntar onde salvar cada arquivo antes de fazer download" desligado no perfil (Vitor, 04/11/2026: "não tem como ele
 * vir nas configurações e verificar isso?"): com ele ligado, a guia esperava alguém clicar em Salvar na tela do servidor.
 * Só com o Chrome fechado (ele regrava o Preferences ao fechar). Devolve o que fez, para o log.
 */
function semPerguntarOndeSalvar() {
  const arq = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', PERFIL_NOME, 'Preferences');
  try {
    const aberto = /chrome\.exe/i.test(require('child_process').execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome.exe', '/NH'], { encoding: 'utf8', windowsHide: true }));
    if (aberto) return '';
    const p = JSON.parse(fs.readFileSync(arq, 'utf8'));
    if (p.download && p.download.prompt_for_download === false) return '';
    p.download = Object.assign({}, p.download, { prompt_for_download: false });
    fs.writeFileSync(arq + '.nads-tmp', JSON.stringify(p));
    fs.renameSync(arq + '.nads-tmp', arq);
    return 'desliguei o "perguntar onde salvar" do Chrome da nilmacontabilidade';
  } catch (err) { return 'não conferi o "perguntar onde salvar" (' + err.message + ')'; }
}

/** Abre o Chrome normal no perfil da nilmacontabilidade e espera a extensão chamar. */
async function abrirChrome(log, roteiros) {
  if (!fs.existsSync(CHROME)) throw new Error('falta o Chrome em ' + CHROME);
  ligarServidor();
  prepararExtensao(roteiros);
  if (conectada()) return;
  const salvar = semPerguntarOndeSalvar();
  if (salvar) log('FGTS (extensão): ' + salvar);
  spawn(CHROME, ['--profile-directory=' + PERFIL_NOME, PORTAL], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 45 && !conectada(); i++) await dormir(1000);
  if (!conectada()) throw new Error('a extensão "nads - robô do FGTS" não respondeu no Chrome da nilmacontabilidade (está instalada? chrome://extensions, Carregar sem compactação: ' + PASTA_EXT + ')');
  log('FGTS (extensão): Chrome aberto e extensão ligada');
}

async function fecharChrome(log = () => {}) {
  if (!conectada()) return;
  const r = await mandar({ tipo: 'fechar' }, 10000);
  if (!r.erro) { log('FGTS (extensão): fila acabou, Chrome fechado'); ultimoContato = 0; }
}

const ler = async () => (await mandar({ tipo: 'ler' }, 30000)).valor || { url: '', texto: '', captcha: false };
const logado = t => /fgtsdigital\.sistema\.gov\.br/.test(t.url) && /Trocar Perfil|Definir Perfil|Empregador:/i.test(t.texto);
const pedeLogin = t => /acesso\.gov\.br/.test(t.url) || /Entrar com gov\.?br/i.test(t.texto);

/** '' (logado), 'login' ou 'captcha'. Não digita nada: o certificado é escolhido pela regra do Chrome. */
async function garantirLogin(passo) {
  await mandar({ tipo: 'abrir', url: PORTAL });
  let t = await ler();
  for (let i = 0; i < 20 && !logado(t) && !pedeLogin(t); i++) { await dormir(1000); t = await ler(); }
  if (logado(t)) return '';
  passo('entrando no gov.br com o certificado do escritório');
  const ate = Date.now() + 90000;
  let clicouCert = false;
  while (Date.now() < ate) {
    t = await ler();
    if (t.captcha) return 'captcha';
    if (logado(t)) return '';
    if (/acesso\.gov\.br/.test(t.url) && !clicouCert) clicouCert = !!(await mandar({ tipo: 'clicar', fonte: 'Seu certificado digital' })).valor;
    else if (/fgtsdigital/.test(t.url) && /Entrar com gov\.?br/i.test(t.texto)) await mandar({ tipo: 'clicar', fonte: 'Entrar com gov\\.?br' });
    await dormir(2000);
  }
  return (await ler()).captcha ? 'captcha' : 'login';
}

/** O lote, um cliente por vez (a mesma interface do fgts-chrome.rodarNoChrome). */
async function rodarPelaExtensao(itens, roteiros, aoPasso, aoResultado, log, ehEscritorio) {
  aoLog = log;
  try { await abrirChrome(log, roteiros); } catch (err) { aoResultado('', { erro: err.message }); return { erro: err.message }; }
  const primeiro = itens.find(it => !it.fim);
  if (!primeiro) return { erro: '' };
  const entrada = await garantirLogin(t => aoPasso(primeiro.cnpj, t));
  if (entrada) { aoResultado('', { erro: entrada }); return { erro: entrada }; }
  for (const it of itens) {
    if (it.fim) continue;
    const doc = it.portal || it.cnpj;
    const [ano, mes] = it.competencia.split('-');
    const mascara = doc.length === 11 ? doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    let res = null;
    for (let tentativa = 0; tentativa < 2 && !res; tentativa++) {
      if (it.fim) break;
      if (tentativa) {
        aoPasso(it.cnpj, 'tentando de novo');
        const e = await garantirLogin(t => aoPasso(it.cnpj, t));
        if (e) { aoResultado('', { erro: e }); return { erro: e }; }
      }
      aoPasso(it.cnpj, 'definindo o perfil ' + (ehEscritorio(doc) ? 'Meu Perfil (o escritório)' : 'Procurador de ' + mascara));
      await mandar({ tipo: 'abrir', url: PORTAL });
      await dormir(1500);
      const rp = await mandar({ tipo: 'perfil', dados: { cnpj: mascara, proprio: ehEscritorio(doc) } }, 60000);
      const perfil = rp.navegou ? 'OK: a página trocou' : rp.erro ? 'ERRO: ' + rp.erro : String(rp.valor || '');
      if (/^ERRO_PORTAL:/.test(perfil)) { res = { erro: perfil.replace(/^ERRO_PORTAL:\s*/, '') }; break; }
      if (/^ERRO/.test(perfil)) { log('FGTS (extensão): perfil de', it.cnpj, '-', perfil); if (tentativa) res = { erro: 'roteiro: ' + perfil.replace(/^ERRO:\s*/, '') }; continue; }
      await dormir(2500);
      aoPasso(it.cnpj, 'emissão de guia rápida, competência ' + mes + '/' + ano + (it.modo === 'emitir' ? '' : ' (ensaio)'));
      await mandar({ tipo: 'abrir', url: GUIA_RAPIDA });
      await dormir(1500);
      const rg = await mandar({ tipo: 'guia', dados: { cnpj: mascara, competencia: mes + '/' + ano, emitir: it.modo === 'emitir' } }, 120000);
      let j;
      try { j = rg.erro ? { erro: 'roteiro: ' + rg.erro } : JSON.parse(String(rg.valor)); } catch (_) { j = { erro: 'roteiro: resposta estranha (' + String(rg.valor).slice(0, 80) + ')' }; }
      if (j.erro && /^roteiro:/.test(j.erro) && !tentativa) { log('FGTS (extensão): guia de', it.cnpj, '-', j.erro); continue; }
      res = j;
    }
    if (it.fim) continue;
    aoResultado(it.cnpj, res || { erro: 'roteiro: o portal não respondeu como esperado' });
  }
  return { erro: '' };
}

module.exports = { rodarPelaExtensao, fecharChrome, prepararExtensao, comoFuncao, BAIXADOS, PASTA_EXT, CHROME, _teste: { ligarServidor, mandar, conectada } };
