// O FGTS Digital pelo robô, sem o Claude, no Chrome do NILMA-SERVER (Vitor, 03/11/2026: "quero mover o fgts para o
// servidor como um robo assim como o resto, sem claude, no chrome do servidor ja abre direto, sem problema").
//
// É o mesmo caminho do fgts-claude.js (os dois roteiros que o Claude colava na página, ROTEIRO_PERFIL e ROTEIRO_GUIA),
// agora rodados direto pelo robô: um Chrome só do robô (o perfil NADS_LOCAL\robo\fgts-chrome, com a porta de controle;
// o Chrome não deixa ligar a porta no perfil de sempre), aberto na sessão do Administrador, onde estão o certificado
// e-CNPJ do escritório e a regra do Chrome que escolhe esse certificado sozinho no gov.br. O robô só se liga nele: a
// janela fica aberta e logada entre os lotes, e reiniciar o robô não perde o login.
//
// O login: se o portal pedir, clica em "Entrar com gov.br" e em "Seu certificado digital" (o Chrome escolhe o
// certificado). Nunca resolve verificação "não sou um robô" nem digita senha: com captcha, o lote para com o motivo.
// O PDF da guia baixa numa pasta local (NADS_LOCAL\robo\fgts-baixados), longe do Claudio Secretario (o arquivador de
// lá pegaria o PDF antes), e o fgts-claude.js arquiva como sempre.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { ROBO } = require('./pastas-locais');

const CHROME = process.env.FGTS_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PERFIL = path.join(ROBO, 'fgts-chrome');
const BAIXADOS = path.join(ROBO, 'fgts-baixados');
const PORTA = Number(process.env.FGTS_PORTA || 9334);
const PORTAL = 'https://fgtsdigital.sistema.gov.br/portal/servicos';
const GUIA_RAPIDA = 'https://fgtsdigital.sistema.gov.br/cobranca/#/gestao-guias/emissao-guia-rapida';
const dormir = ms => new Promise(r => setTimeout(r, ms));

/** A porta de controle do Chrome do robô responde? */
function chromeNoAr() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: PORTA, path: '/json/version', timeout: 2000 }, r => { r.resume(); resolve(r.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// o perfil do Chrome da nilmacontabilidade@gmail.com (o Default do Administrador; Vitor, 03/11/2026: "ele tem que abrir
// no perfil da nilmacontabilidade"): o Chrome não deixa ligar a porta de controle no perfil padrão, então o robô abre
// uma cópia dele, refeita a cada vez que o Chrome do robô abre (os cookies do gov.br e do portal vêm juntos; a chave
// deles é do usuário do Windows, o mesmo Administrador). Sem os caches, que só pesam.
const PERFIL_ORIGEM = process.env.FGTS_PERFIL_ORIGEM || path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
function copiarPerfilDaNilma(log) {
  const nome = process.env.FGTS_PERFIL_NOME || 'Default';
  if (!fs.existsSync(path.join(PERFIL_ORIGEM, nome))) { log('FGTS (robô): sem o perfil ' + nome + ' do Chrome em ' + PERFIL_ORIGEM + '; abrindo o perfil do robô'); return; }
  try { fs.copyFileSync(path.join(PERFIL_ORIGEM, 'Local State'), path.join(PERFIL, 'Local State')); } catch (err) { log('FGTS (robô): não copiei o Local State:', err.message); }
  const r = require('child_process').spawnSync('robocopy', [path.join(PERFIL_ORIGEM, nome), path.join(PERFIL, 'Default'), '/MIR', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP',
    '/XD', 'Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'CacheStorage', 'ScriptCache', 'Service Worker', 'File System', 'IndexedDB', 'blob_storage', 'Extensions'], { windowsHide: true, encoding: 'utf8' });
  // robocopy: 0 a 7 é sucesso; 8 ou mais, algum arquivo não veio (o Chrome da pessoa aberto segura um ou outro)
  log('FGTS (robô): perfil da nilmacontabilidade copiado' + (r.status >= 8 ? ' (com arquivos presos: ' + String(r.stdout || '').trim().split('\n').slice(-2).join(' ').slice(0, 160) + ')' : ''));
}

/** Liga no Chrome do robô (abre se estiver fechado). Devolve { browser, page }. */
async function ligarNoChrome(log = () => {}) {
  if (!fs.existsSync(CHROME)) throw new Error('falta o Chrome em ' + CHROME);
  fs.mkdirSync(PERFIL, { recursive: true });
  fs.mkdirSync(BAIXADOS, { recursive: true });
  if (!(await chromeNoAr())) {
    copiarPerfilDaNilma(log);
    spawn(CHROME, ['--remote-debugging-port=' + PORTA, '--user-data-dir=' + PERFIL, '--no-first-run', '--no-default-browser-check', '--lang=pt-BR', PORTAL],
      { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    for (let i = 0; i < 30 && !(await chromeNoAr()); i++) await dormir(1000);
    if (!(await chromeNoAr())) throw new Error('o Chrome do robô não abriu a porta de controle');
  }
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORTA, defaultViewport: null });
  // o PDF da guia baixa sozinho na pasta do robô
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: BAIXADOS, eventsEnabled: true });
  const abas = await browser.pages();
  const page = abas.find(p => /fgtsdigital|acesso\.gov\.br/.test(p.url())) || abas[0] || await browser.newPage();
  await page.bringToFront().catch(() => {});
  return { browser, page };
}

const visivelNoTexto = async (page, re) => re.test(await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => ''));

/** Clica no primeiro botão ou link visível com este texto. */
async function clicarTexto(page, re) {
  return page.evaluate(fonte => {
    const re = new RegExp(fonte, 'i');
    const el = [...document.querySelectorAll('button, a, [role=button], input[type=submit]')]
      .find(e => e.offsetParent !== null && re.test((e.innerText || e.value || e.getAttribute('aria-label') || '').trim()));
    if (!el) return false;
    el.click();
    return true;
  }, re.source).catch(() => false);
}

/**
 * Há uma verificação "não sou um robô" NA TELA? (03/11/2026: a página de login do gov.br carrega um hCaptcha invisível
 * sempre; só conta o quadro que aparece de verdade, com tamanho de desafio)
 */
const temCaptcha = page => page.evaluate(() => [...document.querySelectorAll('iframe[src*="hcaptcha"], iframe[src*="recaptcha"]')]
  .some(f => { const r = f.getBoundingClientRect(); const s = getComputedStyle(f); return r.width > 250 && r.height > 60 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || 1) > 0.1; })).catch(() => false);

/** O portal já está com alguém logado (o alto mostra o empregador ou o botão de perfil)? */
const logado = async page => /fgtsdigital\.sistema\.gov\.br/.test(page.url()) && await visivelNoTexto(page, /Trocar Perfil|Definir Perfil|Empregador:/i);

/**
 * Garante o login no portal. Devolve '' (logado), 'login' ou 'captcha'. Não digita nada: o certificado é escolhido pela
 * regra do Chrome (AutoSelectCertificateForUrls).
 */
async function garantirLogin(page, passo) {
  await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  // espera a página dizer de que lado está: logada (o perfil) ou pedindo o gov.br (03/11/2026: com 3 s fixos, a página
  // ainda carregando passava por logada)
  const precisa = async () => /acesso\.gov\.br/.test(page.url()) || await visivelNoTexto(page, /Entrar com gov\.?br/i);
  for (let i = 0; i < 20 && !(await logado(page)) && !(await precisa()); i++) await dormir(1000);
  if (await logado(page)) return '';
  passo('entrando no gov.br com o certificado do escritório');
  if (!/acesso\.gov\.br/.test(page.url())) { await clicarTexto(page, /Entrar com gov\.?br/); await dormir(4000); }
  const ate = Date.now() + 90000;
  let clicouCert = false;
  while (Date.now() < ate) {
    if (await temCaptcha(page)) return 'captcha';
    const url = page.url();
    if (await logado(page)) return '';
    if (/acesso\.gov\.br/.test(url) && !clicouCert) clicouCert = await clicarTexto(page, /Seu certificado digital/);
    else if (/fgtsdigital/.test(url)) await clicarTexto(page, /Entrar com gov\.?br/);
    await dormir(2000);
  }
  return (await temCaptcha(page)) ? 'captcha' : 'login';
}

/** O roteiro com a linha DADOS do cliente, pronto para rodar na página (sem o "await" do começo). */
function comDados(roteiro, dados) {
  return roteiro.replace(/const DADOS = \{[^\n]*\};/, 'const DADOS = ' + JSON.stringify(dados) + ';').replace(/^await /, '');
}

const navegou = err => /Execution context was destroyed|navigat|Target closed|detached|context/i.test(String(err && err.message || err));

/**
 * Roda os clientes do lote, um por vez, na mesma aba. aoPasso(cnpj, texto); aoResultado(cnpj, res), sem cnpj para o lote
 * todo (login, captcha). itens: [{ cnpj, portal, competencia, modo, fim }] (fim = cancelado: pula). Devolve { erro }.
 */
async function rodarNoChrome(itens, roteiros, aoPasso, aoResultado, log, ehEscritorio) {
  let browser, page;
  try { ({ browser, page } = await ligarNoChrome(log)); } catch (err) {
    aoResultado('', { erro: 'o Chrome do robô não abriu: ' + err.message });
    return { erro: err.message };
  }
  try {
    const primeiro = itens.find(it => !it.fim);
    if (!primeiro) return { erro: '' };
    const entrada = await garantirLogin(page, t => aoPasso(primeiro.cnpj, t));
    if (entrada) { aoResultado('', { erro: entrada }); return { erro: entrada }; }
    for (const it of itens) {
      if (it.fim) continue;
      const doc = it.portal || it.cnpj;
      const [ano, mes] = it.competencia.split('-');
      const cnpjMascara = doc.length === 11 ? doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      let res = null;
      for (let tentativa = 0; tentativa < 2 && !res; tentativa++) {
        if (it.fim) break;
        if (tentativa) {
          aoPasso(it.cnpj, 'tentando de novo');
          const e = await garantirLogin(page, t => aoPasso(it.cnpj, t));
          if (e) { aoResultado('', { erro: e }); return { erro: e }; }
        }
        aoPasso(it.cnpj, 'definindo o perfil ' + (ehEscritorio(doc) ? 'Meu Perfil (o escritório)' : 'Procurador de ' + cnpjMascara));
        await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await dormir(1500);
        let perfil;
        try { perfil = String(await page.evaluate(comDados(roteiros.perfil, { cnpj: cnpjMascara, proprio: ehEscritorio(doc) }))); }
        catch (err) { perfil = navegou(err) ? 'OK: a página trocou' : 'ERRO: ' + err.message; }
        if (/^ERRO_PORTAL:/.test(perfil)) { res = { erro: perfil.replace(/^ERRO_PORTAL:\s*/, '') }; break; }
        if (/^ERRO/.test(perfil)) { log('FGTS (robô): perfil de', it.cnpj, '-', perfil); if (tentativa) res = { erro: 'roteiro: ' + perfil.replace(/^ERRO:\s*/, '') }; continue; }
        await dormir(2500);
        aoPasso(it.cnpj, 'emissão de guia rápida, competência ' + mes + '/' + ano + (it.modo === 'emitir' ? '' : ' (ensaio)'));
        await page.goto(GUIA_RAPIDA, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await dormir(1500);
        let texto;
        try { texto = String(await page.evaluate(comDados(roteiros.guia, { cnpj: cnpjMascara, competencia: mes + '/' + ano, emitir: it.modo === 'emitir' }))); }
        catch (err) { texto = JSON.stringify({ erro: 'roteiro: ' + err.message }); }
        let j;
        try { j = JSON.parse(texto); } catch (_) { j = { erro: 'roteiro: resposta estranha (' + texto.slice(0, 80) + ')' }; }
        // o erro do roteiro (a página não estava como esperado): uma vez mais, entrando de novo; o resto é o resultado
        if (j.erro && /^roteiro:/.test(j.erro) && !tentativa) { log('FGTS (robô): guia de', it.cnpj, '-', j.erro); continue; }
        res = j;
      }
      if (it.fim) continue;
      aoResultado(it.cnpj, res || { erro: 'roteiro: o portal não respondeu como esperado' });
    }
    return { erro: '' };
  } finally {
    // só solta o Chrome: a janela fica aberta e logada para o próximo lote
    try { browser.disconnect(); } catch (_) { /* já solto */ }
  }
}

module.exports = { rodarNoChrome, ligarNoChrome, garantirLogin, comDados, BAIXADOS, PERFIL, PORTA, CHROME };
