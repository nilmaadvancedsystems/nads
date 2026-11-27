// As certidões pelo robô (27/11/2026, o dono: "certidões digitais"; a municipal de Taiobeiras primeiro). Roda no NILMA-SERVER,
// num processo próprio (robo-modulo.js certidoes).
//
// A municipal de Taiobeiras: o portal GPI da prefeitura (sem login, sem captcha). O caminho, conferido em 27/11/2026: Emissão
// de Documentos › "CERTIDAO NEGATIVA DE DEBITOS MUNICIPAIS" › filtro CNPJ › o CNPJ › Imprimir; o portal abre a certidão em
// HTML (reportHtml?idDocumento=…). O campo do CNPJ tem máscara e é "meio bugado" (o dono): o texto colado de uma vez não
// vale ("Código de emissão não informado!"), e o que entra com o cursor fora do começo vai depois da máscara. Por isso o robô
// limpa o campo, volta ao começo e digita tecla por tecla.
//
// O que faz em cada pedido (pedidosCertidao/{id}: { status: 'pendente', orgao: 'municipal', cnpj, codigo, empresa }): emite,
// lê a certidão (core tarefas.certidoes), confere o CNPJ, salva o PDF na entrada do arquivador (Claudio Secretario/<aaaa-mm>/
// <cód> - <nome>/CND - MUNICIPAL - Venc. dd.mm.aaaa.pdf; o arquivador já arquiva em SOCIETÁRIO\CERTIDÕES\MUNICIPAL, e dali
// vêm a Área do Cliente e a tarefa de renovar) e guarda o resumo em certidoes/{código}. A empresa que a prefeitura não tem
// fica marcada (municipalSemCadastro) e não entra mais no lote.
//
// O lote do dia: uma vez por dia, depois das 7h, as empresas ativas sem a certidão ou com ela vencendo em até 10 dias (até
// 15 por dia), só depois da primeira certidão que deu certo e não se o lote de ontem só deu erro. config/certidoes:
// automatico false desliga; porDia muda o tamanho (até 60).
'use strict';
const fs = require('fs');
const path = require('path');

const COLECAO = 'pedidosCertidao';
const ROBO = 'certidoes';
const NOME = 'Certidões';
const ENTRADA = process.env.CERTIDOES_ENTRADA || 'G:\\Meu Drive\\Claudio Secretario';
const PORTAL_TAIOBEIRAS = 'https://gpi17.cloud.el.com.br/ServerExec/acessoBase/?idPortal=cbbbcdf6-33fc-4449-abb4-28178f54f3ae&idFunc=f452dd1d-392b-4929-88b3-1116265adebb';
const MAX_TENTATIVAS = 3;
const POR_DIA = 15;
const ESPERA_ENTRE_MS = 20000;
const dormirPadrao = ms => new Promise(r => setTimeout(r, ms));
const core = () => require('./gerado/danfse');

// ---------- funções puras (o teste-certidoes.js roda sem banco e sem portal) ----------

function motivoDoPedidoRuim(p) {
  if (!p || typeof p !== 'object') return 'pedido vazio';
  if (!ORGAOS[p.orgao]) return 'órgão que o robô ainda não emite (' + String(p.orgao) + ')';
  if (!/^\d{14}$/.test(String(p.cnpj || ''))) return 'sem o CNPJ da empresa (14 números)';
  if (!Number.isInteger(Number(p.codigo)) || Number(p.codigo) <= 0) return 'sem o código da empresa';
  return '';
}

/** os órgãos que o robô emite: o nome na tela, a leitura do core e as chaves do resumo (certidoes/{código}) */
const ORGAOS = {
  municipal: { nome: 'Certidão municipal', ler: P => P.certidaoMunicipalDoTexto, chave: 'municipal', semCadastro: 'municipalSemCadastro', quem: 'a prefeitura' },
  // o CRF do FGTS (27/11/2026, o dono: "o do fgts, usa o mesmo estilo do fgts que já puxamos"): o Chrome do robô do FGTS
  fgts: { nome: 'CRF do FGTS', ler: P => P.certidaoFgtsDoTexto, chave: 'fgts', semCadastro: 'fgtsSemCadastro', quem: 'a Caixa' },
  // a CDT de Minas (27/11/2026): o Login Único da SEF-MG com o certificado do escritório
  estadual: { nome: 'Certidão estadual (MG)', ler: P => P.certidaoEstadualDoTexto, chave: 'estadual', semCadastro: 'estadualSemCadastro', quem: 'a SEF-MG' },
};

/** a prefeitura (ou a Caixa) respondeu que não tem a empresa (não adianta tentar de novo) */
const semCadastroNaPrefeitura = msg => /n[aã]o (foi )?(encontrad|cadastrad|localizad)|inexistente|sem cadastro|nenhum (registro|contribuinte)/i.test(String(msg || ''));

/** O dia (aaaa-mm-dd) e a hora em Brasília. */
function diaEHora(ms) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))) p[x.type] = x.value;
  return { dia: p.year + '-' + p.month + '-' + p.day, hora: Number(p.hour) };
}

/** O lote do dia pode começar? '' = pode. Só depois da primeira certidão boa; não se o lote de ontem só deu erro. */
function motivoParaNaoPedir({ algumaPronta, ontem }) {
  if (!algumaPronta) return 'ainda não saiu nenhuma certidão pelo robô (peça uma pela Central primeiro)';
  if (ontem && ontem.total >= 3 && ontem.prontos === 0 && ontem.erros >= Math.ceil(ontem.total / 2)) return 'o lote de ontem só deu erro (' + ontem.erros + ' de ' + ontem.total + '); o portal pode ter mudado';
  return '';
}

const quem = p => String(p.codigo) + ' ' + String(p.empresa || '').slice(0, 40);

/**
 * Atende os pedidos, um por vez, com ESPERA_ENTRE_MS entre um e outro. Tudo de fora vem em `o` (o teste passa versões falsas):
 * o.pedidos [{ ref, dados }]; o.portal { emitir(cnpj) → { texto, pdf } | { erro } }; o.gravarResumo(codigo, parcial);
 * o.gravarPdf(pedido, nome, bytes) → caminho; o.agora(), o.dormir(ms), o.log, o.painel, o.parar().
 */
async function atenderPedidos(o) {
  const P = core();
  const agora = o.agora || Date.now;
  const dormir = o.dormir || dormirPadrao;
  const painel = o.painel || { fazendo() {}, atividade() {}, erro() {} };
  let feitos = 0, primeiro = true;
  for (const it of o.pedidos) {
    if (o.parar && o.parar()) break;
    const p = it.dados;
    const ruim = motivoDoPedidoRuim(p);
    if (ruim) { await it.ref.update({ status: 'erro', erro: ruim, fimEm: new Date(agora()).toISOString() }); continue; }
    if (!primeiro) await dormir(ESPERA_ENTRE_MS);
    primeiro = false;
    const tentativas = (Number(p.tentativas) || 0) + 1;
    await it.ref.update({ status: 'trabalhando', inicioEm: new Date(agora()).toISOString(), tentativas });
    const org = ORGAOS[p.orgao];
    painel.fazendo(ROBO, org.nome + ' de ' + quem(p));
    try {
      const portal = (o.portais && o.portais[p.orgao]) || o.portal;
      const r = await portal.emitir(String(p.cnpj));
      if (r.erro) {
        if (semCadastroNaPrefeitura(r.erro)) {
          await o.gravarResumo(Number(p.codigo), { codigo: Number(p.codigo), [org.semCadastro]: diaEHora(agora()).dia });
          throw Object.assign(new Error(org.quem + ' não tem a empresa no cadastro: ' + r.erro), { final: true });
        }
        throw Object.assign(new Error(r.erro), { final: !!r.final });
      }
      const c = org.ler(P)(r.texto);
      if (!c) throw new Error('a página aberta não é a certidão · tela: ' + String(r.texto || '').replace(/\s+/g, ' ').slice(0, 400));
      if (c.cnpj && c.cnpj.slice(0, 8) !== String(p.cnpj).slice(0, 8)) throw Object.assign(new Error('a certidão é de outro CNPJ (' + c.cnpj + ')'), { final: true });
      const bytes = r.pdf;
      if (!bytes || bytes.length < 5 || Buffer.from(bytes.slice(0, 5)).toString('latin1') !== '%PDF-') throw new Error('o PDF da certidão não saiu');
      let arquivo = '';
      try { arquivo = await o.gravarPdf(p, P.nomeDoPdfDaCertidao(Object.assign({ orgao: p.orgao }, c)), bytes); }
      catch (err) { o.log('Certidões: o PDF de', quem(p), 'não foi para o Drive -', err.message); }
      const resumo = { numero: c.numero, emitidaEm: c.emitidaEm, vence: c.vence, chave: c.chave, negativa: c.negativa, consultadoEm: new Date(agora()).toISOString() };
      await o.gravarResumo(Number(p.codigo), { codigo: Number(p.codigo), [org.chave]: resumo, [org.semCadastro]: '' });
      await it.ref.update({ status: 'pronto', fimEm: new Date(agora()).toISOString(), erro: '', resultado: Object.assign({ arquivo }, resumo) });
      painel.atividade(ROBO, org.nome + ' de ' + quem(p) + (c.negativa ? '' : ' (POSITIVA)'), 'vence em ' + (c.vence || '?').split('-').reverse().join('/'));
      feitos++;
    } catch (err) {
      const motivo = String((err && err.message) || err).slice(0, 300);
      const deNovo = !(err && err.final) && tentativas < MAX_TENTATIVAS;
      await it.ref.update({ status: deNovo ? 'pendente' : 'erro', erro: motivo, fimEm: new Date(agora()).toISOString() });
      painel.erro(ROBO, org.nome + ' de ' + quem(p) + (deNovo ? ' fica para a próxima volta' : ' não saiu'), motivo, { pedido: it.ref.id });
      o.log('Certidões:', quem(p), '-', motivo);
    } finally {
      painel.fazendo(ROBO, null);
    }
  }
  return { feitos };
}

// ---------- o portal de verdade (um Chrome só do robô, sem janela: a prefeitura não pede certificado) ----------

// Um Chrome sem janela só, para o lote inteiro (27/11/2026, a sexta volta: a municipal e o CRF abriam um cada, e o segundo dava
// "The browser is already running"). Pasta de perfil própria, por processo; fecha no fim do lote (fecharSemJanela).
let semJanelaDoLote = null;
async function chromeSemJanela() {
  if (semJanelaDoLote && semJanelaDoLote.isConnected()) return semJanelaDoLote;
  const os = require('os');
  const pasta = path.join(os.tmpdir(), 'nads-certidoes-' + process.pid + '-' + Date.now());
  semJanelaDoLote = await require('puppeteer-core').launch({ executablePath: require('./fgts-chrome').CHROME, headless: true, userDataDir: pasta, args: ['--lang=pt-BR', '--no-first-run'] });
  return semJanelaDoLote;
}
async function fecharSemJanela() {
  try { if (semJanelaDoLote) await semJanelaDoLote.close(); } catch (_) { /* já fechado */ }
  semJanelaDoLote = null;
}

function criarPortalDeTaiobeiras(log) {
  let browser = null, doFgts = false;
  return {
    async emitir(cnpj) {
      // o Chrome sem janela; se ele não abrir (27/11/2026: não abre enquanto o do FGTS está aberto), o Chrome do robô do FGTS
      if (!browser) {
        try { browser = await chromeSemJanela(); doFgts = false; }
        catch (err) { log('Certidões: o Chrome sem janela não abriu (' + String(err.message || err).slice(0, 80) + '); uso o do robô'); ({ browser } = await require('./fgts-chrome').ligarNoChrome(log)); doFgts = true; }
      }
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(PORTAL_TAIOBEIRAS, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
        // 27/11/2026, a primeira volta no servidor: o portal deixa a camada "Aguarde..." (div.mostrar_carregando e o
        // DialogBoxLoad) por cima da tela por uns 24 s depois de abrir, e de novo a cada passo; o clique dado com ela por cima
        // não chega. Antes de cada passo, o robô espera ela sumir.
        const esperarLivre = (ms = 90000) => page.waitForFunction(() => ![...document.querySelectorAll('.mostrar_carregando, .DialogBoxLoad')].some(e => {
          const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05;
        }), { timeout: ms, polling: 500 }).then(() => true, () => false);
        await page.waitForFunction(() => [...document.querySelectorAll('p.gpi-fav-card-title, p')].some(p => /^Emiss[aã]o de Documentos$/i.test((p.innerText || '').trim())), { timeout: 90000, polling: 1000 }).catch(() => {});
        await esperarLivre();
        // o cartão "Emissão de Documentos" (o cartão inteiro: div.gpi-fav-card)
        const clicarNoCartao = () => page.evaluate(() => {
          const t = [...document.querySelectorAll('p.gpi-fav-card-title, p')].find(p => /^Emiss[aã]o de Documentos$/i.test((p.innerText || '').trim()));
          const c = t && (t.closest('.gpi-fav-card') || t);
          if (!c) return false;
          c.click();
          return true;
        }).catch(() => false);
        let abriu = false;
        for (let i = 0; i < 4 && !abriu; i++) {
          if (!(await clicarNoCartao())) { await dormirPadrao(3000); continue; }
          abriu = await page.waitForFunction(() => /CERTIDAO NEGATIVA DE DEBITOS MUNICIPAIS/i.test(document.body.innerText || ''), { timeout: 20000 }).then(() => true, () => false);
          if (!abriu) await esperarLivre();
        }
        if (!abriu) return { erro: 'não abri a "Emissão de Documentos" no portal da prefeitura' };
        await esperarLivre();
        await page.waitForFunction(() => [...document.querySelectorAll('label')].some(l => /^CNPJ$/i.test((l.innerText || '').trim()) && l.getBoundingClientRect().width > 0), { timeout: 30000 }).catch(() => {});
        await dormirPadrao(1000);
        // o modelo (a CND municipal) e o filtro (CNPJ), se não estiverem marcados
        const marcados = await page.evaluate(() => {
          const marcar = re => {
            const l = [...document.querySelectorAll('label')].find(x => re.test((x.innerText || '').trim()));
            const r = l && (document.getElementById(l.htmlFor) || (l.parentElement && l.parentElement.querySelector('input[type=radio]')));
            if (!r) return false;
            if (!r.checked) r.click();
            return true;
          };
          return marcar(/^CERTIDAO NEGATIVA DE DEBITOS MUNICIPAIS$/i) && marcar(/^CNPJ$/i);
        }).catch(() => false);
        if (!marcados) return { erro: 'não achei o modelo da certidão ou o filtro CNPJ' };
        await dormirPadrao(1500);
        await esperarLivre();
        // o campo do CNPJ: limpar, voltar ao começo e digitar tecla por tecla
        // 27/11/2026, a terceira volta: o campo aparece depois que a tela se redesenha (ao marcar o modelo e o filtro); o robô
        // espera o campo com a máscara do CNPJ ("__.___.___/____-__") e escolhe ele, não a busca do alto da página
        await page.waitForFunction(() => [...document.querySelectorAll('input')].some(e => /_\._|__\./.test(e.placeholder || '') && e.getBoundingClientRect().width > 0), { timeout: 45000, polling: 500 }).catch(() => {});
        const temCampo = await page.evaluate(() => {
          const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const todos = [...document.querySelectorAll('input')].filter(e => vis(e) && !/radio|checkbox|hidden|button|submit/i.test(e.type || ''));
          const c = todos.find(e => /_\._|__\./.test(e.placeholder || '')) || todos.filter(e => !/pesquis|digite o que/i.test(e.placeholder || '') && !/tt-hint|tt-input/.test(e.className || '')).pop();
          if (!c) return false;
          c.setAttribute('data-nads-cnpj', '1');
          return true;
        }).catch(() => false);
        if (!temCampo) {
          const naTela = String(await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
          return { erro: 'não achei o campo do CNPJ · tela: ' + naTela };
        }
        const campo = await page.$('[data-nads-cnpj="1"]');
        await campo.click({ clickCount: 3 });
        await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Home');
        await page.keyboard.type(cnpj, { delay: 90 });
        await dormirPadrao(1000);
        const digitado = String(await page.$eval('[data-nads-cnpj="1"]', e => e.value).catch(() => '')).replace(/\D/g, '');
        if (digitado !== cnpj) return { erro: 'o campo do CNPJ não aceitou o número (ficou "' + digitado + '")' };
        // a certidão abre numa janela nova: o robô pega o endereço em vez de abrir a janela
        await esperarLivre();
        await page.evaluate(() => { window.__nadsAbriu = []; window.open = u => { window.__nadsAbriu.push(String(u)); return null; }; });
        const imprimiu = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(x => /^\s*Imprimir\s*$/i.test(x.innerText || '') && x.getBoundingClientRect().width > 0);
          if (!b) return false;
          b.click();
          return true;
        }).catch(() => false);
        if (!imprimiu) return { erro: 'não achei o botão Imprimir' };
        let url = '';
        for (let i = 0; i < 60 && !url; i++) {
          await dormirPadrao(1000);
          url = await page.evaluate(() => (window.__nadsAbriu || [])[0] || '').catch(() => '');
          if (!url) {
            const aviso = await page.evaluate(() => {
              const img = document.querySelector('img[src*="dlg_error"], img[src*="dlg_warn"]');
              let p = img && img.parentElement;
              for (let k = 0; k < 5 && p && (p.innerText || '').trim().length < 5; k++) p = p.parentElement;
              return p ? (p.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) : '';
            }).catch(() => '');
            if (aviso) return { erro: 'a prefeitura respondeu: ' + aviso };
          }
        }
        if (!url) return { erro: 'o portal não abriu a certidão' };
        // 27/11/2026, a segunda volta no servidor: a página da certidão chama a impressão sozinha ao abrir, e o PDF dava
        // "Page is already being printed". A certidão é HTML parado: abre sem os scripts da página.
        await page.setJavaScriptEnabled(false);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        const texto = await page.evaluate(() => document.body ? document.body.innerText : '');
        const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' } });
        return { texto, pdf: Buffer.from(pdf) };
      } finally {
        await page.close().catch(() => {});
      }
    },
    async fechar() {
      // o Chrome do robô do FGTS só se solta (fica aberto); o sem janela fecha
      if (browser && doFgts) { try { browser.disconnect(); } catch (_) { /* já solto */ } }
      browser = null; doFgts = false;
      await fecharSemJanela();
    },
  };
}

// ---------- o CRF do FGTS (27/11/2026): consulta-crf.caixa.gov.br no Chrome do robô do FGTS ----------
// A Caixa tem um anti-robô (ShieldSquare) que barra navegador sem janela; o Chrome do robô do FGTS (o perfil da
// nilmacontabilidade, com janela) passa, como passou no teste de 27/11/2026. O caminho: Tipo de Inscrição CNPJ › a inscrição
// › Consultar › "Certificado de Regularidade do FGTS - CRF" › Visualizar (a página de impressão). O PDF é feito num Chrome sem
// janela a partir do HTML da página de impressão. Com o desafio do anti-robô na tela, o pedido para (nunca resolve).
const CRF = 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf';

function criarPortalDoFgts(log) {
  let browser = null;
  return {
    async emitir(cnpj) {
      if (!browser) ({ browser } = await require('./fgts-chrome').ligarNoChrome(log));
      const page = await browser.newPage();
      try {
        await page.goto(CRF, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
        const desafio = await page.evaluate(() => /shieldsquare|captcha/i.test(document.title || '') || [...document.querySelectorAll('iframe')].some(f => /captcha|perfdrive|shieldsquare/i.test(f.src || ''))).catch(() => false);
        if (desafio) return { erro: 'a Caixa mostrou a verificação anti-robô; tento de novo depois', final: false };
        const campo = '[id="mainForm:txtInscricao1"]';
        if (!(await page.$(campo))) return { erro: 'não achei o campo da inscrição na consulta do CRF' };
        await page.evaluate(() => { const s = document.getElementById('mainForm:tipoEstabelecimento'); if (s && s.value !== '1') { s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
        await page.$eval(campo, e => { e.value = ''; });
        await page.type(campo, cnpj, { delay: 60 });
        // 27/11/2026, a terceira volta: a consulta não andava e o robô pegava um link de ajuda que também fala do CRF. Agora espera
        // a página do resultado; se não vier, clica de novo pelo próprio botão. 27/11/2026, a quinta volta: "situação de
        // regularidade do empregador" também está no texto da página INICIAL; o resultado se reconhece pelo "A empresa abaixo
        // identificada" (regular ou não) ou pelo "não são suficientes" (a Caixa não decide sozinha).
        const resultado = () => page.waitForFunction(() => /A empresa abaixo identificada|informa..es dispon.veis n.o s.o suficientes|n.o (foi )?(encontrad|localizad)/i.test(document.body.innerText || ''), { timeout: 30000, polling: 500 }).then(() => true, () => false);
        await page.click('[id="mainForm:btnConsultar"]').catch(() => {});
        let veio = await resultado();
        if (!veio) { await page.evaluate(() => { const b = document.getElementById('mainForm:btnConsultar'); if (b) b.click(); }).catch(() => {}); veio = await resultado(); }
        const consulta = String(await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ');
        if (!veio) return { erro: 'a consulta do CRF não trouxe o resultado · tela: ' + consulta.slice(0, 300) };
        const link = await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /^\s*Certificado de Regularidade do FGTS\s*-\s*CRF\s*$/i.test(x.innerText || '')); if (!a) return false; a.click(); return true; });
        if (!link) {
          // irregular, sem cadastro ou sem informação suficiente: o texto da Caixa vai para o pedido
          const m = /((?:A empresa abaixo identificada|As informa..es dispon.veis|.{0,40}n.o (?:foi )?(?:encontrad|localizad)).{0,220})/i.exec(consulta);
          return { erro: 'a Caixa não deu o CRF: ' + (m ? m[1] : consulta.slice(0, 220)), final: true };
        }
        await page.waitForFunction(() => /Validade:/i.test(document.body.innerText || ''), { timeout: 60000 }).catch(() => {});
        await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}), page.evaluate(() => { const b = document.getElementById('mainForm:btnVisualizar'); if (b) b.click(); })]);
        await page.waitForFunction(() => /Validade:/i.test(document.body.innerText || ''), { timeout: 30000 }).catch(() => {});
        const texto = await page.evaluate(() => document.body.innerText || '');
        const html = await page.content();
        // o PDF: primeiro no próprio Chrome do robô (27/11/2026, a sétima volta: o Chrome sem janela não abre enquanto o do
        // FGTS está aberto, "The browser is already running"); se esse não imprimir, no sem janela
        const limpo = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<head>/i, '<head><base href="https://consulta-crf.caixa.gov.br/consultacrf/pages/">');
        const imprimirEm = async b => {
          const p2 = await b.newPage();
          try {
            // sem os scripts da página (a impressão automática trava o PDF)
            await p2.setJavaScriptEnabled(false);
            await p2.setContent(limpo, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
            return Buffer.from(await p2.pdf({ format: 'A4', printBackground: true, margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' } }));
          } finally { await p2.close().catch(() => {}); }
        };
        let pdf = null, falha = '';
        try { pdf = await imprimirEm(browser); } catch (err) { falha = String(err.message || err).slice(0, 120); }
        if (!pdf) {
          try { pdf = await imprimirEm(await chromeSemJanela()); }
          catch (err) { return { erro: 'o PDF do CRF não saiu (no Chrome do robô: ' + falha + '; no sem janela: ' + String(err.message || err).slice(0, 120) + ')' }; }
        }
        return { texto, pdf };
      } finally {
        await page.close().catch(() => {});
      }
    },
    async fechar() {
      try { if (browser) browser.disconnect(); } catch (_) { /* já solto: o Chrome do FGTS fica aberto */ }
      await fecharSemJanela();
      browser = null;
    },
  };
}

// ---------- a CDT de Minas (27/11/2026): cdt.fazenda.mg.gov.br pelo Login Único da SEF-MG, com o certificado ----------
// O Chrome do robô do FGTS, com o certificado e-CNPJ do escritório; a regra que escolhe o certificado sozinho para a SEF-MG
// o robô acrescenta ao ligar (chrome-certificado.js). O portal por dentro ainda não foi visto (só abre com o certificado):
// o robô procura o campo do CNPJ e o botão de emitir pelos textos de costume e, se algo não fechar, a tela vai junto do erro
// no pedido, para acertar o caminho.
const CDT = 'https://cdt.fazenda.mg.gov.br/';
// 27/11/2026, a sexta volta: a regra do certificado foi gravada com o Chrome do robô já aberto, e ele não a releu; antes do
// primeiro login na SEF-MG, o robô manda o Chrome reler as regras (o botão da página chrome://policy), sem fechar o Chrome
let regrasRelidas = false;
async function relerRegrasDoChrome(browser) {
  if (regrasRelidas) return;
  const p = await browser.newPage();
  try {
    await p.goto('chrome://policy', { timeout: 20000 }).catch(() => {});
    await p.evaluate(() => { const b = document.querySelector('#reload-policies') || [...document.querySelectorAll('button, cr-button')].find(x => /reload|recarregar|atualizar/i.test(x.innerText || '')); if (b) b.click(); }).catch(() => {});
    await dormirPadrao(4000);
    regrasRelidas = true;
  } finally { await p.close().catch(() => {}); }
}
// o que aconteceu com a regra do certificado da SEF-MG ao ligar (vai junto do erro do Login Único)
let regraDoCertificado = 'ainda não conferida';
const SEFMG_PADRAO = 'https://[*.]fazenda.mg.gov.br';

function criarPortalEstadualMG(log) {
  let browser = null;
  return {
    async emitir(cnpj) {
      if (!browser) ({ browser } = await require('./fgts-chrome').ligarNoChrome(log));
      await relerRegrasDoChrome(browser).catch(() => {});
      const page = await browser.newPage();
      const tela = async () => (page.url() + ' · ' + String(await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '')).replace(/\s+/g, ' ')).slice(0, 400);
      // o PDF da certidão: pela resposta (application/pdf) ou pela janela nova
      let pdf = null;
      page.on('response', async r => { try { if (!pdf && /application\/pdf/i.test(r.headers()['content-type'] || '')) pdf = Buffer.from(await r.buffer()); } catch (_) { /* segue */ } });
      try {
        await page.goto(CDT, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
        // o Login Único: "Entrar com Certificado Digital" (o Chrome escolhe o certificado pela regra)
        // 27/11/2026: o endereço do login tem "cdt.fazenda.mg.gov.br" no meio (o redirect_uri); vale o nome do site. O botão é o
        // link #certificate (a entrada por certificado do Login Único).
        const noCdt = () => { try { return new URL(page.url()).host === 'cdt.fazenda.mg.gov.br'; } catch (_) { return false; } };
        if (!noCdt()) {
          await page.waitForSelector('#certificate', { timeout: 30000 }).catch(() => {});
          await page.click('#certificate').catch(() => {});
          await page.waitForFunction(() => location.host === 'cdt.fazenda.mg.gov.br', { timeout: 90000, polling: 1000 }).catch(() => {});
        }
        if (!noCdt()) return { erro: 'o Login Único da SEF-MG não entrou com o certificado (o Chrome pode ter pedido para escolher o certificado; regra: ' + regraDoCertificado + ') · tela: ' + await tela() };
        // 27/11/2026, a sétima volta: dentro da CDT, a tela pede "Selecione uma das opções abaixo para emitir uma nova CDT":
        // CIDADÃO, EMPRESA ou PRODUTOR RURAL PF. O robô escolhe EMPRESA (o menor elemento com esse texto) e espera o campo.
        await page.waitForFunction(() => /EMPRESA/i.test(document.body.innerText || '') || document.querySelectorAll('input').length > 0, { timeout: 60000 }).catch(() => {});
        const escolheu = await page.evaluate(() => {
          const els = [...document.querySelectorAll('button, a, [role=button], div, span, label, li, p, h2, h3, h4')]
            .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && /^\s*EMPRESA\s*$/i.test(e.innerText || ''); });
          if (!els.length) return false;
          els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
          const alvo = els[0].closest('button, a, [role=button]') || els[0];
          alvo.click();
          return true;
        }).catch(() => false);
        if (escolheu) await dormirPadrao(2000);
        await page.waitForFunction(() => document.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox])').length > 0, { timeout: 60000, polling: 500 }).catch(() => {});
        // o campo do CNPJ: pelo rótulo, pelo nome ou pelo placeholder
        const achou = await page.evaluate(() => {
          const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const campos = [...document.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox])')].filter(vis);
          const rotulo = e => ((e.labels && e.labels[0] && e.labels[0].innerText) || e.placeholder || e.name || e.id || e.getAttribute('aria-label') || '');
          const c = campos.find(e => /cnpj|cpf|identifica|inscri|documento/i.test(rotulo(e))) || (campos.length === 1 ? campos[0] : null);
          if (!c) return false;
          c.setAttribute('data-nads-cnpj', '1');
          return true;
        }).catch(() => false);
        if (!achou) return { erro: 'não achei o campo do CNPJ na CDT · tela: ' + await tela() };
        await page.click('[data-nads-cnpj="1"]', { clickCount: 3 }).catch(() => {});
        await page.keyboard.press('Backspace');
        await page.keyboard.type(cnpj, { delay: 60 });
        await page.evaluate(() => { window.__nadsAbriu = []; window.open = u => { window.__nadsAbriu.push(String(u)); return null; }; });
        const clicou = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button, input[type=submit], input[type=button], a')].find(x => x.getBoundingClientRect().width > 0 && /emitir|gerar|consultar|pesquisar|solicitar/i.test((x.innerText || x.value || '').trim()));
          if (!b) return false;
          b.click();
          return true;
        }).catch(() => false);
        if (!clicou) return { erro: 'não achei o botão de emitir na CDT · tela: ' + await tela() };
        for (let i = 0; i < 60 && !pdf; i++) {
          await dormirPadrao(1000);
          const url = await page.evaluate(() => (window.__nadsAbriu || [])[0] || '').catch(() => '');
          if (url) { const r = await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => null); if (r && /pdf/i.test(r.headers()['content-type'] || '')) pdf = Buffer.from(await r.buffer()); break; }
        }
        // o texto da certidão: do PDF (pelo pdf.js do robô) ou da página
        let texto = '';
        if (pdf) { const P = core(); try { texto = P.textoDoPdf(await P.itensDoPdf(new Uint8Array(pdf))); } catch (_) { texto = ''; } }
        if (!pdf) {
          texto = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
          if (!/CERTID/i.test(texto)) return { erro: 'a certidão estadual não veio · tela: ' + await tela() };
          pdf = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }).catch(() => Buffer.alloc(0)));
        }
        return { texto, pdf };
      } finally {
        await page.close().catch(() => {});
      }
    },
    async fechar() { try { if (browser) browser.disconnect(); } catch (_) { /* já solto */ } browser = null; },
  };
}

// ---------- o módulo (robo-modulo.js certidoes) ----------

function iniciarCertidoes(db, log) {
  const painel = require('./painel');
  const pausaLocal = require('./pausa-local');
  const ocupado = require('./ocupado');
  const { ouvir } = require('./ouvinte');
  const P = core();
  painel.modulo(ROBO, NOME, true);
  // a regra do Chrome que escolhe o certificado sozinho no Login Único da SEF-MG (o dono: "pode fazer", 27/11/2026)
  try { regraDoCertificado = require('./chrome-certificado').garantirRegra(SEFMG_PADRAO, 'fazenda.mg.gov.br'); log('Certidões:', regraDoCertificado); }
  catch (err) { log('Certidões: a regra do certificado da SEF-MG não saiu -', err.message); }
  let fila = [];
  let trabalhando = false;
  let loteFeitoEm = '';

  const gravarPdf = async (p, nome, bytes) => {
    if (!fs.existsSync(ENTRADA)) throw new Error('falta a pasta ' + ENTRADA);
    const { pastaDeEntrada } = require('./ecac-pgdas');
    const pasta = pastaDeEntrada(ENTRADA, diaEHora(Date.now()).dia.slice(0, 7), p.codigo, p.empresa);
    fs.mkdirSync(pasta, { recursive: true });
    let arq = path.join(pasta, nome);
    if (fs.existsSync(arq)) arq = arq.replace(/\.pdf$/, ' (' + Date.now() + ').pdf');
    fs.writeFileSync(arq, Buffer.from(bytes));
    return path.relative(ENTRADA, arq);
  };

  async function proximo() {
    if (trabalhando || !fila.length || pausaLocal.estaPausado(ROBO) || ocupado.parando()) return;
    trabalhando = true;
    const portais = { municipal: criarPortalDeTaiobeiras(log), fgts: criarPortalDoFgts(log), estadual: criarPortalEstadualMG(log) };
    try {
      const lote = [...fila].sort((a, b) => (Number(!!b.dados.naFrente) - Number(!!a.dados.naFrente)) || String(a.dados.criadoEm || '').localeCompare(String(b.dados.criadoEm || '')));
      await atenderPedidos({
        pedidos: lote, portais, log, painel,
        parar: () => pausaLocal.estaPausado(ROBO) || ocupado.parando(),
        gravarResumo: (codigo, parcial) => db.collection('certidoes').doc(String(codigo)).set(parcial, { merge: true }),
        gravarPdf,
      });
    } catch (err) {
      log('Certidões: o lote não abriu -', err.message);
      painel.erro(ROBO, 'O lote das certidões não abriu', err.message);
    } finally {
      for (const pt of Object.values(portais)) await pt.fechar().catch(() => {});
      painel.fazendo(ROBO, null);
      trabalhando = false;
    }
  }

  async function loteDoDia() {
    const { dia, hora } = diaEHora(Date.now());
    if (hora < 7 || hora >= 20 || loteFeitoEm === dia || pausaLocal.estaPausado(ROBO) || ocupado.parando()) return;
    try {
      const cfg = (await db.collection('config').doc('certidoes').get()).data() || {};
      if (cfg.automatico === false) { loteFeitoEm = dia; return; }
      if (!(await db.collection(COLECAO).where('lote', '==', dia).limit(1).get()).empty) { loteFeitoEm = dia; return; }
      const resumosSnap = await db.collection('certidoes').get();
      const resumos = new Map(resumosSnap.docs.map(d => [Number(d.id), d.data() || {}]));
      const prontaDo = orgao => [...resumos.values()].some(r => r[orgao] && r[orgao].emitidaEm);
      const ontemDia = diaEHora(Date.now() - 86400000).dia;
      const ontemSnap = await db.collection(COLECAO).where('lote', '==', ontemDia).get();
      const ontem = ontemSnap.empty ? null : { total: ontemSnap.size, prontos: ontemSnap.docs.filter(d => d.get('status') === 'pronto').length, erros: ontemSnap.docs.filter(d => d.get('status') === 'erro').length };
      loteFeitoEm = dia;
      const empresas = (await require('./clientes-cache').clientesAtivos(db)).docs.map(d => {
        const x = d.data() || {};
        return { codigo: Number(String(x.codigo != null && x.codigo !== '' ? x.codigo : x.codigoOrigem || '').replace(/\D/g, '')), nome: String(x.nome || x.razaoSocial || ''), cnpj: String(x.documento || '').replace(/\D/g, '') };
      });
      const limite = Number(cfg.porDia) > 0 ? Math.min(60, Number(cfg.porDia)) : POR_DIA;
      const plano = [];
      for (const orgao of Object.keys(ORGAOS)) {
        // cada órgão só entra no lote depois da primeira certidão dele que deu certo
        const motivo = motivoParaNaoPedir({ algumaPronta: prontaDo(orgao), ontem });
        if (motivo) { log('Certidões: sem o lote de ' + orgao + ' hoje -', motivo); continue; }
        const naFila = new Set(fila.filter(it => it.dados.orgao === orgao).map(it => Number(it.dados.codigo)));
        plano.push(...P.certidoesParaPedir({ empresas, resumos, naFila, hoje: dia, limite, orgao }));
      }
      const em = new Date().toISOString();
      for (const p of plano) await db.collection(COLECAO).add(Object.assign(p, { lote: dia, criadoEm: em, criadoPor: 'Robô (lote do dia)', criadoPorUid: 'robo' }));
      log('Certidões: lote do dia', dia, '-', plano.length, 'empresa(s)');
      if (plano.length) painel.atividade(ROBO, 'Lote do dia das certidões: ' + plano.length + ' pedido(s)', '');
    } catch (err) { log('Certidões: o lote do dia não saiu -', err.message); }
  }

  ouvir('certidoes: pedidos', () => db.collection(COLECAO).where('status', '==', 'pendente'), snap => {
    fila = snap.docs.map(d => ({ ref: d.ref, dados: d.data() || {} }));
    setTimeout(proximo, 1000);
  }, log);
  const t1 = setInterval(proximo, 5 * 60000);
  const t2 = setInterval(() => { void loteDoDia(); }, 10 * 60000);
  for (const t of [t1, t2]) if (t.unref) t.unref();
  setTimeout(() => { void loteDoDia(); }, 90000).unref();
  pausaLocal.quandoRetomar(ROBO, () => setTimeout(proximo, 1000));
  log('Certidões: ligado (a municipal de Taiobeiras)');
}

module.exports = { iniciarCertidoes, atenderPedidos, criarPortalDeTaiobeiras, criarPortalDoFgts, criarPortalEstadualMG, ORGAOS, motivoDoPedidoRuim, motivoParaNaoPedir, semCadastroNaPrefeitura, diaEHora, COLECAO, PORTAL_TAIOBEIRAS, POR_DIA };
