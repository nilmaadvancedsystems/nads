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
// Nunca passa por cima de verificação de robô. Quando o gov.br trava no login (a verificação "não sou um robô"), o
// pedido fica em 'verificacao' (08/10/2026: "deixar isso rodando na VM e lá eu clicar em não sou um robô"): o robô
// manda a tela ao vivo (pedidosFgts/{id}/ao-vivo/tela) e repete no navegador os cliques que a pessoa do DP faz na
// imagem, no nads (pedidosFgts/{id}/cliques). Quem clica na verificação é sempre a pessoa. Sem ninguém em 10 minutos,
// o pedido para com status 'captcha' e a guia fica para fazer à mão. Um pedido por vez (a máquina tem 1 GB de memória).
//
// O caminho no portal (os textos dos botões em PASSOS_DO_PORTAL) foi escrito pelo manual, sem ter entrado ainda:
// é a primeira coisa a acertar com o modo 'ensaio' quando o certificado chegar.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ouvir } = require('./ouvinte');

const CERTIFICADO = path.join(__dirname, 'fgts_certificado.pfx');
const SENHA = path.join(__dirname, 'fgts_certificado.senha');
const CHROMIUM = process.env.FGTS_CHROMIUM || '/usr/bin/chromium';
// No PC do escritório (08/10/2026: na máquina do Google o gov.br travava e depois devolvia o login em branco — o
// endereço de nuvem e o navegador sem tela): roda junto do arquivador, no Edge (o Chrome do dia a dia fica livre para
// os certificados dos clientes), com a janela aparecendo, um perfil próprio (fgts-perfil-edge: o gov.br lembra dele) e
// o certificado instalado no Windows (Usuário Atual). A regra do Edge que escolhe o certificado sozinho no gov.br é
// posta por quem usa o PC. A verificação do gov.br é igual à da nuvem: a tela ao vivo no nads e os cliques da pessoa.
// Onde roda: config/fgts.onde ('pc', o padrão, ou 'nuvem'); o outro lado fica parado.
const NO_PC = process.platform === 'win32';
const EDGE_PC = process.env.FGTS_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PERFIL_PC = path.join(__dirname, 'fgts-perfil-edge');
const CNPJ_ESCRITORIO = '27872981000113';
const PORTAL = 'https://fgtsdigital.sistema.gov.br/portal/';
const PASTA_TELAS = path.join(__dirname, 'fgts-telas');
// a espera pela pessoa na verificação entra no tempo do pedido
const ESPERA_PESSOA_MS = 10 * 60 * 1000;
const LIMITE_MS = 6 * 60 * 1000 + ESPERA_PESSOA_MS;
const LARGURA = 1280;
const ALTURA = 900;
const LINK_FGTS = 'https://tarefas-nilma.web.app/tarefas/dp/fgts';

// Os textos do caminho no portal (sem acento e minúsculos para comparar). Ajustar aqui quando o ensaio mostrar o
// nome certo de cada botão.
const PASSOS_DO_PORTAL = {
  entrar: [/entrar com.*gov\.?br/, /^entrar$/, /acessar/],
  certificado: [/seu certificado digital/, /certificado digital/],
  trocarPerfil: [/trocar perfil/, /alterar perfil/, /selecionar perfil/],
  procurador: [/procurador/],
  emissao: [/emissao de guia/, /emitir guia/, /^emissao/, /guia rapida/, /guia mensal/],
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

/** O certificado do escritório no Windows deste PC (Usuário Atual, com a chave): o titular e a validade, sem a chave. */
function lerCertificadoDoWindows() {
  try {
    const cmd = "Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.Subject -match '" + CNPJ_ESCRITORIO + "' -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) }"
      + " | Sort-Object NotAfter -Descending | Select-Object -First 1 | ForEach-Object { $_.GetNameInfo('SimpleName', $false) + '|' + $_.NotAfter.ToString('yyyy-MM-dd') }";
    const saida = execFileSync('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'utf8', windowsHide: true, timeout: 30000 }).trim();
    if (!saida) return { erro: 'o certificado do escritório não está instalado no Windows deste PC' };
    const [cn, validade] = saida.split('|');
    return { titular: cn.split(':')[0].trim(), documento: CNPJ_ESCRITORIO, validade };
  } catch (err) {
    return { erro: 'não consegui ler os certificados do Windows (' + String(err.message).split('\n')[0] + ')' };
  }
}

function iniciarFgtsDigital(db, log, avisos) {
  const aqui = NO_PC ? 'pc' : 'nuvem';
  db.collection('config').doc('fgts').get().then(s => (s.exists && s.data().onde) || 'pc', () => 'pc').then(onde => {
    if (onde !== aqui) { log('FGTS: roda no ' + onde + ' (config/fgts), não aqui'); return; }
    ligarFgtsDigital(db, log, avisos);
  });
}

function ligarFgtsDigital(db, log, avisos) {
  const estado = db.collection('robo').doc('fgts');
  const pedidos = db.collection('pedidosFgts');
  const marcar = dados => estado.set(Object.assign({ atualizadoEm: agora() }, dados), { merge: true }).catch(err => log('FGTS: não gravei o estado:', err.message));

  if (!NO_PC && (!fs.existsSync(CERTIFICADO) || !fs.existsSync(SENHA))) {
    marcar({ ligado: false, motivo: 'falta o certificado do escritório na máquina do robô' });
    log('FGTS: desligado (falta o certificado do escritório)');
    return;
  }
  const NAVEGADOR = NO_PC ? EDGE_PC : CHROMIUM;
  if (!fs.existsSync(NAVEGADOR)) {
    marcar({ ligado: false, motivo: 'falta o navegador (' + (NO_PC ? 'Edge' : 'Chromium') + ') na máquina do robô' });
    log('FGTS: desligado (falta o navegador em ' + NAVEGADOR + ')');
    return;
  }
  let puppeteer;
  try { puppeteer = require('puppeteer-core'); } catch (err) {
    marcar({ ligado: false, motivo: 'falta a biblioteca do navegador (puppeteer-core)' });
    log('FGTS: desligado (puppeteer-core):', err.message);
    return;
  }
  // no PC o certificado pode ser instalado com o robô ligado: confere de novo a cada 2 minutos até achar
  const cert = NO_PC ? lerCertificadoDoWindows() : lerCertificado();
  marcar({ ligado: !cert.erro, motivo: cert.erro || '', certificado: cert.erro ? null : cert, onde: NO_PC ? 'pc' : 'nuvem' });
  if (cert.erro) {
    log('FGTS: desligado (' + cert.erro + ')');
    if (NO_PC) setTimeout(() => ligarFgtsDigital(db, log, avisos), 2 * 60 * 1000);
    return;
  }
  log('FGTS: ligado (certificado de ' + cert.titular + ', até ' + cert.validade + (NO_PC ? ', no Windows deste PC' : '') + ')');

  // pedido que ficou "trabalhando" quando o robô caiu: volta como erro (a pessoa pede de novo)
  pedidos.where('status', 'in', ['trabalhando', 'verificacao']).get().then(s => Promise.all(s.docs.map(d =>
    d.ref.update({ status: 'erro', erro: 'o robô reiniciou no meio; peça de novo', fimEm: agora() })))).catch(() => {});

  // Uma sessão só para vários pedidos (08/10/2026: cada guia fazia login e verificação de novo, e o gov.br acabou
  // segurando o hCaptcha de tantos logins seguidos): o navegador fica aberto e logado entre um pedido e outro; a troca
  // de cliente é pelo Trocar Perfil. Fecha depois de 20 minutos parado, se o pedido der erro ou se fecharem a janela.
  const PARADO_MS = 20 * 60 * 1000;
  let sessao = null;
  let fecharParado = null;
  function fecharSessao() {
    clearTimeout(fecharParado);
    const s = sessao;
    sessao = null;
    if (s) s.browser.close().catch(() => {});
  }
  async function abrirSessao() {
    clearTimeout(fecharParado);
    if (sessao && sessao.browser.isConnected()) return sessao;
    const browser = await puppeteer.launch(NO_PC ? {
      executablePath: NAVEGADOR,
      headless: false,
      userDataDir: PERFIL_PC,
      ignoreDefaultArgs: ['--enable-automation'],
      args: ['--lang=pt-BR', '--window-size=' + (LARGURA + 16) + ',' + (ALTURA + 140), '--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check',
        // a janela atrás de outras, minimizada ou com a tela bloqueada continua desenhando (a tela ao vivo e os cliques)
        '--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
      defaultViewport: { width: LARGURA, height: ALTURA },
    } : {
      executablePath: NAVEGADOR,
      headless: true,
      // sem a marca de "navegador controlado por automação"
      ignoreDefaultArgs: ['--enable-automation'],
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--lang=pt-BR', '--window-size=' + LARGURA + ',' + ALTURA, '--disable-blink-features=AutomationControlled'],
      defaultViewport: { width: LARGURA, height: ALTURA },
    });
    const page = await browser.newPage();
    // localização, notificações e o resto: recusado sem perguntar (08/10/2026: o gov.br pedia a localização no login)
    for (const origem of ['https://sso.acesso.gov.br', 'https://certificado.sso.acesso.gov.br', 'https://fgtsdigital.sistema.gov.br']) {
      await browser.defaultBrowserContext().overridePermissions(origem, []).catch(() => {});
    }
    // o que o gov.br faz no login (08/10/2026: travava no "Seu certificado digital" sem verificação na tela): os
    // pedidos de rede do acesso.gov.br e do hCaptcha, só o endereço e o resultado
    const daRede = u => /acesso\.gov\.br|hcaptcha/.test(u);
    page.on('requestfailed', r => { if (daRede(r.url())) log('FGTS rede: falhou', r.url().split('?')[0], (r.failure() || {}).errorText || ''); });
    page.on('response', r => { if (daRede(r.url()) && ['document', 'xhr', 'fetch'].includes(r.request().resourceType())) log('FGTS rede:', r.status(), r.request().resourceType(), r.url().split('?')[0]); });
    page.on('console', m => { if (m.type() === 'error') log('FGTS console:', m.text().slice(0, 200)); });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });
    const cdp = await page.createCDPSession();
    const nova = { browser, page, cdp, pdf: null };
    // o PDF da guia pode vir como resposta (aberto numa aba) em vez de download
    const guardarPdf = async r => {
      if (nova.pdf || !/application\/pdf/i.test(r.headers()['content-type'] || '')) return;
      try { nova.pdf = await r.buffer(); } catch (_) { /* resposta sem corpo */ }
    };
    browser.on('targetcreated', async t => {
      log('FGTS janela nova:', t.type(), t.url().split('?')[0]);
      const pg = await t.page().catch(() => null);
      if (pg) pg.on('response', guardarPdf);
    });
    page.on('response', guardarPdf);
    // fecharam a janela: o próximo pedido abre outra
    browser.on('disconnected', () => { if (sessao === nova) sessao = null; });
    sessao = nova;
    return nova;
  }

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

    // passou do tempo: fecha a sessão (o pedido para no erro)
    const fim = setTimeout(fecharSessao, LIMITE_MS);
    let deuCerto = false;
    let baixados = '';
    try {
      fs.mkdirSync(PASTA_TELAS, { recursive: true });
      baixados = fs.mkdtempSync(path.join(PASTA_TELAS, 'pdf-'));
      const ses = await abrirSessao();
      page = ses.page;
      ses.pdf = null;
      await ses.cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: baixados }).catch(() => {});

      // no lote, a sessão já está dentro do portal: não recarrega nem sai da conta, só troca o perfil (Vitor, 08/10/2026)
      const jaDentro = /fgtsdigital\.sistema\.gov\.br\/portal\/(?!login)/.test(page.url());
      if (!jaDentro) await page.goto(PORTAL, { waitUntil: 'networkidle2', timeout: 60000 });
      await registrar(jaDentro ? 'portal (a sessão do lote)' : 'portal');
      // a sessão aberta (ou o login guardado no perfil): o portal já abre logado e pula o gov.br
      if (/acesso\.gov\.br|\/login/.test(page.url()) || await temTexto(page, PASSOS_DO_PORTAL.entrar)) {
        await clicar(page, PASSOS_DO_PORTAL.entrar, 'Entrar com gov.br');
        await esperarCarregar(page);
        await registrar('gov.br');
        await clicar(page, PASSOS_DO_PORTAL.certificado, 'Seu certificado digital');
        // o certificado é escolhido sozinho (a regra do navegador) e o gov.br devolve ao portal; travou no gov.br: a
        // verificação — a tela vai ao vivo para o nads e a pessoa clica
        await esperarSairDe(page, /acesso\.gov\.br/, 20000);
        if (/acesso\.gov\.br/.test(page.url()) && !await esperarAPessoa()) return await pararCaptcha();
      }
      if (/acesso\.gov\.br/.test(page.url())) throw new Error('o gov.br não aceitou o certificado (a tela ficou no login)');
      await registrar('entrou');

      await clicar(page, PASSOS_DO_PORTAL.trocarPerfil, 'Trocar perfil');
      await esperarCarregar(page);
      // a janela "Trocar Perfil" (08/10/2026, vista no primeiro login): a lista Perfil (abre e escolhe a de procurador)
      // e o "Empregador a ser representado" (o CNPJ, digitado), depois Selecionar
      const perfil = await escolherPerfilProcurador(page);
      await registrar('perfil: ' + perfil.escolhido + ' (opções: ' + perfil.opcoes.join(' / ') + ')');
      await preencherCnpj(page, p.cnpj);
      await esperarCarregar(page);
      await registrar('perfil do cliente');
      const textoPerfil = semAcento(await page.evaluate(() => document.body.innerText));
      if (/sem procuracao|nao possui procuracao|procuracao nao encontrada/.test(textoPerfil)) throw new Error('o cliente não deu procuração ao escritório no FGTS Digital');

      if (modo === 'ensaio') {
        await ref.update({ status: 'pronto', resultado: 'entrou no perfil do cliente (ensaio, nada emitido)', fimEm: agora() });
        log('FGTS: ensaio ok', p.cnpj);
        deuCerto = true;
        return;
      }

      // o menu do portal (08/10/2026, visto no ensaio): GESTÃO DE GUIAS abre as opções de emissão
      // são cartões (08/10/2026, vistos na tela): as opções aparecem com o mouse em cima, como na mão de uma pessoa
      await passarMouse(page, /^gestao de guias$/, 'Gestão de guias');
      await registrar('gestão de guias (as opções)');
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
      const pdf = ses.pdf || await esperarArquivo(baixados, 60000);
      if (!pdf || pdf.slice(0, 4).toString() !== '%PDF') throw new Error('a guia não veio em PDF');
      const nome = 'FGTS ' + p.competencia + ' ' + p.cnpj + '.pdf';
      await ref.collection('arquivo').doc('pdf').set({ base64: pdf.toString('base64'), nome, tamanho: pdf.length, sha256: crypto.createHash('sha256').update(pdf).digest('hex'), quando: agora() });
      await ref.update({ status: 'pronto', resultado: 'guia emitida', pdfNome: nome, fimEm: agora() });
      log('FGTS: guia emitida', p.cnpj, p.competencia);
      deuCerto = true;
    } catch (err) {
      await registrar('erro').catch(() => {});
      await ref.update({ status: 'erro', erro: err.message, fimEm: agora() }).catch(() => {});
      log('FGTS: erro', p.cnpj, err.message);
    } finally {
      clearTimeout(fim);
      if (baixados) fs.rmSync(baixados, { recursive: true, force: true });
      // deu certo: a sessão fica para o próximo pedido (fecha depois de 20 min parada); deu errado: fecha (estado incerto)
      if (deuCerto && sessao) { clearTimeout(fecharParado); fecharParado = setTimeout(fecharSessao, PARADO_MS); } else fecharSessao();
    }

    /**
     * A verificação com a pessoa: a tela ao vivo para o nads (a cada 1,5 s) e os cliques dela no navegador, até sair do
     * gov.br (true) ou passar o tempo (false). Avisa no celular quem pediu e o admin.
     */
    async function esperarAPessoa() {
      await registrar('verificação: esperando a pessoa');
      await ref.update({ status: 'verificacao', verificacaoDesde: agora() });
      log('FGTS: verificação do gov.br; esperando a pessoa no nads', p.cnpj);
      const corpo = 'Abra DP › FGTS Digital e clique em "não sou um robô" na tela de ' + (p.empresa || p.cnpj) + '.';
      if (avisos) {
        if (p.criadoPorUid) avisos.enviarPara([p.criadoPorUid], 'FGTS: o gov.br pediu a verificação', corpo, 'fgts', LINK_FGTS).catch(() => {});
        avisos.enviar('admin', '', 'FGTS: o gov.br pediu a verificação', corpo, 'fgts', LINK_FGTS).catch(() => {});
      }
      const aoVivo = ref.collection('ao-vivo').doc('tela');
      const cliques = [];
      const parar = ref.collection('cliques').onSnapshot(s => {
        for (const ch of s.docChanges()) if (ch.type === 'added') cliques.push(ch.doc);
      }, () => {});
      const ate = Date.now() + ESPERA_PESSOA_MS;
      let ultimaFoto = 0;
      try {
        while (Date.now() < ate && /acesso\.gov\.br/.test(page.url())) {
          while (cliques.length) {
            const c = cliques.shift();
            const { x, y } = c.data();
            // como a mão de uma pessoa (08/10/2026: o "Próximo" do hCaptcha ignorava o clique seco): o mouse vai até o
            // ponto em alguns passos, para em cima e o botão fica apertado um instante
            if (Number.isFinite(x) && Number.isFinite(y)) {
              const cx = Math.max(0, Math.min(LARGURA, x));
              const cy = Math.max(0, Math.min(ALTURA, y));
              log('FGTS: clique da pessoa em', Math.round(cx), Math.round(cy));
              await page.mouse.move(cx, cy, { steps: 12 }).catch(() => {});
              await dormir(120);
              await page.mouse.down().catch(() => {});
              await dormir(90);
              await page.mouse.up().catch(() => {});
            }
            await c.ref.delete().catch(() => {});
            ultimaFoto = 0;
          }
          if (Date.now() - ultimaFoto > 1500) {
            ultimaFoto = Date.now();
            try {
              const imagem = await page.screenshot({ type: 'jpeg', quality: 50, fullPage: false, encoding: 'base64' });
              await aoVivo.set({ imagem, largura: LARGURA, altura: ALTURA, quando: agora() });
            } catch (_) { /* a página está trocando; a próxima foto vem */ }
          }
          await dormir(300);
        }
      } finally {
        parar();
        await aoVivo.delete().catch(() => {});
      }
      if (/acesso\.gov\.br/.test(page.url())) return false;
      await ref.update({ status: 'trabalhando' }).catch(() => {});
      await esperarCarregar(page);
      log('FGTS: a pessoa passou da verificação', p.cnpj);
      return true;
    }

    async function pararCaptcha() {
      await registrar('captcha');
      await ref.update({ status: 'captcha', erro: 'ninguém fez a verificação "não sou um robô" do gov.br a tempo; peça de novo ou faça esta guia à mão', fimEm: agora() });
      log('FGTS: o gov.br pediu CAPTCHA; parei', p.cnpj);
      if (avisos) avisos.enviar('admin', '', 'FGTS: o gov.br pediu verificação', 'O robô parou; a guia de ' + (p.empresa || p.cnpj) + ' fica para fazer à mão.', 'fgts').catch(() => {});
    }
  }
}

/** Clica no primeiro botão/link cujo texto bate com um dos padrões (sem acento). */
async function clicar(page, padroes, nome) {
  const fontes = padroes.map(r => r.source);
  for (let i = 0; i < 20; i++) {
    // a página pode trocar no meio (08/10/2026: o gov.br recarregava o login depois da checagem dele): espera e tenta de novo
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
    }, fontes).catch(err => { if (/context was destroyed|navigation|detached/i.test(err.message)) return false; throw err; });
    if (ok) { await dormir(800); return; }
    await dormir(1000);
  }
  throw new Error('não achei "' + nome + '" na tela');
}

/** Algum botão/link com um destes textos na tela? */
async function temTexto(page, padroes) {
  return page.evaluate(lista => {
    const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const res = lista.map(s => new RegExp(s));
    return [...document.querySelectorAll('button, a, [role=button]')].some(e => e.offsetParent !== null && res.some(re => re.test(norm(e.innerText || e.getAttribute('aria-label')))));
  }, padroes.map(r => r.source)).catch(() => false);
}

/** Põe o mouse em cima do menor elemento cujo texto é este (os cartões do portal abrem as opções assim). */
async function passarMouse(page, padrao, nome) {
  for (let i = 0; i < 15; i++) {
    const caixa = await page.evaluate(fonte => {
      const re = new RegExp(fonte);
      const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      const achados = [...document.querySelectorAll('body *')].filter(e => e.offsetParent !== null && re.test(norm(e.innerText)));
      const el = achados.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, padrao.source).catch(() => null);
    if (caixa) {
      await page.mouse.move(caixa.x - 40, caixa.y - 40);
      await page.mouse.move(caixa.x, caixa.y, { steps: 10 });
      await dormir(1200);
      return;
    }
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

/**
 * A lista Perfil da janela "Trocar Perfil": abre, lê as opções e escolhe a de procurador (de pessoa jurídica, se houver
 * mais de uma). Devolve a escolhida e as que viu (vão para o passo, para acertar o nome se o portal mudar).
 */
async function escolherPerfilProcurador(page) {
  const caixa = (await page.evaluateHandle(() => {
    const janela = [...document.querySelectorAll('[role=dialog], .br-modal, .modal, dialog, .modal-content')].find(e => e.offsetParent !== null && /trocar perfil/i.test(e.innerText)) || document.body;
    return [...janela.querySelectorAll('input')].find(i => i.offsetParent !== null && !/cnpj|cpf/i.test((i.placeholder || '') + (i.name || '') + (i.id || ''))) || null;
  })).asElement();
  if (!caixa) throw new Error('não achei a lista Perfil na troca de perfil');
  await caixa.click();
  await dormir(900);
  const SELETOR = '[role=option], .br-item, .ng-option, .mat-option, .p-dropdown-item, li';
  const opcoes = [...new Set(await page.evaluate(sel => [...document.querySelectorAll(sel)]
    .filter(e => e.offsetParent !== null && (e.innerText || '').trim() && e.innerText.trim().length < 120)
    .map(e => e.innerText.trim().replace(/\s+/g, ' ')), SELETOR))];
  const alvo = opcoes.find(t => /procurador/i.test(t) && /jur/i.test(t)) || opcoes.find(t => /procurador/i.test(t));
  if (!alvo) throw new Error('a lista Perfil não tem procurador (opções: ' + (opcoes.slice(0, 10).join(' / ') || 'nenhuma') + ')');
  const item = (await page.evaluateHandle((sel, t) => [...document.querySelectorAll(sel)]
    .find(e => e.offsetParent !== null && e.innerText.trim().replace(/\s+/g, ' ') === t) || null, SELETOR, alvo)).asElement();
  await item.click();
  await dormir(700);
  return { escolhido: alvo, opcoes };
}

/** O "Empregador a ser representado": o CNPJ digitado como uma pessoa (o campo tem máscara), depois Selecionar. */
async function preencherCnpj(page, cnpj) {
  const campo = (await page.evaluateHandle(() => [...document.querySelectorAll('input')]
    .find(i => i.offsetParent !== null && /cnpj|cpf|inscri/i.test((i.placeholder || '') + (i.name || '') + (i.id || '') + (i.getAttribute('aria-label') || ''))) || null)).asElement();
  if (!campo) throw new Error('não achei o campo do CNPJ na troca de perfil');
  await campo.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await campo.type(cnpj, { delay: 60 });
  await dormir(600);
  await clicar(page, [/^selecionar$/, /^confirmar$/, /^ok$/, /^entrar$/], 'Selecionar o perfil');
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
