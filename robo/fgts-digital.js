// A guia do FGTS Digital pelo robô (Vitor, 07/10/2026: "tenho que baixar FGTS toda vez pelo site do governo
// manualmente… daria pra mandar a vm fazer isso?"). Roda só na máquina do Google.
//
// Como entra: com o certificado e-CNPJ do ESCRITÓRIO, como procurador. Cada cliente dá procuração ao escritório no
// SPE (o sistema de procuração eletrônica do FGTS Digital, não o do e-CAC); o robô entra uma vez e troca de perfil
// para o CNPJ do cliente. Os certificados dos clientes (o cofre do nads) não são usados: o cofre continua só das
// pessoas (decisão do Vitor, 07/10/2026).
//
// O certificado chega pelos metadados da máquina (segredo-fgts-certificado, o .pfx em base64, e segredo-fgts-senha);
// o iniciar-maquina.sh grava os dois aqui (fgts_certificado.pfx e .senha, só o usuário "robo" lê) e importa o
// certificado no navegador do usuário "robo", com a regra que escolhe esse certificado sozinho no gov.br. Sem o
// certificado ou sem o Chromium, este módulo fica desligado e diz por quê em robo/fgts.
//
// O nads pede em pedidosFgts ({ status: 'pendente', modo, cnpj, codigo, empresa, competencia: 'aaaa-mm' }):
//   modo 'ensaio': só entra (login com o certificado, troca para o cliente) e registra as telas — para conferir o
//                  caminho antes de emitir de verdade;
//   modo 'emitir': entra, emite a guia mensal da competência e guarda o PDF (pedidosFgts/{id}/arquivo/pdf).
// Cada passo fica no pedido (passos: a tela, o endereço e o texto visível) e a foto da tela em telas/{n}: quando o
// portal mudar, dá para ver onde parou sem entrar na máquina.
//
// Nunca passa por cima de verificação de robô: se o gov.br pedir CAPTCHA, o pedido para com status 'captcha' e
// a pessoa faz à mão. Um pedido por vez (a máquina tem 1 GB de memória).
//
// O caminho no portal (os textos dos botões em PASSOS_DO_PORTAL) foi escrito pelo manual, sem ter entrado ainda:
// é a primeira coisa a acertar com o modo 'ensaio' quando o certificado chegar.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ouvir } = require('./ouvinte');

const CERTIFICADO = path.join(__dirname, 'fgts_certificado.pfx');
const SENHA = path.join(__dirname, 'fgts_certificado.senha');
const CHROMIUM = process.env.FGTS_CHROMIUM || '/usr/bin/chromium';
const PORTAL = 'https://fgtsdigital.sistema.gov.br/portal/';
const PASTA_TELAS = path.join(__dirname, 'fgts-telas');
const LIMITE_MS = 6 * 60 * 1000;

// Os textos do caminho no portal (sem acento e minúsculos para comparar). Ajustar aqui quando o ensaio mostrar o
// nome certo de cada botão.
const PASSOS_DO_PORTAL = {
  entrar: [/entrar com.*gov\.?br/, /^entrar$/, /acessar/],
  certificado: [/seu certificado digital/, /certificado digital/],
  trocarPerfil: [/trocar perfil/, /alterar perfil/, /selecionar perfil/],
  procurador: [/procurador/],
  emissao: [/emissao de guia/, /emitir guia/],
  guiaMensal: [/guia (rapida|mensal)/, /mensal/],
  emitir: [/emitir guia/, /^emitir$/, /gerar guia/],
  baixar: [/baixar|download|imprimir|pdf/],
};

const agora = () => new Date().toISOString();
const dormir = ms => new Promise(r => setTimeout(r, ms));
const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cnpjValido = c => /^\d{14}$/.test(String(c || ''));
const competenciaValida = c => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(c || ''));

/** O titular e a validade do certificado do escritório (para a tela do nads mostrar), sem expor nada dele. */
function lerCertificado() {
  try {
    const forge = require('node-forge');
    const senha = fs.readFileSync(SENHA, 'utf8').replace(/\r?\n$/, '');
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(fs.readFileSync(CERTIFICADO).toString('binary')), senha);
    const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map(b => b.cert).filter(Boolean);
    const daEmpresa = certs.filter(c => !(c.getExtension('basicConstraints') || {}).cA);
    const c = (daEmpresa.length ? daEmpresa : certs).sort((a, b) => a.validity.notAfter - b.validity.notAfter)[0];
    if (!c) return { erro: 'o arquivo não tem certificado' };
    const cn = String((c.subject.getField('CN') || {}).value || '');
    return { titular: cn.split(':')[0].trim(), documento: (cn.split(':')[1] || '').replace(/\D/g, ''), validade: c.validity.notAfter.toISOString().slice(0, 10) };
  } catch (err) {
    return { erro: /password|mac|invalid/i.test(err.message) ? 'a senha não abre o certificado' : 'não consegui ler o certificado (' + err.message + ')' };
  }
}

function iniciarFgtsDigital(db, log, avisos) {
  const estado = db.collection('robo').doc('fgts');
  const pedidos = db.collection('pedidosFgts');
  const marcar = dados => estado.set(Object.assign({ atualizadoEm: agora() }, dados), { merge: true }).catch(err => log('FGTS: não gravei o estado:', err.message));

  if (!fs.existsSync(CERTIFICADO) || !fs.existsSync(SENHA)) {
    marcar({ ligado: false, motivo: 'falta o certificado do escritório na máquina do robô' });
    log('FGTS: desligado (falta o certificado do escritório)');
    return;
  }
  if (!fs.existsSync(CHROMIUM)) {
    marcar({ ligado: false, motivo: 'falta o navegador (Chromium) na máquina do robô' });
    log('FGTS: desligado (falta o Chromium em ' + CHROMIUM + ')');
    return;
  }
  let puppeteer;
  try { puppeteer = require('puppeteer-core'); } catch (err) {
    marcar({ ligado: false, motivo: 'falta a biblioteca do navegador (puppeteer-core)' });
    log('FGTS: desligado (puppeteer-core):', err.message);
    return;
  }
  const cert = lerCertificado();
  marcar({ ligado: !cert.erro, motivo: cert.erro || '', certificado: cert.erro ? null : cert });
  if (cert.erro) { log('FGTS: desligado (' + cert.erro + ')'); return; }
  log('FGTS: ligado (certificado de ' + cert.titular + ', até ' + cert.validade + ')');

  // pedido que ficou "trabalhando" quando o robô caiu: volta como erro (a pessoa pede de novo)
  pedidos.where('status', '==', 'trabalhando').get().then(s => Promise.all(s.docs.map(d =>
    d.ref.update({ status: 'erro', erro: 'o robô reiniciou no meio; peça de novo', fimEm: agora() })))).catch(() => {});

  const fila = [];
  let ocupado = false;
  async function proximo() {
    if (ocupado || !fila.length) return;
    ocupado = true;
    const doc = fila.shift();
    try { await atender(doc); } catch (err) { log('FGTS: erro no pedido', doc.id, err.message); }
    ocupado = false;
    proximo();
  }

  ouvir('pedidos do FGTS', () => pedidos.where('status', '==', 'pendente'), snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type !== 'added' || fila.some(d => d.id === ch.doc.id)) continue;
      fila.push(ch.doc);
    }
    proximo();
  }, log);

  async function atender(doc) {
    const p = doc.data();
    const ref = doc.ref;
    const modo = p.modo === 'emitir' ? 'emitir' : 'ensaio';
    if (!cnpjValido(p.cnpj)) return ref.update({ status: 'erro', erro: 'CNPJ inválido', fimEm: agora() });
    if (modo === 'emitir' && !competenciaValida(p.competencia)) return ref.update({ status: 'erro', erro: 'competência inválida', fimEm: agora() });
    await ref.update({ status: 'trabalhando', inicioEm: agora(), passos: [] });
    log('FGTS:', modo, p.cnpj, p.competencia || '', '(' + (p.empresa || '') + ')');

    const passos = [];
    let browser = null;
    let page = null;
    const registrar = async (nome, extra) => {
      const n = passos.length + 1;
      let url = '', texto = '';
      try { url = page.url(); texto = (await page.evaluate(() => document.body ? document.body.innerText : '')).slice(0, 2500); } catch (_) { /* a página pode ter fechado */ }
      passos.push(Object.assign({ n, nome, url, texto, quando: agora() }, extra || {}));
      await ref.update({ passos }).catch(() => {});
      try {
        const imagem = await page.screenshot({ type: 'jpeg', quality: 45, fullPage: false, encoding: 'base64' });
        await ref.collection('telas').doc(String(n).padStart(2, '0')).set({ imagem, url, nome, quando: agora() });
      } catch (_) { /* sem foto, segue */ }
    };

    const fim = setTimeout(() => { if (browser) browser.close().catch(() => {}); }, LIMITE_MS);
    try {
      fs.mkdirSync(PASTA_TELAS, { recursive: true });
      const baixados = fs.mkdtempSync(path.join(PASTA_TELAS, 'pdf-'));
      browser = await puppeteer.launch({
        executablePath: CHROMIUM,
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--lang=pt-BR', '--window-size=1280,900'],
        defaultViewport: { width: 1280, height: 900 },
      });
      page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });
      const cdp = await page.createCDPSession();
      await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados }).catch(() => {});
      // o PDF da guia pode vir como resposta (aberto numa aba) em vez de download
      let pdfDaResposta = null;
      const guardarPdf = async r => {
        if (pdfDaResposta || !/application\/pdf/i.test(r.headers()['content-type'] || '')) return;
        try { pdfDaResposta = await r.buffer(); } catch (_) { /* resposta sem corpo */ }
      };
      browser.on('targetcreated', async t => {
        const pg = await t.page().catch(() => null);
        if (pg) pg.on('response', guardarPdf);
      });
      page.on('response', guardarPdf);

      await page.goto(PORTAL, { waitUntil: 'networkidle2', timeout: 60000 });
      await registrar('portal');
      await clicar(page, PASSOS_DO_PORTAL.entrar, 'Entrar com gov.br');
      await esperarCarregar(page);
      if (await temCaptcha(page)) return await pararCaptcha();
      await registrar('gov.br');
      await clicar(page, PASSOS_DO_PORTAL.certificado, 'Seu certificado digital');
      // o certificado é escolhido sozinho (a regra do Chromium) e o gov.br devolve ao portal
      await esperarSairDe(page, /acesso\.gov\.br/, 90000);
      if (await temCaptcha(page)) return await pararCaptcha();
      if (/acesso\.gov\.br/.test(page.url())) throw new Error('o gov.br não aceitou o certificado (a tela ficou no login)');
      await registrar('entrou');

      await clicar(page, PASSOS_DO_PORTAL.trocarPerfil, 'Trocar perfil');
      await esperarCarregar(page);
      await clicar(page, PASSOS_DO_PORTAL.procurador, 'Procurador');
      await preencherCnpj(page, p.cnpj);
      await esperarCarregar(page);
      await registrar('perfil do cliente');
      const textoPerfil = semAcento(await page.evaluate(() => document.body.innerText));
      if (/sem procuracao|nao possui procuracao|procuracao nao encontrada/.test(textoPerfil)) throw new Error('o cliente não deu procuração ao escritório no FGTS Digital');

      if (modo === 'ensaio') {
        await ref.update({ status: 'pronto', resultado: 'entrou no perfil do cliente (ensaio, nada emitido)', fimEm: agora() });
        log('FGTS: ensaio ok', p.cnpj);
        return;
      }

      await clicar(page, PASSOS_DO_PORTAL.emissao, 'Emissão de guia');
      await esperarCarregar(page);
      await clicar(page, PASSOS_DO_PORTAL.guiaMensal, 'Guia mensal');
      await esperarCarregar(page);
      await preencherCompetencia(page, p.competencia);
      await registrar('competência');
      await clicar(page, PASSOS_DO_PORTAL.emitir, 'Emitir guia');
      await esperarCarregar(page);
      await registrar('emitida');
      await clicar(page, PASSOS_DO_PORTAL.baixar, 'Baixar PDF').catch(() => {});
      const pdf = pdfDaResposta || await esperarArquivo(baixados, 60000);
      if (!pdf || pdf.slice(0, 4).toString() !== '%PDF') throw new Error('a guia não veio em PDF');
      const nome = 'FGTS ' + p.competencia + ' ' + p.cnpj + '.pdf';
      await ref.collection('arquivo').doc('pdf').set({ base64: pdf.toString('base64'), nome, tamanho: pdf.length, sha256: crypto.createHash('sha256').update(pdf).digest('hex'), quando: agora() });
      await ref.update({ status: 'pronto', resultado: 'guia emitida', pdfNome: nome, fimEm: agora() });
      log('FGTS: guia emitida', p.cnpj, p.competencia);
      fs.rmSync(baixados, { recursive: true, force: true });
    } catch (err) {
      await registrar('erro').catch(() => {});
      await ref.update({ status: 'erro', erro: err.message, fimEm: agora() }).catch(() => {});
      log('FGTS: erro', p.cnpj, err.message);
    } finally {
      clearTimeout(fim);
      if (browser) await browser.close().catch(() => {});
    }

    async function pararCaptcha() {
      await registrar('captcha');
      await ref.update({ status: 'captcha', erro: 'o gov.br pediu a verificação "não sou um robô"; faça esta guia à mão', fimEm: agora() });
      log('FGTS: o gov.br pediu CAPTCHA; parei', p.cnpj);
      if (avisos) avisos.enviar('admin', '', 'FGTS: o gov.br pediu verificação', 'O robô parou; a guia de ' + (p.empresa || p.cnpj) + ' fica para fazer à mão.', 'fgts').catch(() => {});
    }
  }
}

/** Clica no primeiro botão/link cujo texto bate com um dos padrões (sem acento). */
async function clicar(page, padroes, nome) {
  const fontes = padroes.map(r => r.source);
  for (let i = 0; i < 20; i++) {
    const ok = await page.evaluate(lista => {
      const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      const res = lista.map(s => new RegExp(s));
      const itens = [...document.querySelectorAll('button, a, [role=button], [role=menuitem], [role=tab], input[type=submit], input[type=button], li, label')]
        .filter(e => e.offsetParent !== null);
      for (const re of res) {
        const el = itens.find(e => re.test(norm(e.innerText || e.value || e.getAttribute('aria-label') || e.title)));
        if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; }
      }
      return false;
    }, fontes);
    if (ok) { await dormir(800); return; }
    await dormir(1000);
  }
  throw new Error('não achei "' + nome + '" na tela');
}

async function esperarCarregar(page) {
  await Promise.race([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}), dormir(4000)]);
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => {});
}

async function esperarSairDe(page, re, ms) {
  const ate = Date.now() + ms;
  while (Date.now() < ate && re.test(page.url())) await dormir(1000);
  await esperarCarregar(page);
}

async function temCaptcha(page) {
  return page.evaluate(() => !![...document.querySelectorAll('iframe[src*="hcaptcha"], iframe[src*="recaptcha"], .h-captcha, .g-recaptcha, [data-hcaptcha-widget-id]')]
    .find(e => e.offsetParent !== null || e.tagName === 'IFRAME'));
}

async function preencherCnpj(page, cnpj) {
  const ok = await page.evaluate(c => {
    const campo = [...document.querySelectorAll('input')].find(i => i.offsetParent !== null && /cnpj|inscri|cpf/i.test((i.name || '') + (i.id || '') + (i.placeholder || '') + (i.getAttribute('aria-label') || '')));
    if (!campo) return false;
    campo.focus(); campo.value = c;
    campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, cnpj);
  if (!ok) throw new Error('não achei o campo do CNPJ na troca de perfil');
  await clicar(page, [/^selecionar$/, /^confirmar$/, /^ok$/, /^entrar$/, /^pesquisar$/, /^buscar$/], 'Confirmar o perfil');
}

async function preencherCompetencia(page, competencia) {
  const [a, m] = competencia.split('-');
  const ok = await page.evaluate((mmaaaa, aaaamm) => {
    const campo = [...document.querySelectorAll('input')].find(i => i.offsetParent !== null && /compet|periodo|mes/i.test((i.name || '') + (i.id || '') + (i.placeholder || '') + (i.getAttribute('aria-label') || '')));
    if (!campo) return false;
    campo.focus(); campo.value = campo.type === 'month' ? aaaamm : mmaaaa;
    campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, m + '/' + a, a + '-' + m);
  if (!ok) throw new Error('não achei o campo da competência');
}

async function esperarArquivo(pasta, ms) {
  const ate = Date.now() + ms;
  while (Date.now() < ate) {
    const pdf = fs.readdirSync(pasta).find(f => /\.pdf$/i.test(f));
    if (pdf) { await dormir(500); return fs.readFileSync(path.join(pasta, pdf)); }
    await dormir(1000);
  }
  return null;
}

module.exports = { iniciarFgtsDigital, PASSOS_DO_PORTAL, semAcento };
