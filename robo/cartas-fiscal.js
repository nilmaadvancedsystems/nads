// As cartas do Fiscal aos clientes (12/11/2026: "preciso de um envio de carta de balanco para varios clientes para o final do
// ano, e todo mês enviar mandar um cheklist do que ele tem que enviar"). Os textos, as datas e o PDF vêm do core e do nads,
// pelo robo/gerado/cartas.js (scripts/robo-cartas.mjs). Roda no robô da nuvem, que tem o certificado do escritório
// (fgts_certificado.pfx, o mesmo da NFS-e):
//
//   1. a Carta de balanço: o Fiscal escolhe os clientes em Fiscal › Cartas e cada um vira um pedido na fila de e-mails
//      (solicitacoesEmail, tipo 'cartaBalanco', status 'pendente'); o vigia chama atenderCartaBalanco. O robô desenha o PDF
//      (a Declaração de inventário e a Carta, com o nome do cliente, o ano e o prazo), ASSINA com o certificado e-CNPJ do
//      escritório (PKCS#7 destacado, adbe.pkcs7.detached, como o Adobe) e manda pela caixa do Fiscal. O teste (teste: true)
//      vai só para o escritório, com o nome do cliente escolhido na carta;
//   2. o Checklist mensal (iniciarChecklistMensal): no último dia útil do mês, a partir das 8h (Brasília), um e-mail para
//      cada cliente ativo com e-mail no cadastro (menos os de config/checklistMensal.fora; pausado com ligado: false): o
//      checklist no corpo (HTML) e o PDF do escritório anexo (modelos-fiscal/checklist-mensal.pdf). Cada envio é um
//      registro em solicitacoesEmail com o id checklist_<AAAA-MM>_<código>, criado ANTES de mandar (create: o segundo
//      falha), então o mesmo cliente nunca recebe dois no mês, nem com o robô caindo no meio.
//
// A TRAVA (como a do Mandei e a dos boletos): enquanto LIBERADO_PARA_CLIENTES for false, a carta só sai como teste (para
// INTERNOS) e o checklist automático não roda. Liberar é mudar a constante, com o ok do escritório, e atualizar o robô.
const fs = require('fs');
const path = require('path');

const LIBERADO_PARA_CLIENTES = false;
const INTERNOS = ['nilmacontabilidade@gmail.com'];
const PDF_DO_CHECKLIST = path.join(__dirname, 'modelos-fiscal', 'checklist-mensal.pdf');
const NOME_DO_PDF_DO_CHECKLIST = 'Checklist mensal de documentos.pdf';
const HORA_DO_CHECKLIST = 8;
const A_CADA_MS = 20 * 60 * 1000;

const cartas = () => require('./gerado/cartas');

// ---------- funções puras (testadas sem rede) ----------

/**
 * Assina o PDF que veio com o lugar da assinatura reservado (cartaDeBalancoPdf.ts, reservarAssinatura): troca o /ByteRange
 * em branco pelos números (o PDF inteiro menos o /Contents) e grava no /Contents a assinatura PKCS#7 destacada (SHA-256,
 * com o certificado, a cadeia e a hora). O mesmo que o @signpdf faz, só com o node-forge.
 * cert: { chavePem, certPem, cadeiaPem?: [] }; devolve o Buffer do PDF assinado.
 */
function assinarPdf(pdf, cert, quando = new Date()) {
  const forge = require('node-forge');
  const C = cartas();
  const original = Buffer.from(pdf);
  const texto = original.toString('latin1');
  const marca = /\/ByteRange\s*\[\s*0\s+\/\*{10}\s+\/\*{10}\s+\/\*{10}\s*\]/.exec(texto);
  if (!marca) throw new Error('o PDF não tem o lugar da assinatura');
  const branco = '<' + '0'.repeat(C.TAMANHO_DA_ASSINATURA * 2) + '>';
  const inicio = texto.indexOf(branco);
  if (inicio < 0 || texto.indexOf(branco, inicio + 1) >= 0) throw new Error('o PDF não tem um lugar só para a assinatura');
  const fim = inicio + branco.length;
  const faixa = ('/ByteRange [0 ' + inicio + ' ' + fim + ' ' + (original.length - fim) + ']');
  if (faixa.length > marca[0].length) throw new Error('o /ByteRange não coube no lugar reservado');
  const pronto = Buffer.from(original);
  pronto.write(faixa.padEnd(marca[0].length, ' '), marca.index, 'latin1');
  const dados = Buffer.concat([pronto.subarray(0, inicio), pronto.subarray(fim)]);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(dados.toString('binary'));
  const certificado = forge.pki.certificateFromPem(cert.certPem);
  p7.addCertificate(certificado);
  for (const c of cert.cadeiaPem || []) p7.addCertificate(forge.pki.certificateFromPem(c));
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(cert.chavePem), certificate: certificado, digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: quando },
    ],
  });
  p7.sign({ detached: true });
  const hex = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary').toString('hex');
  if (hex.length > C.TAMANHO_DA_ASSINATURA * 2) throw new Error('a assinatura não coube no lugar reservado');
  pronto.write('<' + hex.padEnd(C.TAMANHO_DA_ASSINATURA * 2, '0') + '>', inicio, 'latin1');
  return pronto;
}

/** Por que a carta não sai ('' = pode). p: o pedido; podeFiscal: quem pediu é do Fiscal ou admin. */
function motivoParaNaoMandarCarta(p, { podeFiscal, liberado = LIBERADO_PARA_CLIENTES } = {}) {
  if (!p || p.tipo !== 'cartaBalanco') return 'o pedido não é de carta de balanço';
  const problema = cartas().problemaDaCarta(Number(p.ano), String(p.prazo || ''));
  if (problema) return problema;
  if (!/^\d+$/.test(String(p.codigo || ''))) return 'o pedido está sem o código do cliente';
  if (!podeFiscal) return 'só o Fiscal e o administrador mandam a carta de balanço';
  if (p.teste !== true && !liberado) return 'o envio da carta aos clientes ainda não foi liberado (por enquanto só o teste, para ' + INTERNOS.join(', ') + ')';
  return '';
}

/** O CN do certificado como o selo mostra: 'NILMA DIAS OLIVEIRA:27872981000113'. */
const titularDoCertificado = cert => String(cert.titular || '') + (cert.documento ? ':' + cert.documento : '');

/** 'AAAA-MM-DD' e a hora em Brasília de um instante. */
function agoraEmBrasilia(quando) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(quando).map(x => [x.type, x.value]));
  return { dia: partes.year + '-' + partes.month + '-' + partes.day, hora: Number(partes.hour) };
}

/** Os clientes que recebem o checklist: o código (só números), o nome; sem repetir e sem os de fora. */
function clientesDoChecklist(ativos, fora) {
  const tira = new Set((fora || []).map(String));
  const vistos = new Set();
  const lista = [];
  for (const c of ativos || []) {
    const codigo = String((c && c.codigoOrigem) || '').trim();
    if (!/^\d+$/.test(codigo) || tira.has(codigo) || vistos.has(codigo)) continue;
    vistos.add(codigo);
    lista.push({ codigo, nome: String(c.nome || '').trim() });
  }
  return lista.sort((a, b) => Number(a.codigo) - Number(b.codigo));
}

// ---------- o robô ----------

async function podeNoFiscal(db, uid) {
  const u = uid ? ((await db.collection('usuarios').doc(String(uid)).get()).data() || {}) : {};
  const papeis = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
  return papeis.includes('admin') || papeis.includes('fiscal') || u.departamento === 'fiscal';
}

/** O cliente no cadastro do Entregas (os ativos), pelo código. */
function clienteDosAtivos(ativos, codigo) {
  let achado = null;
  ativos.forEach(d => { if (!achado && String(d.data().codigoOrigem || '').trim() === String(codigo)) achado = d.data(); });
  return achado;
}

/**
 * O pedido da carta (vigia-robo.js, a fila). deps: { db, log, clientesAtivos(), enviar(dados) -> gmailId, de (o endereço
 * que manda), assinatura, certificado() -> { chavePem, certPem, cadeiaPem, titular, documento } | { erro }, agora() }.
 * Devolve o que o vigia grava no pedido; dá erro com a frase para o pedido.
 */
async function atenderCartaBalanco(p, deps) {
  const { db } = deps;
  const C = cartas();
  const motivo = motivoParaNaoMandarCarta(p, { podeFiscal: await podeNoFiscal(db, p.criadoPorUid) });
  if (motivo) throw new Error(motivo);
  const ativos = await deps.clientesAtivos();
  let empresa;
  let para;
  if (p.teste === true) {
    const c = clienteDosAtivos(ativos, p.codigo);
    empresa = String((c && c.nome) || p.empresa || '').trim();
    para = INTERNOS.slice();
  } else {
    const r = await require('./envios-do-dp').destinatarios(db, p.codigo, ativos);
    empresa = String(r.cliente.nome || '').trim();
    para = r.para;
  }
  if (!empresa) throw new Error('o cliente ' + p.codigo + ' não está no cadastro (ou está inativo)');
  const cert = deps.certificado();
  if (cert.erro) throw new Error(cert.erro);
  const quando = new Date(deps.agora());
  // o dia da carta é o de Brasília, qualquer que seja o fuso da máquina
  const [a, m, d] = agoraEmBrasilia(quando).dia.split('-').map(Number);
  const dados = C.dadosDaCarta({ empresa, ano: Number(p.ano), prazo: String(p.prazo), hoje: new Date(a, m - 1, d) });
  const desenho = await C.desenharCartaDeBalanco(dados, { assinatura: { titular: titularDoCertificado(cert), quando }, reservarAssinatura: true });
  const pdf = assinarPdf(desenho, cert, quando);
  const nome = C.nomeDoPdfDaCarta(empresa, dados.ano);
  const email = C.emailDaCarta(dados);
  const assunto = (p.teste === true ? '[TESTE] ' : '') + email.assunto;
  const visual = require('./email-html').htmlDoAvisoFiscal({
    assunto, cliente: empresa, manchete: 'Sua carta de balanço de ' + dados.ano + ' chegou', texto: email.texto,
    numeros: [['Inventário em', dados.inventarioEm], ['Enviar até', diaCurto(dados.prazo)]], anexos: [{ nome }], assinatura: deps.assinatura, caixa: deps.de,
  });
  const gmailId = await deps.enviar({ para: para.join(', '), assunto, corpo: email.texto + '\n\n- ' + nome, html: visual.html, imagens: visual.imagens, anexos: [{ nome, mime: 'application/pdf', buffer: pdf }] });
  return { status: 'enviado', enviadoEm: new Date(deps.agora()).toISOString(), para, assunto, gmailId: String(gmailId || ''), empresa, arquivo: nome, resumo: (p.teste === true ? 'teste de ' : '') + empresa };
}

const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** '02/12/2026' -> '2 dez' (o número grande do e-mail); o que não for data fica como veio */
function diaCurto(br) {
  const m = /^(\d{2})\/(\d{2})\/\d{4}$/.exec(String(br || ''));
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? Number(m[1]) + ' ' + MES_ABREV[Number(m[2]) - 1] : String(br || '');
}

/**
 * O e-mail do checklist de um cliente: o HTML com o checklist e o PDF do escritório anexo.
 * o: { competencia, cliente, pdf (Buffer), de, assinatura } -> { assunto, corpo, html, imagens, anexos }
 */
function emailDoChecklist(o) {
  const C = cartas();
  const { assunto, texto } = C.emailDoChecklist(o.competencia, o.cliente);
  const campos = C.camposDoChecklist(o.competencia, o.cliente);
  const visual = require('./email-html').htmlDoAvisoFiscal({
    assunto, cliente: o.cliente, manchete: 'O checklist de documentos de ' + campos.mes.replace(/ de \d{4}$/, '') + ' chegou', texto,
    previa: 'Envie os documentos de ' + campos.mes + ' até ' + campos.prazo + '.',
    numeros: [['Enviar até', diaCurto(campos.prazo)], ['Competência', campos.mes.replace(' de ', '/')]],
    anexos: o.pdf ? [{ nome: NOME_DO_PDF_DO_CHECKLIST }] : [], secoes: C.CHECKLIST, atencao: C.CHECKLIST_ATENCAO, assinatura: o.assinatura, caixa: o.de,
  });
  return {
    assunto, corpo: texto + '\n\n' + C.checklistEmTexto(), html: visual.html, imagens: visual.imagens,
    anexos: o.pdf ? [{ nome: NOME_DO_PDF_DO_CHECKLIST, mime: 'application/pdf', buffer: o.pdf }] : [],
  };
}

/**
 * Uma volta do checklist do mês (comp): manda para os clientes que faltam, até o freio. ja: os códigos já tratados nesta
 * competência (o robô guarda entre as voltas). Devolve { enviados, erros, parou } ou null (pausado em config/checklistMensal).
 */
async function mandarChecklistDoMes(db, deps, comp, ja) {
  const C = cartas();
  const agora = deps.agora || (() => Date.now());
  const cfg = C.configDoChecklist((await db.collection('config').doc('checklistMensal').get()).data());
  if (!cfg.ligado) return null;
  const ativos = await deps.clientesAtivos();
  const dados = [];
  ativos.forEach(d => dados.push(d.data()));
  const clientes = clientesDoChecklist(dados, cfg.fora);
  const envio = await deps.envio();
  const pdf = deps.pdf || fs.readFileSync(PDF_DO_CHECKLIST);
  let enviados = 0, erros = 0, parou = false;
  for (const c of clientes) {
    if (ja.has(c.codigo)) continue;
    if (!envio.podeMais()) { parou = true; break; }
    const ref = db.collection('solicitacoesEmail').doc(C.idDoChecklist(comp, c.codigo));
    try {
      await ref.create({ tipo: 'checklistMensal', status: 'enviando', origem: 'robo', departamento: 'fiscal', competencia: comp, codigo: c.codigo, empresa: c.nome, criadoEm: new Date(agora()).toISOString(), criadoPor: 'robô' });
    } catch (err) {
      // já existe: este cliente já foi tratado neste mês (o robô caiu e voltou, ou outra máquina)
      if (err && (err.code === 6 || /already exists/i.test(err.message))) { ja.add(c.codigo); continue; }
      throw err;
    }
    ja.add(c.codigo);
    try {
      const { cliente, para } = await require('./envios-do-dp').destinatarios(db, c.codigo, ativos);
      const e = emailDoChecklist({ competencia: comp, cliente: String(cliente.nome || c.nome).trim(), pdf, de: envio.de, assinatura: envio.assinatura });
      const gmailId = await envio.enviar({ para: para.join(', '), assunto: e.assunto, corpo: e.corpo, html: e.html, imagens: e.imagens, anexos: e.anexos });
      await ref.update({ status: 'enviado', para, assunto: e.assunto, gmailId: String(gmailId || ''), enviadoEm: new Date(agora()).toISOString() });
      enviados++;
    } catch (err) {
      erros++;
      await ref.update({ status: 'erro', erro: String(err.message || err).slice(0, 300), erroEm: new Date(agora()).toISOString() }).catch(() => {});
    }
  }
  return { enviados, erros, parou };
}

/**
 * O checklist automático. deps: { log, clientesAtivos(), envio() -> { de, assinatura, podeMais(), enviar(dados) -> gmailId },
 * agora?() }. Confere a cada 20 min; só lê o banco no dia do checklist.
 */
function iniciarChecklistMensal(db, deps) {
  const { log } = deps;
  const C = cartas();
  const agora = deps.agora || (() => Date.now());
  const feitos = new Set();         // competências já terminadas
  const mandados = new Map();       // competência -> códigos já tratados (para não tentar o create de novo)
  let ocupado = false;
  let avisouTrava = '';
  async function rodar() {
    if (ocupado) return;
    const { dia, hora } = agoraEmBrasilia(new Date(agora()));
    const comp = C.checklistDeHoje(dia);
    if (!comp || hora < HORA_DO_CHECKLIST || feitos.has(comp)) return;
    if (!LIBERADO_PARA_CLIENTES) {
      if (avisouTrava !== comp) { avisouTrava = comp; log('checklist do mês ' + comp + ': ainda não liberado para os clientes (robo/cartas-fiscal.js); nada foi mandado'); }
      return;
    }
    ocupado = true;
    require('./ocupado').marcar('checklist-mensal', 'Checklist do mês');
    try {
      const ja = mandados.get(comp) || new Set();
      mandados.set(comp, ja);
      const r = await mandarChecklistDoMes(db, deps, comp, ja);
      if (!r) return;
      const { enviados, erros, parou } = r;
      if (parou) log('checklist do mês: freio do Gmail; o resto vai na próxima volta');
      else feitos.add(comp);
      if (enviados || erros) log('checklist do mês ' + comp + ':', enviados, 'enviado(s)' + (erros ? ', ' + erros + ' com erro' : '') + (parou ? ' (continua na próxima volta)' : ''));
      if (enviados) require('./painel').atividade('gmail', 'Mandou o checklist do mês (' + enviados + ' clientes' + (erros ? ', ' + erros + ' com erro' : '') + ')', comp);
    } catch (err) {
      log('checklist do mês: deu erro:', err.message);
    } finally {
      ocupado = false;
      require('./ocupado').marcar('checklist-mensal', null);
    }
  }
  setInterval(() => { void rodar(); }, A_CADA_MS);
  setTimeout(() => { void rodar(); }, 60 * 1000);
  log('checklist do mês: ligado' + (LIBERADO_PARA_CLIENTES ? '' : ' (travado: não manda para os clientes)'));
}

module.exports = {
  atenderCartaBalanco, iniciarChecklistMensal, mandarChecklistDoMes,
  // puras, pro teste
  assinarPdf, motivoParaNaoMandarCarta, titularDoCertificado, agoraEmBrasilia, clientesDoChecklist, emailDoChecklist,
  LIBERADO_PARA_CLIENTES, INTERNOS, PDF_DO_CHECKLIST,
};
