// A ponte do nads com o eContador do Alterdata (07/11/2026): os clientes que recebem pelo eContador (a entrega
// "eContador" da planilha do DP, empresas/dp.ts, ou a das Configurações do DP no Cadastro do nads; no Fiscal, a via
// "eContador" do Enviar guias) hoje recebem o e-mail e alguém sobe a guia à mão no eContador. Este módulo deixa a guia
// e o recibo numa PASTA DE SAÍDA no NILMA-SERVER, que o UpDocs do eContador vigia e sobe sozinho.
//
// O que a ajuda oficial diz (https://ajuda.alterdata.com.br/packupbase/tema-updocs/updocs-tudo-que-voce-precisa-saber):
// o UpDocs é um programa de Windows (abre com o PC, fica na bandeja), logado com o usuário do escritório no eContador;
// escolhe-se UMA pasta e ele manda o que entra nela. Lê PDF pelo layout (DAS, FGTS, DARF, GPS, DAE, recibos… a lista em
// .../updocs-arquivos-modelos-de-layouts-reconhecidos); a ajuda não fala de regra de nome de arquivo (a empresa sai do
// conteúdo da guia). Depois de enviar, ele mesmo organiza os arquivos em subpastas (configuração do eContador). Por isso
// aqui: só PDF, todos na raiz da pasta (porCliente = uma subpasta por cliente, se o UpDocs ler subpastas), o nome no
// padrão do e-mail do DP com o código na frente ("58 - FGTS 10-2026 - TORNEARIA VOLPONI.pdf"), sem sobrescrever, e
// escrito com outro nome e renomeado no fim (o UpDocs nunca pega um PDF pela metade).
//
// Como anda (tudo DESLIGADO por padrão: sem config/econtador, nada muda):
//
//   config/econtador (o banco; só o robô lê, pelo Admin SDK):
//     { pasta: { ligado: false, raiz: 'D:\\eContador\\UpDocs', porCliente: false, semEmail: false },
//       api:   { ligado: false } }
//     pasta.ligado   a guia do cliente do eContador entra na fila da pasta de saída
//     pasta.raiz     a pasta que o UpDocs vigia (no NILMA-SERVER; ECONTADOR_PASTA no ambiente do servidor vale mais)
//     pasta.semEmail o cliente do eContador NÃO recebe mais o e-mail do DP (só a pasta). Falso = e-mail e pasta.
//     api.ligado     o cliente da API do ePlugin (econtador-api.js), com o token só em ECONTADOR_TOKEN
//
//   1. na nuvem (lote-dp.js, envios-do-dp.js, lote-fiscal.js): depois de gravar no Drive, o envio do cliente do eContador
//      vira econtadorSaida/{id} { status: 'pendente', origem, codigo, competencia, empresa, registro, arquivos:
//      [{ driveId, nome, destino }] } e o registro do envio (solicitacoesEmail/{registro}) ganha econtadorSaida: id;
//   2. no NILMA-SERVER (iniciarPastaEcontador, ou `node econtador.js` sozinho): baixa cada PDF do Drive pelo id, grava na
//      pasta e marca econtadorSaida 'gravado' e o registro com econtador: { status: 'pasta', em, arquivos } — o
//      "enviado ao eContador (pasta)" do nads. O que não deu fica 'erro' (tenta de novo até MAX_TENTATIVAS).
const fs = require('fs');
const path = require('path');

const COLECAO = 'econtadorSaida';
const CONFIG = 'econtador';
const MAX_TENTATIVAS = 3;
const CONFIG_VALE_MS = 5 * 60 * 1000;
const DESLIGADO = Object.freeze({ pasta: false, semEmail: false });

// ---------- funções puras (testadas sem rede) ----------

const texto = v => (typeof v === 'string' ? v.trim() : '');
const sim = v => v === true;

/** config/econtador como vale: tudo desligado no que faltar. ambiente: ECONTADOR_PASTA troca a raiz (o disco do servidor). */
function configDoEcontador(doc, ambiente) {
  const d = doc && typeof doc === 'object' ? doc : {};
  const p = d.pasta && typeof d.pasta === 'object' ? d.pasta : {};
  const a = d.api && typeof d.api === 'object' ? d.api : {};
  const raiz = texto(ambiente && ambiente.ECONTADOR_PASTA) || texto(p.raiz);
  return {
    pasta: { ligado: sim(p.ligado), raiz, porCliente: sim(p.porCliente), semEmail: sim(p.ligado) && sim(p.semEmail) },
    api: { ligado: sim(a.ligado) },
  };
}

/** "eContador", "econtador", "E-Contador" -> true */
function ehEcontador(entrega) {
  return String(entrega || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '') === 'econtador';
}

/**
 * empresas/dp.ts (as LINHAS da planilha do DP) -> Map(código -> entrega). Lido do arquivo, sem copiar (como o
 * lerDpDoCore da Área do Cliente): [código, nome, enquadramento, responsável, movimento, REINF, obrigações, entrega, agrupamento].
 */
function entregasDoDpDoCore(conteudo) {
  const m = new Map();
  const ini = String(conteudo || '').indexOf('const LINHAS');
  if (ini < 0) return m;
  const fim = conteudo.indexOf('\n];', ini);
  for (const linha of conteudo.slice(ini, fim < 0 ? undefined : fim).split('\n')) {
    const t = linha.trim().replace(/,$/, '');
    if (!/^\[\d+,/.test(t)) continue;
    let l;
    try { l = JSON.parse(t); } catch (e) { continue; }
    m.set(Number(l[0]), String(l[7] || ''));
  }
  return m;
}

/**
 * A entrega do DP que vale na competência (o mesmo de clienteDoDpNoCadastro + parametrosDoDpNaCompetencia do core): a do
 * Cadastro do nads (dp.entrega e, por cima, dp.porCompetencia[AAAA-MM].entrega de cada competência até a pedida, em ordem);
 * sem ela, a da planilha. cadastros: os documentos cadastro/* do código (o primeiro que disser a entrega vale).
 */
function entregaQueVale(daPlanilha, cadastros, competencia) {
  for (const c of cadastros || []) {
    const dp = c && c.dp && typeof c.dp === 'object' ? c.dp : null;
    if (!dp) continue;
    let entrega = texto(dp.entrega);
    const por = dp.porCompetencia && typeof dp.porCompetencia === 'object' ? dp.porCompetencia : null;
    if (por && competencia) {
      for (const k of Object.keys(por).filter(k => k <= competencia).sort()) {
        const e = por[k] && texto(por[k].entrega);
        if (e) entrega = e;
      }
    }
    if (entrega) return entrega;
  }
  return String(daPlanilha || '');
}

/** O que fazer com o envio do DP: { pasta, semEmail } (o cliente precisa receber pelo eContador e a pasta estar ligada). */
function decisao(cfg, entrega) {
  if (!cfg || !cfg.pasta || !cfg.pasta.ligado || !ehEcontador(entrega)) return DESLIGADO;
  return { pasta: true, semEmail: !!cfg.pasta.semEmail };
}

/** O UpDocs só lê PDF (a ajuda: os layouts "em formato .PDF"); o resto fica de fora da pasta. */
function ehPdf(nome) {
  return /\.pdf$/i.test(String(nome || '').trim());
}

/**
 * Os arquivos do envio, com o nome na pasta: "<código> - <documento MM-AAAA> - <CLIENTE>.pdf" (o nome do e-mail do DP,
 * nomesNoEmail, com o código na frente: dois clientes de nome parecido não se misturam na mesma pasta). arquivos:
 * [{ driveId, nome, rotulo?, tipo?, tributo?, pasta? }] -> [{ driveId, nome, destino }] (só os PDF e com id no Drive).
 */
function arquivosDaSaida(arquivos, { codigo, competencia, empresa }) {
  const vao = (arquivos || []).filter(a => a && texto(a.driveId) && ehPdf(a.nome));
  const nomes = require('./envios-do-dp').nomesNoEmail(vao, competencia, empresa);
  return vao.map((a, k) => ({ driveId: texto(a.driveId), nome: String(a.nome), destino: semProibidos(codigo + ' - ' + nomes[k].nome).slice(0, 180) }));
}
const semProibidos = t => String(t || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();

/** A pasta do arquivo dentro da raiz: a própria raiz, ou "<código> - <CLIENTE>" com porCliente. */
function pastaDoArquivo(raiz, { codigo, empresa }, porCliente) {
  if (!porCliente) return raiz;
  return path.join(raiz, semProibidos(codigo + ' - ' + (empresa || '')).replace(/[ .-]+$/, '').slice(0, 120));
}

// ---------- a gravação na pasta (o servidor) ----------

/**
 * Grava o arquivo na pasta sem sobrescrever: o mesmo conteúdo já lá -> jaEstava; outro com o mesmo nome -> " (2)".
 * Escreve em "<nome>.parcial" e renomeia no fim, para o UpDocs nunca ver o PDF pela metade. Devolve { caminho, jaEstava }.
 */
async function gravarSemSobrescrever(pasta, nome, buffer, fsp = fs.promises) {
  await fsp.mkdir(pasta, { recursive: true });
  const ext = path.extname(nome);
  const base = nome.slice(0, nome.length - ext.length);
  let destino = path.join(pasta, nome);
  for (let n = 2; ; n++) {
    let atual = null;
    try { atual = await fsp.readFile(destino); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (!atual) break;
    if (Buffer.compare(atual, buffer) === 0) return { caminho: destino, jaEstava: true };
    destino = path.join(pasta, base + ' (' + n + ')' + ext);
  }
  const parcial = destino + '.parcial';
  await fsp.writeFile(parcial, buffer);
  await fsp.rename(parcial, destino);
  return { caminho: destino, jaEstava: false };
}

/**
 * Grava os arquivos de um pedido da fila. deps: { baixar(driveId) -> Buffer, raiz, porCliente, fsp }.
 * Devolve { gravados: [{ nome, caminho, jaEstava }], erros: [{ nome, erro }] }.
 */
async function gravarPedido(pedido, deps) {
  const raiz = texto(deps.raiz);
  if (!raiz) throw new Error('a pasta do eContador não foi configurada (config/econtador.pasta.raiz ou ECONTADOR_PASTA)');
  const fsp = deps.fsp || fs.promises;
  // a raiz é a que o UpDocs vigia: tem de existir (não criamos pasta em disco errado)
  try { if (!(await fsp.stat(raiz)).isDirectory()) throw new Error('não é pasta'); } catch (e) { throw new Error('a pasta do eContador não existe neste computador: ' + raiz); }
  const pasta = pastaDoArquivo(raiz, pedido, deps.porCliente);
  const gravados = [];
  const erros = [];
  for (const a of pedido.arquivos || []) {
    try {
      const buffer = await deps.baixar(a.driveId);
      if (!buffer || !buffer.length) throw new Error('o arquivo veio vazio do Drive');
      const r = await gravarSemSobrescrever(pasta, a.destino || a.nome, buffer, fsp);
      gravados.push({ nome: path.basename(r.caminho), caminho: r.caminho, jaEstava: r.jaEstava });
    } catch (err) { erros.push({ nome: a.destino || a.nome, erro: String(err.message || err).slice(0, 200) }); }
  }
  return { gravados, erros };
}

// ---------- o banco (a nuvem e o servidor) ----------

let configEmCache = null;
/** config/econtador, lido no máximo a cada 5 minutos. */
async function configDoBanco(db, ambiente = process.env) {
  if (configEmCache && Date.now() - configEmCache.em < CONFIG_VALE_MS) return configEmCache.cfg;
  const doc = (await db.collection('config').doc(CONFIG).get()).data() || null;
  const cfg = configDoEcontador(doc, ambiente);
  configEmCache = { em: Date.now(), cfg };
  return cfg;
}

let planilha = null;
function entregaDaPlanilha(codigo) {
  if (!planilha) {
    try { planilha = entregasDoDpDoCore(fs.readFileSync(path.join(__dirname, '..', 'packages', 'core', 'src', 'empresas', 'dp.ts'), 'utf8')); } catch (e) { planilha = new Map(); }
  }
  return planilha.get(Number(codigo)) || '';
}

/**
 * O envio do DP deste cliente vai para a pasta do eContador? { pasta, semEmail }. Nunca derruba o envio: se não der para
 * ler a configuração ou o cadastro, fica DESLIGADO (o e-mail sai como sempre).
 */
async function decisaoDoDp(db, codigo, competencia) {
  try {
    const cfg = await configDoBanco(db);
    if (!cfg.pasta.ligado) return DESLIGADO;
    const cadastros = (await db.collection('cadastro').where('codigo', '==', Number(codigo)).limit(3).get()).docs.map(d => d.data());
    return decisao(cfg, entregaQueVale(entregaDaPlanilha(codigo), cadastros, competencia));
  } catch (e) { return DESLIGADO; }
}

/** A via eContador do Fiscal (a tela já escolheu): só a pasta ligada importa. Nunca derruba o envio. */
async function pastaLigada(db) {
  try { return (await configDoBanco(db)).pasta.ligado; } catch (e) { return false; }
}

/**
 * Põe o envio na fila da pasta e liga o registro a ela (solicitacoesEmail/{registro}.econtadorSaida). Devolve o id da
 * fila, ou '' quando não havia PDF com id no Drive (nada a gravar).
 */
async function anotarSaida(db, { origem, codigo, competencia, empresa, registro, arquivos }) {
  const vao = arquivosDaSaida(arquivos, { codigo, competencia, empresa });
  if (!vao.length) return '';
  const agora = new Date().toISOString();
  const ref = await db.collection(COLECAO).add({
    status: 'pendente', origem: String(origem || ''), codigo: String(codigo), competencia: String(competencia || ''),
    empresa: String(empresa || ''), registro: String(registro || ''), arquivos: vao, tentativas: 0, criadoEm: agora,
  });
  if (registro) await db.collection('solicitacoesEmail').doc(String(registro)).set({ econtadorSaida: ref.id }, { merge: true }).catch(() => {});
  return ref.id;
}

/** O nome do cliente ativo (clientes-cache) pelo código; '' se não achar. */
function nomeDoAtivo(ativos, codigo) {
  let achado = null;
  if (ativos && typeof ativos.forEach === 'function') ativos.forEach(d => { if (!achado && String(d.data().codigoOrigem || '').trim() === String(codigo)) achado = d.data(); });
  return achado ? String(achado.nome || '').trim() : '';
}

// ---------- o servidor: a fila -> a pasta ----------

/** Baixa do Drive pelo id (só leitura). */
function baixadorDoDrive(getDrive) {
  return async driveId => {
    const r = await getDrive().files.get({ fileId: driveId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer', timeout: 120000 });
    return Buffer.from(r.data);
  };
}

/** Atende um pedido da fila. deps: { baixar, log, ambiente, fsp }. */
async function atenderPedido(db, ref, pedido, deps) {
  const cfg = await configDoBanco(db, deps.ambiente || process.env);
  if (!cfg.pasta.ligado) return 'desligado';
  const agora = () => new Date().toISOString();
  try {
    const { gravados, erros } = await gravarPedido(pedido, { baixar: deps.baixar, raiz: cfg.pasta.raiz, porCliente: cfg.pasta.porCliente, fsp: deps.fsp });
    if (!gravados.length) throw new Error(erros.map(e => e.nome + ': ' + e.erro).join('; ') || 'nenhum arquivo gravado');
    const em = agora();
    await ref.update({ status: 'gravado', gravadoEm: em, gravados, erros });
    if (pedido.registro) {
      await db.collection('solicitacoesEmail').doc(String(pedido.registro)).set({
        econtador: { status: 'pasta', em, arquivos: gravados.map(g => g.nome), ...(erros.length ? { faltaram: erros.map(e => e.nome) } : {}) },
      }, { merge: true }).catch(() => {});
    }
    deps.log('eContador: ' + gravados.length + ' arquivo(s) de ' + pedido.codigo + ' ' + (pedido.empresa || '') + ' (' + pedido.competencia + ') na pasta do UpDocs' + (erros.length ? ', ' + erros.length + ' com erro' : ''));
    return 'gravado';
  } catch (err) {
    const tentativas = Number(pedido.tentativas || 0) + 1;
    const erro = String(err.message || err).slice(0, 300);
    await ref.update({ status: tentativas >= MAX_TENTATIVAS ? 'erro' : 'pendente', tentativas, erro, erroEm: agora() }).catch(() => {});
    if (tentativas >= MAX_TENTATIVAS && pedido.registro) {
      await db.collection('solicitacoesEmail').doc(String(pedido.registro)).set({ econtador: { status: 'erro', em: agora(), erro } }, { merge: true }).catch(() => {});
    }
    deps.log('eContador: o envio de ' + pedido.codigo + ' para a pasta deu erro (' + tentativas + '/' + MAX_TENTATIVAS + '): ' + erro);
    return 'erro';
  }
}

/**
 * Liga a fila no NILMA-SERVER (onde o UpDocs enxerga a pasta). deps: { getDrive, log }. Com a pasta desligada, não faz
 * nada (o pedido fica pendente até ligar). Confere a fila a cada 2 minutos (os erros que ainda têm tentativa).
 */
function iniciarPastaEcontador(db, deps) {
  const log = deps.log || console.log;
  const baixar = deps.baixar || baixadorDoDrive(deps.getDrive);
  let ocupado = false;
  let deNovo = false;
  let avisouDesligado = false;
  async function atender() {
    if (ocupado) { deNovo = true; return; }
    ocupado = true;
    try {
      do {
        deNovo = false;
        const snap = await db.collection(COLECAO).where('status', '==', 'pendente').limit(50).get();
        for (const doc of snap.docs.sort((a, b) => String(a.get('criadoEm')).localeCompare(String(b.get('criadoEm'))))) {
          const r = await atenderPedido(db, doc.ref, doc.data(), { baixar, log });
          if (r === 'desligado') {
            if (!avisouDesligado) log('eContador: a pasta está desligada (config/econtador.pasta.ligado); ' + snap.size + ' envio(s) esperando');
            avisouDesligado = true;
            break;
          }
          avisouDesligado = false;
        }
      } while (deNovo);
    } catch (err) { log('eContador: não li a fila:', err.message); } finally { ocupado = false; }
  }
  const { ouvir } = require('./ouvinte');
  const parar = ouvir('Pasta do eContador', () => db.collection(COLECAO).where('status', '==', 'pendente'), () => { void atender(); }, log);
  const vez = setInterval(() => { void atender(); }, 2 * 60 * 1000);
  log('eContador: a pasta do UpDocs ligada (fila ' + COLECAO + ')');
  return () => { clearInterval(vez); parar(); };
}

// Sozinho, no servidor: `node econtador.js` (o que o satélite chamaria; o Firestore e o Drive com as credenciais do robô)
if (require.main === module) {
  const db = require('./firestore-client').getDb('entregas-2e5e2');
  iniciarPastaEcontador(db, { getDrive: () => require('./drive-indice').getDrive(), log: (...m) => console.log(new Date().toISOString(), ...m) });
}

module.exports = {
  // a nuvem
  decisaoDoDp, pastaLigada, anotarSaida, nomeDoAtivo, configDoBanco,
  // o servidor
  iniciarPastaEcontador, atenderPedido, gravarPedido, gravarSemSobrescrever, baixadorDoDrive,
  // puras, pro teste
  configDoEcontador, ehEcontador, entregasDoDpDoCore, entregaQueVale, decisao, ehPdf, arquivosDaSaida, pastaDoArquivo,
  DESLIGADO, COLECAO, CONFIG, MAX_TENTATIVAS,
  _limparCache: () => { configEmCache = null; planilha = null; },
};
