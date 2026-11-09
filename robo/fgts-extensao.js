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

/**
 * A versão do manifest sai do conteúdo da extensão (08/11/2026): o Chrome só troca o service worker de uma extensão sem
 * compactação quando a versão muda, então sem isto uma mudança no servico.js ou nos roteiros podia não chegar ao Chrome.
 */
function manifestoComVersao(textoManifesto, arquivos) {
  const m = JSON.parse(textoManifesto);
  const h = crypto.createHash('sha256');
  for (const nome of Object.keys(arquivos).sort()) h.update(nome + '\0' + arquivos[nome] + '\0');
  const base = String(m.version || '1.0.0').split('.').slice(0, 2).join('.');
  m.version = base + '.' + (parseInt(h.digest('hex').slice(0, 4), 16) % 65535);
  return JSON.stringify(m, null, 2) + '\n';
}

/** Monta a pasta da extensão (os arquivos do repositório + config.js e roteiros.js). true = mudou algo (o Chrome precisa reabrir). */
function prepararExtensao(roteiros) {
  fs.mkdirSync(PASTA_EXT, { recursive: true });
  fs.mkdirSync(BAIXADOS, { recursive: true });
  const arquivos = {
    'servico.js': fs.readFileSync(path.join(__dirname, 'fgts-extensao', 'servico.js'), 'utf8'),
    'config.js': 'self.NADS_FGTS = ' + JSON.stringify({ porta: PORTA, token: token() }) + ';\n',
    'roteiros.js': '// gerado pelo robô (robo/fgts-extensao.js) a partir dos roteiros do fgts-claude.js; não editar aqui\nself.ROTEIROS = {\n  perfil: ' + comoFuncao(roteiros.perfil) + ',\n  guia: ' + comoFuncao(roteiros.guia) + ',\n};\n',
  };
  arquivos['manifest.json'] = manifestoComVersao(fs.readFileSync(path.join(__dirname, 'fgts-extensao', 'manifest.json'), 'utf8'), arquivos);
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
 * 06/11/2026 (Vitor: "ele não tá indo nas config e confirmando se a opção de perguntar está ativada"): só mexer no
 * Preferences não bastava. Com o Chrome já aberto o robô pulava a conferência calado, e a sincronização da conta Google
 * podia religar a opção. Agora vale a política do Chrome do usuário (HKCU\Software\Policies\Google\Chrome,
 * PromptForDownloadLocation = 0), que o Chrome obedece mesmo aberto e a sincronização não desfaz. O robô confere e grava
 * a política toda vez antes de abrir o Chrome, lê de volta para confirmar e, com o Chrome fechado, também acerta o
 * Preferences. Devolve uma linha para o log, sempre.
 */
const CHAVE_POLITICA = 'HKCU\\Software\\Policies\\Google\\Chrome';
function politicaPerguntar(exec) {
  try { const s = exec('reg', ['query', CHAVE_POLITICA, '/v', 'PromptForDownloadLocation']); const m = /PromptForDownloadLocation\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(s); return m ? parseInt(m[1], 16) : null; } catch (e) { return null; }
}
function semPerguntarOndeSalvar(exec = (c, a) => require('child_process').execFileSync(c, a, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }), arq = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', PERFIL_NOME, 'Preferences')) {
  const feito = [];
  // 1) a política (vale com o Chrome aberto ou fechado)
  const antes = politicaPerguntar(exec);
  if (antes !== 0) {
    try { exec('reg', ['add', CHAVE_POLITICA, '/v', 'PromptForDownloadLocation', '/t', 'REG_DWORD', '/d', '0', '/f']); } catch (e) { /* conferido abaixo */ }
  }
  const depois = politicaPerguntar(exec);
  feito.push(depois === 0 ? (antes === 0 ? 'conferi: o "perguntar onde salvar" está desligado pela política do Chrome' : 'desliguei o "perguntar onde salvar" pela política do Chrome (estava ' + (antes === null ? 'sem política' : 'ligado') + ')') : 'NÃO consegui desligar o "perguntar onde salvar" pela política do Chrome: a guia pode ficar esperando o Salvar');
  // 2) o Preferences do perfil (só com o Chrome fechado: ele regrava o arquivo ao fechar)
  try {
    const aberto = /chrome\.exe/i.test(exec('tasklist', ['/FI', 'IMAGENAME eq chrome.exe', '/NH']));
    if (aberto) feito.push('o Chrome já estava aberto: o Preferences fica para a próxima vez, vale a política');
    else {
      const p = JSON.parse(fs.readFileSync(arq, 'utf8'));
      if (!(p.download && p.download.prompt_for_download === false)) {
        p.download = Object.assign({}, p.download, { prompt_for_download: false });
        fs.writeFileSync(arq + '.nads-tmp', JSON.stringify(p));
        fs.renameSync(arq + '.nads-tmp', arq);
        feito.push('e no perfil da nilmacontabilidade também');
      }
    }
  } catch (err) { feito.push('não conferi o Preferences (' + err.message + ')'); }
  return feito.join('; ');
}

/**
 * A tela do servidor apagada (08/11/2026). O NILMA-SERVER fica com a sessão do robô no console, sem ninguém olhando: o
 * vídeo desliga depois de 15 min sem uso (plano de energia), e com a tela apagada (ou bloqueada) o Chrome trata a janela
 * como coberta, a página do gov.br fica "escondida" e o login com o certificado não anda. Em 06/11 a guia saiu com alguém
 * conectado pela Área de Trabalho Remota naquela hora (o log de sessões do Windows: reconexão às 16:53:33); em 08/11, às
 * 21h de um domingo, a sessão estava no console desde 07/11 9h17, sem ninguém, e a página do login ficou parada ~90 s nas
 * quatro tentativas (o histórico do Chrome), sem o formulário do certificado sair. Duas coisas:
 *   - o Chrome que o robô abre não calcula a janela coberta nem freia a página escondida (as opções abaixo);
 *   - enquanto a fila do FGTS roda, o robô pede ao Windows a tela ligada (como um vídeo tocando) e mexe o mouse 1 ponto e
 *     volta, para acender a tela que já apagou. Nada fica gravado: o pedido acaba quando o robô fecha o Chrome (ou em 30 min).
 */
const OPCOES_CHROME = ['--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
const argumentosDoChrome = () => ['--profile-directory=' + PERFIL_NOME, ...OPCOES_CHROME, PORTAL];
let telaAcesa = null;
function acenderTela(log = () => {}) {
  if (process.platform !== 'win32' || (telaAcesa && telaAcesa.exitCode === null && !telaAcesa.killed)) return;
  const ps = "Add-Type -Namespace Nads -Name Tela -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint f); [DllImport(\"user32.dll\")] public static extern void mouse_event(uint f, int x, int y, uint d, System.UIntPtr e);';"
    + ' [Nads.Tela]::mouse_event(1, 1, 0, 0, [UIntPtr]::Zero); [Nads.Tela]::mouse_event(1, -1, 0, 0, [UIntPtr]::Zero);'
    + ' for ($i = 0; $i -lt 60; $i++) { [void][Nads.Tela]::SetThreadExecutionState(0x80000003); Start-Sleep -Seconds 30 }';
  try {
    telaAcesa = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { windowsHide: true, stdio: 'ignore' });
    telaAcesa.on('error', err => { log('FGTS (extensão): não acendi a tela do servidor:', err.message); telaAcesa = null; });
  } catch (err) { log('FGTS (extensão): não acendi a tela do servidor:', err.message); }
}
function apagarTela() { if (telaAcesa) { try { telaAcesa.kill(); } catch (_) { /* já saiu */ } telaAcesa = null; } }

/** Abre o Chrome normal no perfil da nilmacontabilidade e espera a extensão chamar. */
async function abrirChrome(log, roteiros) {
  if (!fs.existsSync(CHROME)) throw new Error('falta o Chrome em ' + CHROME);
  ligarServidor();
  prepararExtensao(roteiros);
  const salvar = semPerguntarOndeSalvar();
  if (salvar) log('FGTS (extensão): ' + salvar);
  acenderTela(log);
  if (conectada()) return;
  spawn(CHROME, argumentosDoChrome(), { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 45 && !conectada(); i++) await dormir(1000);
  if (!conectada()) throw new Error('a extensão "nads - robô do FGTS" não respondeu no Chrome da nilmacontabilidade (está instalada? chrome://extensions, Carregar sem compactação: ' + PASTA_EXT + ')');
  log('FGTS (extensão): Chrome aberto e extensão ligada');
}

async function fecharChrome(log = () => {}) {
  apagarTela();
  if (!conectada()) return;
  const r = await mandar({ tipo: 'fechar' }, 10000);
  if (!r.erro) { log('FGTS (extensão): fila acabou, Chrome fechado'); ultimoContato = 0; }
}

const logado = t => /fgtsdigital\.sistema\.gov\.br/.test(t.url) && /Trocar Perfil|Definir Perfil|Empregador:/i.test(t.texto);
const pedeLogin = t => /acesso\.gov\.br/.test(t.url) || /Entrar com gov\.?br/i.test(t.texto);
// o gov.br avisa que o hCaptcha invisível (que roda ao clicar no certificado) não validou: o botão volta e dá para clicar de novo
const erroHcaptcha = t => /hCaptcha/i.test((t.avisos || []).join(' ')) || /N[ãa]o foi poss[íi]vel validar o hCaptcha/i.test(t.texto || '');

/** Tira CPF, CNPJ e números longos de um texto que vai para o log e para o pedido. */
const semDocumentos = s => String(s || '').replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{8,}/g, '…');

/**
 * O que a página mostrava, em uma linha sem dados sensíveis (08/11/2026: "o login não foi" não dizia nada). Ex.:
 * 'ficou em sso.acesso.gov.br/login ("Acesso gov.br"), com a página escondida para o Chrome (a tela do servidor apagada ou
 * bloqueada); o gov.br mostrou "Não foi possível validar o hCaptcha…"; cliquei 3 vez(es) em "Seu certificado digital"'
 */
function descreverTela(t, cliques = 0) {
  t = t || {};
  let onde = 'sem página';
  try { const u = new URL(t.url); onde = u.host + u.pathname.replace(/\/$/, ''); } catch (_) { /* sem url */ }
  const partes = ['ficou em ' + onde + (t.titulo ? ' ("' + semDocumentos(t.titulo).slice(0, 60) + '")' : '')];
  if (t.visivel && t.visivel !== 'visible') partes[0] += ', com a página escondida para o Chrome (a tela do servidor apagada ou bloqueada)';
  const avisos = (t.avisos || []).map(a => semDocumentos(a).replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (avisos.length) partes.push('o gov.br mostrou "' + avisos.join(' / ').slice(0, 160) + '"');
  else if (erroHcaptcha(t)) partes.push('o gov.br mostrou "Não foi possível validar o hCaptcha"');
  if (t.certCarregando) partes.push('o botão do certificado ficou carregando (o Chrome pode estar pedindo para escolher o certificado na tela do servidor)');
  if (/acesso\.gov\.br/.test(t.url || '')) partes.push(cliques ? 'cliquei ' + cliques + ' vez(es) em "Seu certificado digital"' : 'não achei o botão "Seu certificado digital"');
  else if (!avisos.length && t.texto) partes.push('a página dizia "' + semDocumentos(t.texto).replace(/\s+/g, ' ').trim().slice(0, 120) + '"');
  return partes.join('; ');
}

const ESPERA_LOGIN_MS = 150000;
const NOVO_CLIQUE_MS = 40000;
const MAX_CLIQUES = 3;

/**
 * '' (logado) ou { erro: 'login' | 'captcha', detalhe }. Não digita nada: o certificado é escolhido pela regra do Chrome.
 * 08/11/2026: clicava uma vez só em "Seu certificado digital"; se o hCaptcha invisível do gov.br falhasse (o botão volta
 * e aparece "Não foi possível validar o hCaptcha"), o robô esperava parado. Agora clica de novo (até 3 vezes) quando o
 * gov.br mostra o erro ou o botão volta sem a página andar, e diz no log e no pedido o que a página mostrava.
 */
async function garantirLogin(passo, dep = {}) {
  const enviar = dep.mandar || mandar;
  const esperar = dep.dormir || dormir;
  const agora = dep.agora || Date.now;
  const registrar = dep.log || ((...m) => aoLog(...m));
  const lerAqui = async () => (await enviar({ tipo: 'ler' }, 30000)).valor || { url: '', texto: '', captcha: false };
  await enviar({ tipo: 'abrir', url: PORTAL });
  let t = await lerAqui();
  for (let i = 0; i < 20 && !logado(t) && !pedeLogin(t); i++) { await esperar(1000); t = await lerAqui(); }
  if (logado(t)) return '';
  passo('entrando no gov.br com o certificado do escritório');
  const ate = agora() + ESPERA_LOGIN_MS;
  let cliques = 0, ultimoClique = 0, contou = false;
  while (agora() < ate) {
    t = await lerAqui();
    if (t.captcha) { registrar('FGTS (extensão): o gov.br pediu o "não sou um robô":', descreverTela(t, cliques)); return { erro: 'captcha', detalhe: descreverTela(t, cliques) }; }
    if (logado(t)) { if (cliques > 1) registrar('FGTS (extensão): entrou no gov.br no clique ' + cliques + ' do certificado'); return ''; }
    if (/acesso\.gov\.br/.test(t.url)) {
      if (!contou) { contou = true; registrar('FGTS (extensão): na tela de login do gov.br, página ' + (t.visivel || '?') + (t.foco === undefined ? '' : ', foco ' + (t.foco ? 'sim' : 'não'))); }
      const deNovo = cliques > 0 && cliques < MAX_CLIQUES && !t.certCarregando && (erroHcaptcha(t) || agora() - ultimoClique >= NOVO_CLIQUE_MS);
      if (!cliques || deNovo) {
        if (deNovo) registrar('FGTS (extensão): clicando de novo no certificado:', descreverTela(t, cliques));
        if ((await enviar({ tipo: 'clicar', fonte: '^Seu certificado digital$' })).valor) { cliques++; ultimoClique = agora(); }
      }
    } else if (/fgtsdigital/.test(t.url) && /Entrar com gov\.?br/i.test(t.texto)) await enviar({ tipo: 'clicar', fonte: 'Entrar com gov\\.?br' });
    await esperar(2000);
  }
  t = await lerAqui();
  const detalhe = descreverTela(t, cliques);
  registrar('FGTS (extensão): desisti do login depois de ' + Math.round(ESPERA_LOGIN_MS / 1000) + ' s:', detalhe);
  return { erro: t.captcha ? 'captcha' : 'login', detalhe };
}

/** O lote, um cliente por vez (a mesma interface do fgts-chrome.rodarNoChrome). */
async function rodarPelaExtensao(itens, roteiros, aoPasso, aoResultado, log, ehEscritorio) {
  aoLog = log;
  try { await abrirChrome(log, roteiros); } catch (err) { aoResultado('', { erro: err.message }); return { erro: err.message }; }
  const primeiro = itens.find(it => !it.fim);
  if (!primeiro) return { erro: '' };
  const entrada = await garantirLogin(t => aoPasso(primeiro.cnpj, t));
  if (entrada) { aoResultado('', entrada); return { erro: entrada.erro }; }
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
        if (e) { aoResultado('', e); return { erro: e.erro }; }
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

module.exports = { rodarPelaExtensao, fecharChrome, prepararExtensao, comoFuncao, BAIXADOS, PASTA_EXT, CHROME, _teste: { ligarServidor, mandar, conectada, semPerguntarOndeSalvar, garantirLogin, descreverTela, manifestoComVersao, argumentosDoChrome } };
