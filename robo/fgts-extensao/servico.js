// A extensão do robô do FGTS (Vitor, 03/11/2026: o gov.br pedia o "não sou um robô" e a confirmação de identidade no
// Chrome aberto pelo robô; "se for no perfil não"). Fica instalada no Chrome da nilmacontabilidade do NILMA-SERVER: o
// Chrome é o normal, no perfil de verdade, e esta extensão faz o que o robô (robo/fgts-extensao.js, no mesmo computador)
// pede, uma coisa por vez: abrir o portal, ler a tela, clicar no login com certificado e rodar os dois roteiros
// (o perfil e a guia rápida). Não roda código que venha de fora: os roteiros estão em roteiros.js, gerado pelo robô.
// Só fala com 127.0.0.1, com o código de config.js (também gerado pelo robô).
importScripts('config.js', 'roteiros.js');

const BASE = 'http://127.0.0.1:' + self.NADS_FGTS.porta;
const TOKEN = self.NADS_FGTS.token;
const PERMITIDOS = [/^https:\/\/fgtsdigital\.sistema\.gov\.br\//, /^https:\/\/([\w-]+\.)*acesso\.gov\.br\//];
const dormir = ms => new Promise(r => setTimeout(r, ms));
let abaDoRobo = null;
let rodando = false;

const ao = (caminho, corpo) => fetch(BASE + caminho + '?token=' + encodeURIComponent(TOKEN), corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

async function aba() {
  if (abaDoRobo != null) { try { await chrome.tabs.get(abaDoRobo); return abaDoRobo; } catch (_) { abaDoRobo = null; } }
  const ja = (await chrome.tabs.query({})).find(t => PERMITIDOS.some(re => re.test(t.url || '')));
  abaDoRobo = ja ? ja.id : (await chrome.tabs.create({ url: 'about:blank', active: true })).id;
  return abaDoRobo;
}

function esperarCarregar(id, ms) {
  return new Promise(resolve => {
    const fim = setTimeout(() => { chrome.tabs.onUpdated.removeListener(ouvir); resolve(); }, ms);
    function ouvir(tid, info) { if (tid === id && info.status === 'complete') { clearTimeout(fim); chrome.tabs.onUpdated.removeListener(ouvir); resolve(); } }
    chrome.tabs.onUpdated.addListener(ouvir);
  });
}

async function naPagina(func, args) {
  const id = await aba();
  const [r] = await chrome.scripting.executeScript({ target: { tabId: id }, func, args: args || [] });
  return r ? r.result : null;
}

// o que roda na página (sem nada de fora)
function lerTela() {
  const visivelGrande = f => { const r = f.getBoundingClientRect(); const s = getComputedStyle(f); return r.width > 250 && r.height > 60 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || 1) > 0.1; };
  // 08/11/2026: o login parou sem dizer o que a página mostrava. Agora vêm também: se a página está visível para o Chrome
  // (escondida = a janela tida como coberta: a tela do servidor apagada ou bloqueada), as mensagens na tela (o erro do
  // hCaptcha do gov.br, por exemplo) e se o botão do certificado ficou "carregando"
  const cert = document.getElementById('login-certificate');
  return {
    url: location.href,
    titulo: String(document.title || '').slice(0, 100),
    texto: document.body ? document.body.innerText.slice(0, 6000) : '',
    captcha: [...document.querySelectorAll('iframe[src*="hcaptcha"], iframe[src*="recaptcha"]')].some(visivelGrande),
    visivel: document.visibilityState,
    foco: document.hasFocus(),
    avisos: [...document.querySelectorAll('[role=alert], .br-message, .alert, .error, .erro')]
      .filter(e => e.offsetParent !== null).map(e => (e.innerText || '').trim()).filter(Boolean).slice(0, 3).map(t => t.slice(0, 200)),
    certCarregando: !!(cert && (cert.disabled || cert.classList.contains('loading'))),
  };
}
function clicarTexto(fonte) {
  const re = new RegExp(fonte, 'i');
  const el = [...document.querySelectorAll('button, a, [role=button], input[type=submit]')]
    .find(e => e.offsetParent !== null && re.test((e.innerText || e.value || e.getAttribute('aria-label') || '').trim()));
  if (!el) return false;
  el.click();
  return true;
}

async function executar(cmd) {
  switch (cmd.tipo) {
    case 'ola': return { valor: 'ok' };
    case 'abrir': {
      if (!PERMITIDOS.some(re => re.test(cmd.url))) return { erro: 'endereço fora do FGTS Digital e do gov.br' };
      const id = await aba();
      await chrome.tabs.update(id, { url: cmd.url, active: true });
      await esperarCarregar(id, 60000);
      return { valor: (await chrome.tabs.get(id)).url };
    }
    case 'ler': return { valor: await naPagina(lerTela) };
    case 'clicar': return { valor: await naPagina(clicarTexto, [String(cmd.fonte)]) };
    case 'perfil':
    case 'guia': {
      try { return { valor: await naPagina(self.ROTEIROS[cmd.tipo], [cmd.dados]) }; }
      // a página trocou no meio (o Definir do perfil navega): é o esperado
      catch (err) { return { navegou: true, erro: String(err && err.message || err) }; }
    }
    case 'fechar': {
      setTimeout(async () => { for (const w of await chrome.windows.getAll()) chrome.windows.remove(w.id).catch(() => {}); }, 500);
      return { valor: 'fechando' };
    }
    default: return { erro: 'comando desconhecido: ' + cmd.tipo };
  }
}

// a guia baixada: o robô copia para a pasta dele
chrome.downloads.onChanged.addListener(async d => {
  if (!d.state || d.state.current !== 'complete') return;
  const [item] = await chrome.downloads.search({ id: d.id });
  if (item && /\.pdf$/i.test(item.filename)) ao('/baixou', { arquivo: item.filename, url: item.finalUrl || item.url }).catch(() => {});
});

// pede trabalho ao robô (a espera longa do lado dele segura a conversa aberta)
async function laco() {
  if (rodando) return;
  rodando = true;
  try {
    for (;;) {
      let r;
      try { r = await ao('/tarefa'); } catch (_) { await dormir(3000); continue; }
      if (r.status === 204) continue;
      if (r.status !== 200) { await dormir(3000); continue; }
      const cmd = await r.json();
      let res;
      try { res = await executar(cmd); } catch (err) { res = { erro: String(err && err.message || err) }; }
      await ao('/resposta', Object.assign({ id: cmd.id }, res)).catch(() => {});
    }
  } finally { rodando = false; }
}

chrome.alarms.create('acordar', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => laco());
chrome.runtime.onStartup.addListener(() => laco());
chrome.runtime.onInstalled.addListener(() => laco());
laco();
