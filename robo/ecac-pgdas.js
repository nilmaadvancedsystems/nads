// O faturamento fiel do Simples pela Receita (25/11/2026, o dono: "preciso que o robô baixe relatório de faturamento do ecac
// para ter um relatório fiel na área do cliente e no faturamento"; escolheu o PGDAS-D como o faturamento fiel do Simples, o
// robô no e-CAC já, e o escritório tem procuração de todas). Roda no NILMA-SERVER, num processo próprio (robo-modulo.js).
//
// Como entra: no Chrome do robô do FGTS (fgts-chrome.js: o perfil com o certificado e-CNPJ do ESCRITÓRIO e a regra que
// escolhe esse certificado sozinho no gov.br), numa aba só sua. Entra no e-CAC uma vez, e para cada cliente troca o perfil
// para "Procurador" com o CNPJ dele. Nunca digita senha e nunca resolve verificação "não sou um robô": com ela na tela, o
// lote para e os pedidos esperam a próxima noite.
//
// Quando: só das 23h às 8h (o e-CAC só aceita robô fora das 8h–23h; core tarefas.pgdas.dentroDaJanelaDoEcac). A trava vale
// por cima do horário da Central dos robôs. Entre uma troca de perfil e outra, no mínimo 35 s (a Receita pede 30 s).
//
// O que faz em cada pedido (pedidosPgdas/{id}: { status: 'pendente', modo, cnpj, codigo, empresa, competencia: 'aaaa-mm' }):
//   modo 'ensaio':  só entra, troca o perfil e anota as telas (passos) até a lista das declarações do ano, sem baixar nada:
//                   para acertar o caminho do portal na primeira noite;
//   modo 'extrato': baixa o extrato do PGDAS-D da competência, lê (core tarefas.pgdas.extratoDoPgdas), confere o CNPJ,
//                   junta no resumo da empresa (pgdas/{código}: os meses, a RBT12, a declaração, a data da consulta) e deixa
//                   o PDF na pasta Claudio Secretario/<aaaa-mm>/<cód> - <nome>, de onde o arquivador já arquiva o PGDAS-D
//                   no FISCAL do cliente.
//
// O caminho no portal (os endereços e os textos em PORTAL) foi escrito pelo que a Receita publica, sem ter entrado ainda: é
// a primeira coisa a acertar com o modo 'ensaio' (pedido pela Central dos robôs, numa empresa de teste).
'use strict';
const fs = require('fs');
const path = require('path');

const COLECAO = 'pedidosPgdas';
const ROBO = 'pgdas';
const NOME = 'Simples na Receita (e-CAC)';
const ENTRADA = process.env.PGDAS_ENTRADA || 'G:\\Meu Drive\\Claudio Secretario';
const MAX_TENTATIVAS = 3;
const COMPETENCIA_OK = /^20\d{2}-(0[1-9]|1[0-2])$/;
const dormirPadrao = ms => new Promise(r => setTimeout(r, ms));
const core = () => require('./gerado/danfse');

// ---------- funções puras (o teste-ecac-pgdas.js roda sem banco e sem portal) ----------

/** O pedido dá para atender? '' = sim; senão, o motivo. */
function motivoDoPedidoRuim(p) {
  if (!p || typeof p !== 'object') return 'pedido vazio';
  if (!['extrato', 'ensaio'].includes(p.modo)) return 'modo desconhecido (' + String(p.modo) + ')';
  if (!/^\d{14}$/.test(String(p.cnpj || ''))) return 'sem o CNPJ da empresa (14 números)';
  if (!Number.isInteger(Number(p.codigo)) || Number(p.codigo) <= 0) return 'sem o código da empresa';
  if (!COMPETENCIA_OK.test(String(p.competencia || ''))) return 'competência inválida (' + String(p.competencia) + ')';
  return '';
}

/** A fila na ordem: o "na frente" primeiro, depois o mais antigo. */
function ordemDaFila(itens) {
  return [...itens].sort((a, b) => (Number(!!b.dados.naFrente) - Number(!!a.dados.naFrente)) || String(a.dados.criadoEm || '').localeCompare(String(b.dados.criadoEm || '')));
}

const semCaracteresRuins = s => String(s || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

/** "PGDAS-D EXTRATO 10-2026 58.pdf" (o arquivador reconhece pelo conteúdo; o nome só ajuda quem olha a pasta) */
function nomeDoPdf(codigo, competencia) {
  const [ano, mes] = String(competencia).split('-');
  return 'PGDAS-D EXTRATO ' + mes + '-' + ano + ' ' + codigo + '.pdf';
}

/** Claudio Secretario/<aaaa-mm>/<cód> - <nome> (a pasta de mês e a do cliente, como o robô do Gmail e o nads gravam) */
function pastaDeEntrada(raiz, competencia, codigo, empresa) {
  return path.join(raiz, competencia, semCaracteresRuins(codigo + ' - ' + (empresa || 'sem nome')));
}

/** O próximo momento em que a janela do e-CAC abre DEPOIS desta noite (depois de uma verificação de robô, só amanhã). */
function proximaNoite(agoraMs) {
  const P = core();
  let t = agoraMs;
  while (P.dentroDaJanelaDoEcac(t)) t += 15 * 60000;
  return t + P.esperaAteAJanela(t);
}

/** "58 PADARIA (10/2026)" para o painel. */
const quem = p => String(p.codigo) + ' ' + String(p.empresa || '').slice(0, 40) + ' (' + String(p.competencia).slice(5) + '/' + String(p.competencia).slice(0, 4) + ')';

/**
 * Atende um lote de pedidos, um por vez. Tudo de fora vem em `o` (o teste passa versões falsas):
 *   o.pedidos: [{ ref, dados }] na ordem; o.portal: { entrar(), trocarPerfil(cnpj), baixarExtrato(competencia), ensaio(competencia) };
 *   o.lerPgdas(codigo) / o.gravarPgdas(codigo, doc); o.textoDoPdf(bytes); o.gravarPdf(pedido, bytes) (devolve o caminho);
 *   o.agora(), o.dormir(ms), o.log, o.painel (opcional), o.parar() (true = pare de pegar pedido).
 * Devolve { feitos, parouPor: '' | 'janela' | 'captcha' | 'login' | 'parada', esperarAte }.
 */
async function atenderLote(o) {
  const P = core();
  const agora = o.agora || Date.now;
  const dormir = o.dormir || dormirPadrao;
  const painel = o.painel || { fazendo() {}, atividade() {}, erro() {} };
  let feitos = 0;
  let ultimoPerfilEm = o.ultimoPerfilEm || 0;
  if (!P.dentroDaJanelaDoEcac(agora())) return { feitos, parouPor: 'janela', esperarAte: agora() + P.esperaAteAJanela(agora()) };
  const entrada = await o.portal.entrar();
  if (entrada) {
    // a verificação de robô ou o login que não fecha: ninguém resolve de madrugada; tenta de novo só amanhã
    painel.erro(ROBO, entrada === 'captcha' ? 'O gov.br pediu a verificação "não sou um robô"' : 'O e-CAC não entrou com o certificado do escritório', 'os pedidos esperam a próxima noite');
    for (const it of o.pedidos) await it.ref.update({ aviso: entrada === 'captcha' ? 'o gov.br pediu a verificação "não sou um robô"; tento de novo na próxima noite' : 'o e-CAC não entrou com o certificado; tento de novo na próxima noite' }).catch(() => {});
    return { feitos, parouPor: entrada === 'captcha' ? 'captcha' : 'login', esperarAte: proximaNoite(agora()) };
  }
  for (const it of o.pedidos) {
    if (o.parar && o.parar()) return { feitos, parouPor: 'parada', esperarAte: 0 };
    const p = it.dados;
    const ruim = motivoDoPedidoRuim(p);
    if (ruim) { await it.ref.update({ status: 'erro', erro: ruim, fimEm: new Date(agora()).toISOString() }); continue; }
    // a troca de perfil só a cada 35 s (a Receita pede 30); a janela é conferida DEPOIS da espera
    const falta = ultimoPerfilEm + P.ESPERA_ENTRE_PERFIS_MS - agora();
    if (falta > 0) await dormir(falta);
    if (o.parar && o.parar()) return { feitos, parouPor: 'parada', esperarAte: 0 };
    if (!P.dentroDaJanelaDoEcac(agora())) return { feitos, parouPor: 'janela', esperarAte: agora() + P.esperaAteAJanela(agora()), ultimoPerfilEm };
    const tentativas = (Number(p.tentativas) || 0) + 1;
    await it.ref.update({ status: 'trabalhando', inicioEm: new Date(agora()).toISOString(), tentativas, aviso: '' });
    painel.fazendo(ROBO, 'PGDAS-D de ' + quem(p));
    const passos = [];
    const passo = t => { passos.push({ em: new Date(agora()).toISOString(), texto: String(t).slice(0, 300) }); };
    try {
      passo('trocando o perfil para Procurador de ' + p.cnpj);
      const perfil = await o.portal.trocarPerfil(p.cnpj);
      ultimoPerfilEm = agora();
      if (perfil) throw new Error(perfil);
      if (p.modo === 'ensaio') {
        const r = await o.portal.ensaio(p.competencia);
        for (const x of r.passos || []) passos.push(x);
        await it.ref.update({ status: 'pronto', fimEm: new Date(agora()).toISOString(), passos: passos.slice(-40), resultado: { ensaio: true, achouOMes: !!r.achouOMes } });
        painel.atividade(ROBO, 'Conferiu o caminho do PGDAS-D de ' + quem(p) + ' (ensaio, nada baixado)', r.achouOMes ? 'achou a declaração do mês' : 'não achou a declaração do mês');
        feitos++;
        continue;
      }
      passo('baixando o extrato do PGDAS-D de ' + p.competencia);
      const baixado = await o.portal.baixarExtrato(p.competencia);
      if (baixado.erro) throw new Error(baixado.erro);
      const bytes = baixado.bytes;
      if (!bytes || bytes.length < 5 || Buffer.from(bytes.slice(0, 5)).toString('latin1') !== '%PDF-') throw new Error('o arquivo baixado não é um PDF');
      const extrato = P.extratoDoPgdas(await o.textoDoPdf(bytes));
      if (!extrato) throw new Error('o PDF baixado não é um extrato do PGDAS-D');
      if (extrato.competencia !== p.competencia) throw new Error('o extrato baixado é de ' + extrato.competencia + ', não de ' + p.competencia);
      const empresa = { codigo: Number(p.codigo), cnpj: String(p.cnpj), nome: String(p.empresa || '') };
      // o CNPJ que não bate é recusado aqui (nada é gravado)
      const doc = P.juntarExtrato(P.lerPgdasDaEmpresa(await o.lerPgdas(empresa.codigo)), extrato, empresa, new Date(agora()));
      await o.gravarPgdas(empresa.codigo, doc);
      passo('gravado no resumo da empresa (pgdas/' + empresa.codigo + ')');
      let arquivo = '';
      try { arquivo = await o.gravarPdf(p, bytes); passo('PDF deixado para o arquivador: ' + arquivo); }
      catch (err) { passo('o PDF não foi para o Drive: ' + err.message); o.log('PGDAS: o PDF de', quem(p), 'não foi para o Drive -', err.message); }
      await it.ref.update({ status: 'pronto', fimEm: new Date(agora()).toISOString(), passos: passos.slice(-40), erro: '',
        resultado: { receita: extrato.receita.total, rbt12: extrato.rbt12, declaracao: extrato.declaracao, transmitidaEm: extrato.transmitidaEm, meses: 1 + extrato.anteriores.length, arquivo } });
      painel.atividade(ROBO, 'Baixou o PGDAS-D de ' + quem(p), 'receita do mês R$ ' + extrato.receita.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + (extrato.rbt12 != null ? ' · RBT12 R$ ' + extrato.rbt12.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''));
      feitos++;
    } catch (err) {
      const motivo = String((err && err.message) || err).slice(0, 300);
      const deNovo = tentativas < MAX_TENTATIVAS && !/procura[cç][aã]o|outro CNPJ|n[aã]o h[aá] declara/i.test(motivo);
      await it.ref.update({ status: deNovo ? 'pendente' : 'erro', erro: motivo, fimEm: new Date(agora()).toISOString(), passos: passos.slice(-40) });
      painel.erro(ROBO, 'O PGDAS-D de ' + quem(p) + (deNovo ? ' fica para a próxima volta' : ' não saiu'), motivo, { pedido: it.ref.id });
      o.log('PGDAS:', quem(p), '-', motivo);
    } finally {
      painel.fazendo(ROBO, null);
    }
  }
  return { feitos, parouPor: '', esperarAte: 0, ultimoPerfilEm };
}

// ---------- o portal de verdade (o Chrome do robô) ----------

const PORTAL = {
  login: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
  ecac: 'https://cav.receita.fazenda.gov.br/ecac/',
  // o PGDAS-D 2018 (a consulta das declarações transmitidas)
  consulta: 'https://sinac.cav.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgdasd2018.app/Consulta',
};

/** Liga no Chrome do robô (o do FGTS) e abre uma aba só do PGDAS. */
function criarPortalNoChrome(log) {
  const chrome = require('./fgts-chrome');
  let browser = null, page = null;
  const textoDaPagina = () => page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
  const temCaptcha = () => page.evaluate(() => [...document.querySelectorAll('iframe[src*="hcaptcha"], iframe[src*="recaptcha"]')]
    .some(f => { const r = f.getBoundingClientRect(); const s = getComputedStyle(f); return r.width > 250 && r.height > 60 && s.visibility !== 'hidden' && s.display !== 'none'; })).catch(() => false);
  const clicarTexto = re => page.evaluate(fonte => {
    const re = new RegExp(fonte, 'i');
    const el = [...document.querySelectorAll('button, a, [role=button], input[type=submit], input[type=button]')]
      .find(e => e.offsetParent !== null && re.test((e.innerText || e.value || e.getAttribute('aria-label') || e.title || '').trim()));
    if (!el) return false;
    el.click();
    return true;
  }, re.source).catch(() => false);
  const logado = async () => /cav\.receita\.fazenda\.gov\.br/.test(page.url()) && /Alterar perfil de acesso|Sair com seguran|Titular \(|Procurador/i.test(await textoDaPagina());
  const resumoDaTela = async () => ({ em: new Date().toISOString(), texto: (page.url() + ' · ' + String(await textoDaPagina()).replace(/\s+/g, ' ')).slice(0, 300) });

  return {
    async entrar() {
      if (!browser) {
        ({ browser } = await chrome.ligarNoChrome(log));
        page = await browser.newPage();
      }
      await page.goto(PORTAL.ecac, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await dormirPadrao(3000);
      if (await logado()) return '';
      if (!/acesso\.gov\.br/.test(page.url())) {
        await page.goto(PORTAL.login, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await dormirPadrao(2000);
        await clicarTexto(/Entrar com gov\.?br|Acesso gov\.?br/);
        await dormirPadrao(4000);
      }
      const ate = Date.now() + 90000;
      let clicouCert = false;
      while (Date.now() < ate) {
        if (await temCaptcha()) return 'captcha';
        if (await logado()) return '';
        if (/acesso\.gov\.br/.test(page.url()) && !clicouCert) clicouCert = await clicarTexto(/Seu certificado digital/);
        await dormirPadrao(2000);
      }
      return (await temCaptcha()) ? 'captcha' : 'login';
    },
    async trocarPerfil(cnpj) {
      await page.goto(PORTAL.ecac, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await dormirPadrao(2000);
      if (!(await clicarTexto(/Alterar perfil de acesso/))) return 'não achei o "Alterar perfil de acesso" no e-CAC';
      await dormirPadrao(2500);
      // o campo do CNPJ do bloco "Procurador" (o mais perto do texto "Procurador")
      const marcou = await page.evaluate(() => {
        const campos = [...document.querySelectorAll('input[type=text], input:not([type])')].filter(e => e.offsetParent !== null);
        const doProcurador = campos.find(e => { let p = e.parentElement; for (let i = 0; i < 5 && p; i++, p = p.parentElement) if (/Procurador/i.test(p.innerText || '')) return true; return false; });
        if (!doProcurador) return false;
        doProcurador.setAttribute('data-nads-pgdas', 'cnpj');
        doProcurador.value = '';
        return true;
      }).catch(() => false);
      if (!marcou) return 'não achei o campo do CNPJ de Procurador no "Alterar perfil de acesso"';
      await page.type('[data-nads-pgdas="cnpj"]', cnpj, { delay: 40 });
      const clicou = await page.evaluate(() => {
        const campo = document.querySelector('[data-nads-pgdas="cnpj"]');
        let p = campo && campo.parentElement;
        for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
          const b = [...p.querySelectorAll('button, input[type=button], input[type=submit], a')].find(x => /^Alterar$/i.test((x.innerText || x.value || '').trim()));
          if (b) { b.click(); return true; }
        }
        return false;
      }).catch(() => false);
      if (!clicou) return 'não achei o botão Alterar do perfil de Procurador';
      await dormirPadrao(4000);
      const t = await textoDaPagina();
      if (/n[aã]o (possui|h[aá]) procura[cç][aã]o|procura[cç][aã]o (n[aã]o encontrada|inexistente|vencida)/i.test(t)) return 'sem procuração no e-CAC para ' + cnpj;
      const comMascara = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      if (!t.includes(comMascara) && !t.includes(cnpj)) return 'o perfil não mudou para ' + comMascara;
      return '';
    },
    /** a lista das declarações do ano da competência; devolve o link do extrato da última declaração do mês */
    async abrirDeclaracoesDoAno(competencia) {
      const [ano, mes] = competencia.split('-');
      await page.goto(PORTAL.consulta, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await dormirPadrao(3000);
      await page.evaluate(a => {
        const campo = [...document.querySelectorAll('input, select')].find(e => e.offsetParent !== null && /ano/i.test((e.name || '') + ' ' + (e.id || '') + ' ' + (e.placeholder || '')));
        if (!campo) return;
        campo.value = a;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
      }, ano).catch(() => {});
      await clicarTexto(/^(Consultar|Pesquisar|Continuar|OK)$/);
      await dormirPadrao(4000);
      // a linha do mês: o PA "mm/aaaa"; dentro dela, o último link de extrato (a declaração mais nova vem por último)
      return page.evaluate(pa => {
        const linhas = [...document.querySelectorAll('tr, li, .row')].filter(l => (l.innerText || '').includes(pa));
        const links = linhas.flatMap(l => [...l.querySelectorAll('a, button')]).filter(a => /extrato/i.test((a.innerText || '') + ' ' + (a.title || '') + ' ' + (a.getAttribute('href') || '')));
        const ultimo = links[links.length - 1];
        return { achouOMes: linhas.length > 0, href: ultimo && ultimo.href ? ultimo.href : '', temBotao: !!ultimo };
      }, mes + '/' + ano).catch(() => ({ achouOMes: false, href: '', temBotao: false }));
    },
    async ensaio(competencia) {
      const passos = [await resumoDaTela()];
      const r = await this.abrirDeclaracoesDoAno(competencia);
      passos.push(await resumoDaTela());
      passos.push({ em: new Date().toISOString(), texto: r.achouOMes ? ('achou a linha do mês; link do extrato: ' + (r.href || (r.temBotao ? 'botão sem endereço' : 'nenhum'))) : 'não achou a linha do mês na lista' });
      return { passos, achouOMes: r.achouOMes };
    },
    async baixarExtrato(competencia) {
      const r = await this.abrirDeclaracoesDoAno(competencia);
      if (!r.achouOMes) return { erro: 'não há declaração do PGDAS-D de ' + competencia.slice(5) + '/' + competencia.slice(0, 4) + ' na lista do e-CAC' };
      if (!r.href) return { erro: 'achei a declaração do mês, mas não o link do extrato (confira com um ensaio)' };
      // o PDF pela sessão da própria aba (os cookies do e-CAC vão juntos)
      const b64 = await page.evaluate(async url => {
        const resp = await fetch(url, { credentials: 'include' });
        if (!resp.ok) return 'ERRO:' + resp.status;
        const buf = new Uint8Array(await resp.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        return btoa(s);
      }, r.href).catch(err => 'ERRO:' + err.message);
      if (/^ERRO:/.test(b64)) return { erro: 'o extrato não baixou (' + b64.slice(5, 80) + ')' };
      return { bytes: Buffer.from(b64, 'base64') };
    },
    async fechar() {
      try { if (page) await page.close(); } catch (_) { /* já fechada */ }
      try { if (browser) browser.disconnect(); } catch (_) { /* já solto */ }
      browser = null; page = null;
    },
  };
}

// ---------- o módulo (robo-modulo.js pgdas) ----------

function iniciarPgdas(db, log) {
  const painel = require('./painel');
  const pausaLocal = require('./pausa-local');
  const ocupado = require('./ocupado');
  const { ouvir } = require('./ouvinte');
  const P = core();
  painel.modulo(ROBO, NOME, true);
  let fila = [];
  let trabalhando = false;
  let esperarAte = 0;
  let ultimoPerfilEm = 0;
  let timer = null;

  const gravarPdf = async (p, bytes) => {
    if (!fs.existsSync(ENTRADA)) throw new Error('falta a pasta ' + ENTRADA);
    const pasta = pastaDeEntrada(ENTRADA, p.competencia, p.codigo, p.empresa);
    fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, nomeDoPdf(p.codigo, p.competencia));
    // o mesmo nome com outro conteúdo (a retificação): o arquivador decide; aqui nunca sobrescreve
    const final = fs.existsSync(arq) && !fs.readFileSync(arq).equals(Buffer.from(bytes)) ? arq.replace(/\.pdf$/, ' (' + Date.now() + ').pdf') : arq;
    if (!fs.existsSync(final)) fs.writeFileSync(final, Buffer.from(bytes));
    return path.relative(ENTRADA, final);
  };

  async function proximo() {
    if (trabalhando || !fila.length || pausaLocal.estaPausado(ROBO) || ocupado.parando()) return;
    if (Date.now() < esperarAte) return;
    trabalhando = true;
    const portal = criarPortalNoChrome(log);
    try {
      const lote = ordemDaFila(fila);
      painel.fazendo(ROBO, NOME + ': lote de ' + lote.length + (lote.length === 1 ? ' empresa' : ' empresas'));
      const r = await atenderLote({
        pedidos: lote, portal, log, painel, ultimoPerfilEm,
        parar: () => pausaLocal.estaPausado(ROBO) || ocupado.parando(),
        lerPgdas: async codigo => { const s = await db.collection('pgdas').doc(String(codigo)).get(); return s.exists ? s.data() : null; },
        gravarPgdas: (codigo, doc) => db.collection('pgdas').doc(String(codigo)).set(doc),
        textoDoPdf: async bytes => P.textoDoPdf(await P.itensDoPdf(new Uint8Array(bytes))),
        gravarPdf,
      });
      if (r.ultimoPerfilEm) ultimoPerfilEm = r.ultimoPerfilEm;
      if (r.esperarAte) esperarAte = r.esperarAte;
      if (r.parouPor === 'janela') log('PGDAS: fora da janela do e-CAC (23h às 8h); os pedidos esperam');
      if (r.parouPor === 'captcha' || r.parouPor === 'login') log('PGDAS: o e-CAC não entrou (' + r.parouPor + '); volto em', new Date(esperarAte).toLocaleString('pt-BR'));
    } catch (err) {
      log('PGDAS: o lote não abriu -', err.message);
      painel.erro(ROBO, 'O lote do PGDAS-D não abriu', err.message);
      esperarAte = Date.now() + 30 * 60000;
    } finally {
      await portal.fechar().catch(() => {});
      painel.fazendo(ROBO, null);
      trabalhando = false;
    }
  }

  // a fila (uma igualdade só: não precisa de índice)
  ouvir('pgdas: pedidos', () => db.collection(COLECAO).where('status', '==', 'pendente'), snap => {
    fila = snap.docs.map(d => ({ ref: d.ref, dados: d.data() || {} }));
    setTimeout(proximo, 1000);
  }, log);
  // de 5 em 5 minutos (a janela que abre, a espera depois da verificação de robô que acaba)
  timer = setInterval(proximo, 5 * 60000);
  if (timer.unref) timer.unref();
  pausaLocal.quandoRetomar(ROBO, () => setTimeout(proximo, 1000));
  log('PGDAS: ligado (atende só das 23h às 8h)');
}

module.exports = { iniciarPgdas, atenderLote, criarPortalNoChrome, motivoDoPedidoRuim, ordemDaFila, nomeDoPdf, pastaDeEntrada, proximaNoite, COLECAO, PORTAL };
