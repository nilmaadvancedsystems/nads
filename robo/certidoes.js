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
  if (p.orgao !== 'municipal') return 'órgão que o robô ainda não emite (' + String(p.orgao) + ')';
  if (!/^\d{14}$/.test(String(p.cnpj || ''))) return 'sem o CNPJ da empresa (14 números)';
  if (!Number.isInteger(Number(p.codigo)) || Number(p.codigo) <= 0) return 'sem o código da empresa';
  return '';
}

/** a prefeitura respondeu que não tem a empresa (não adianta tentar de novo) */
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
    painel.fazendo(ROBO, 'Certidão municipal de ' + quem(p));
    try {
      const r = await o.portal.emitir(String(p.cnpj));
      if (r.erro) {
        if (semCadastroNaPrefeitura(r.erro)) {
          await o.gravarResumo(Number(p.codigo), { codigo: Number(p.codigo), municipalSemCadastro: diaEHora(agora()).dia });
          throw Object.assign(new Error('a prefeitura não tem a empresa no cadastro: ' + r.erro), { final: true });
        }
        throw new Error(r.erro);
      }
      const c = P.certidaoMunicipalDoTexto(r.texto);
      if (!c) throw new Error('a página aberta não é a certidão');
      if (c.cnpj && c.cnpj.slice(0, 8) !== String(p.cnpj).slice(0, 8)) throw Object.assign(new Error('a certidão é de outro CNPJ (' + c.cnpj + ')'), { final: true });
      const bytes = r.pdf;
      if (!bytes || bytes.length < 5 || Buffer.from(bytes.slice(0, 5)).toString('latin1') !== '%PDF-') throw new Error('o PDF da certidão não saiu');
      let arquivo = '';
      try { arquivo = await o.gravarPdf(p, P.nomeDoPdfDaCertidao(c), bytes); }
      catch (err) { o.log('Certidões: o PDF de', quem(p), 'não foi para o Drive -', err.message); }
      const resumo = { numero: c.numero, emitidaEm: c.emitidaEm, vence: c.vence, chave: c.chave, negativa: c.negativa, consultadoEm: new Date(agora()).toISOString() };
      await o.gravarResumo(Number(p.codigo), { codigo: Number(p.codigo), municipal: resumo, municipalSemCadastro: '' });
      await it.ref.update({ status: 'pronto', fimEm: new Date(agora()).toISOString(), erro: '', resultado: Object.assign({ arquivo }, resumo) });
      painel.atividade(ROBO, 'Certidão municipal de ' + quem(p) + (c.negativa ? '' : ' (POSITIVA)'), 'vence em ' + (c.vence || '?').split('-').reverse().join('/'));
      feitos++;
    } catch (err) {
      const motivo = String((err && err.message) || err).slice(0, 300);
      const deNovo = !(err && err.final) && tentativas < MAX_TENTATIVAS;
      await it.ref.update({ status: deNovo ? 'pendente' : 'erro', erro: motivo, fimEm: new Date(agora()).toISOString() });
      painel.erro(ROBO, 'A certidão municipal de ' + quem(p) + (deNovo ? ' fica para a próxima volta' : ' não saiu'), motivo, { pedido: it.ref.id });
      o.log('Certidões:', quem(p), '-', motivo);
    } finally {
      painel.fazendo(ROBO, null);
    }
  }
  return { feitos };
}

// ---------- o portal de verdade (um Chrome só do robô, sem janela: a prefeitura não pede certificado) ----------

function criarPortalDeTaiobeiras(log) {
  let browser = null;
  return {
    async emitir(cnpj) {
      if (!browser) {
        const CHROME = require('./fgts-chrome').CHROME;
        browser = await require('puppeteer-core').launch({ executablePath: CHROME, headless: true, args: ['--lang=pt-BR', '--no-first-run'] });
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
        const temCampo = await page.evaluate(() => {
          const c = [...document.querySelectorAll('input[type=text]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !/pesquis|digite o que/i.test(e.placeholder || ''); }).pop();
          if (!c) return false;
          c.setAttribute('data-nads-cnpj', '1');
          return true;
        }).catch(() => false);
        if (!temCampo) return { erro: 'não achei o campo do CNPJ' };
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
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        const texto = await page.evaluate(() => document.body ? document.body.innerText : '');
        const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' } });
        return { texto, pdf: Buffer.from(pdf) };
      } finally {
        await page.close().catch(() => {});
      }
    },
    async fechar() { try { if (browser) await browser.close(); } catch (_) { /* já fechado */ } browser = null; },
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
    const portal = criarPortalDeTaiobeiras(log);
    try {
      const lote = [...fila].sort((a, b) => (Number(!!b.dados.naFrente) - Number(!!a.dados.naFrente)) || String(a.dados.criadoEm || '').localeCompare(String(b.dados.criadoEm || '')));
      await atenderPedidos({
        pedidos: lote, portal, log, painel,
        parar: () => pausaLocal.estaPausado(ROBO) || ocupado.parando(),
        gravarResumo: (codigo, parcial) => db.collection('certidoes').doc(String(codigo)).set(parcial, { merge: true }),
        gravarPdf,
      });
    } catch (err) {
      log('Certidões: o lote não abriu -', err.message);
      painel.erro(ROBO, 'O lote das certidões não abriu', err.message);
    } finally {
      await portal.fechar();
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
      const algumaPronta = [...resumos.values()].some(r => r.municipal && r.municipal.emitidaEm);
      const ontemDia = diaEHora(Date.now() - 86400000).dia;
      const ontemSnap = await db.collection(COLECAO).where('lote', '==', ontemDia).get();
      const ontem = ontemSnap.empty ? null : { total: ontemSnap.size, prontos: ontemSnap.docs.filter(d => d.get('status') === 'pronto').length, erros: ontemSnap.docs.filter(d => d.get('status') === 'erro').length };
      const motivo = motivoParaNaoPedir({ algumaPronta, ontem });
      loteFeitoEm = dia;
      if (motivo) { log('Certidões: sem lote hoje -', motivo); return; }
      const empresas = (await require('./clientes-cache').clientesAtivos(db)).docs.map(d => {
        const x = d.data() || {};
        return { codigo: Number(String(x.codigo != null && x.codigo !== '' ? x.codigo : x.codigoOrigem || '').replace(/\D/g, '')), nome: String(x.nome || x.razaoSocial || ''), cnpj: String(x.documento || '').replace(/\D/g, '') };
      });
      const naFila = new Set(fila.map(it => Number(it.dados.codigo)));
      const plano = P.certidoesParaPedir({ empresas, resumos, naFila, hoje: dia, limite: Number(cfg.porDia) > 0 ? Math.min(60, Number(cfg.porDia)) : POR_DIA });
      const em = new Date().toISOString();
      for (const p of plano) await db.collection(COLECAO).add(Object.assign(p, { lote: dia, criadoEm: em, criadoPor: 'Robô (lote do dia)', criadoPorUid: 'robo' }));
      log('Certidões: lote do dia', dia, '-', plano.length, 'empresa(s)');
      if (plano.length) painel.atividade(ROBO, 'Lote do dia das certidões municipais: ' + plano.length + ' empresa(s)', '');
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

module.exports = { iniciarCertidoes, atenderPedidos, criarPortalDeTaiobeiras, motivoDoPedidoRuim, motivoParaNaoPedir, semCadastroNaPrefeitura, diaEHora, COLECAO, PORTAL_TAIOBEIRAS, POR_DIA };
