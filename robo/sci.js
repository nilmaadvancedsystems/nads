'use strict';
// As APIs da SCI no robô (24/11/2026; o dono: "monta o nads para suportar completamente a integracao do sci mesmo que nao
// vamos usar por agora"). TUDO DESLIGADO até alguém ligar em Configurações › Integração SCI (config/sci). Três peças:
//
//   1. publicarGuias   — o lote do Fiscal (lote-fiscal.js, robô da nuvem): a via "SCI Report" publica cada guia na
//                        empresa (SCI Report 24h, publicação manual, BETA na SCI). Sem a chave, a via segue como antes
//                        (só o Relatório e o Drive).
//   2. enviarAoIntegra — o SIEG (sieg.js, robô do PC): depois de cada "Baixar XMLs", manda as notas do mês ao Integra NET
//                        e confere o mês (o que falta no SCI); o resumo vai em siegNotas/{codigo}_{AAAA-MM}.sci.
//   3. iniciarLeituraDeVolta — robô da nuvem, de hora em hora no horário comercial: das guias publicadas, se o cliente viu
//                        e se informou o pagamento (solicitacoesEmail.sciReport).
//
// A regra é toda do core (robo/gerado/sci.js, de packages/core/src/sci/integracao, testada lá). Os tokens NUNCA ficam no
// git nem no banco: variáveis SCI_TOKEN_PARCEIRO e SCI_TOKEN_CLIENTE, ou os metadados segredo-sci-parceiro e
// segredo-sci-cliente da VM, ou o arquivo robo/sci_credenciais.json do PC ({ "parceiro": "...", "cliente": "..." }, fora do git).
const fs = require('fs');
const path = require('path');
const S = require('./gerado/sci');

const META = 'http://metadata.google.internal/computeMetadata/v1/instance/attributes/';
const ARQUIVO = path.join(__dirname, 'sci_credenciais.json');
// o robô só fala com a SCI; o PUT do Integra NET vai para a URL pré-assinada da AWS que a própria SCI devolve
const ENDERECOS_DA_SCI = ['https://api-auth.sci.com.br/', 'https://api-relatorio.sci.com.br/', 'https://api-integranet.sci.com.br/'];
const S3_DA_SCI = /^https:\/\/[a-z0-9.-]+\.s3[a-z0-9.-]*\.amazonaws\.com\//;
const CONFIG_MS = 60 * 1000;
const SEGREDOS_MS = 10 * 60 * 1000;
const HORA = 3600 * 1000;
// as guias publicadas há mais que isto param de ser perguntadas (o cliente não vai mais informar o pagamento)
const LER_DE_VOLTA_DIAS = 90;

// ---------- o caminho até a SCI ----------

async function lerMetadado(nome) {
  try {
    const r = await fetch(META + encodeURIComponent(nome), { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(3000) });
    return r.ok ? (await r.text()).trim() : '';
  } catch (e) { return ''; }
}

let segredosGuardados = null;
/** Os dois tokens: a variável, senão o metadado da VM, senão o arquivo do PC. Vazios quando não há (tudo fica parado). */
async function segredos() {
  if (segredosGuardados && Date.now() - segredosGuardados.em < SEGREDOS_MS) return segredosGuardados.valor;
  let parceiro = String(process.env.SCI_TOKEN_PARCEIRO || '').trim();
  let cliente = String(process.env.SCI_TOKEN_CLIENTE || '').trim();
  if (!parceiro || !cliente) { parceiro = await lerMetadado('segredo-sci-parceiro'); cliente = await lerMetadado('segredo-sci-cliente'); }
  if (!parceiro || !cliente) {
    try { const j = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')); parceiro = String(j.parceiro || '').trim(); cliente = String(j.cliente || '').trim(); } catch (e) { /* sem arquivo */ }
  }
  const valor = { parceiro, cliente };
  segredosGuardados = { em: Date.now(), valor };
  return valor;
}

/** O fetch do robô para a SCI: só os endereços da SCI (e o PUT na URL da AWS que ela devolve). */
function buscar(url, init) {
  const daSci = ENDERECOS_DA_SCI.some(e => url.startsWith(e));
  const doS3 = init.method === 'PUT' && S3_DA_SCI.test(url);
  if (!daSci && !doS3) return Promise.reject(new Error('endereço fora da SCI'));
  return fetch(url, { method: init.method, headers: init.headers, body: init.body, signal: AbortSignal.timeout(60000) });
}

let report = null;
let integra = null;
const clienteReport = () => (report ||= S.criarClienteSciReport({ buscar, segredos }));
const clienteIntegra = () => (integra ||= S.criarClienteIntegraNet({ buscar, segredos }));

let configGuardada = null;
/** config/sci como vale (desligada se não der para ler). */
async function config(db) {
  if (configGuardada && Date.now() - configGuardada.em < CONFIG_MS) return configGuardada.valor;
  let valor = S.CONFIG_DO_SCI_DESLIGADA;
  try { valor = S.configDoSci((await db.collection('config').doc('sci').get()).data() || null); } catch (e) { /* desligada */ }
  configGuardada = { em: Date.now(), valor };
  return valor;
}

const motivo = err => String((err && err.message) || err || '').slice(0, 200);

// ---------- 1. as guias do lote do Fiscal no SCI Report ----------

/**
 * Publica as guias de um cliente no SCI Report. null = desligado para esta empresa (a via segue como antes). Nunca joga erro:
 * o que deu errado volta em `erro` (tudo) ou em `falhas` (guia a guia).
 * guias: [{ nome, tipo, tributo, valor (número), vencimento ('dd/mm/aaaa'), competencia ('aaaa-mm'), pdf (Buffer) }]
 */
async function publicarGuias(db, { codigo, cnpj, guias }) {
  const cfg = await config(db);
  if (!cfg.publicarGuias || !S.empresaNoSci(cfg, codigo)) return null;
  const r = { empresaId: 0, publicadas: [], falhas: [], erro: '' };
  try {
    const sci = clienteReport();
    r.empresaId = (await sci.empresaPeloDocumento(String(cnpj || ''))) || 0;
    const competencias = [...new Set(guias.map(g => g.competencia).filter(Boolean))].sort();
    const jaNoSci = r.empresaId && competencias.length ? await sci.publicacoes(r.empresaId, competencias[0], competencias[competencias.length - 1]) : [];
    for (const g of guias) {
      const descricao = [g.tipo === 'OUTRO' ? '' : g.tipo, g.tributo].filter(Boolean).join(' ') || g.nome;
      const guia = { competencia: g.competencia, vencimento: g.vencimento, valor: Number(g.valor) || 0, descricao };
      const relatorioId = S.relatorioDaGuia(cfg, g.tipo, g.tributo);
      const erro = S.erroDaGuiaParaPublicar(guia, relatorioId, r.empresaId || null, g.pdf ? g.pdf.length : 0);
      if (erro) { r.falhas.push({ nome: g.nome, erro }); continue; }
      try {
        const antes = S.jaPublicada(jaNoSci, guia, relatorioId);
        const publicadosId = antes ? antes.publicadosId : await sci.publicar(S.camposDaPublicacao(guia, relatorioId, r.empresaId), new Uint8Array(g.pdf), g.nome);
        r.publicadas.push({ publicadosId, nome: descricao, vistoEm: '', pagamentoEm: '' });
      } catch (err) { r.falhas.push({ nome: g.nome, erro: motivo(err) }); }
    }
  } catch (err) { r.erro = motivo(err); }
  return r;
}

// ---------- 2. os XMLs do SIEG no Integra NET ----------

// o que já foi para o Integra NET, por empresa e mês (arquivo local do PC: o SIEG baixa o mês inteiro de novo a cada pedido)
const ARQUIVO_ENVIADOS = path.join(require('./pastas-locais').ROBO, 'sci-integra-enviados.json');
function lerEnviados() { try { return JSON.parse(fs.readFileSync(ARQUIVO_ENVIADOS, 'utf8')) || {}; } catch (e) { return {}; } }
function gravarEnviados(todos) {
  try { fs.mkdirSync(path.dirname(ARQUIVO_ENVIADOS), { recursive: true }); fs.writeFileSync(ARQUIVO_ENVIADOS + '.tmp', JSON.stringify(todos)); fs.renameSync(ARQUIVO_ENVIADOS + '.tmp', ARQUIVO_ENVIADOS); } catch (e) { /* tenta da próxima */ }
}

/**
 * Manda ao Integra NET os XMLs do mês que ainda não foram e confere o mês. null = desligado para esta empresa. Nunca joga
 * erro. arquivos: [{ nome, xml }] (os do "Baixar XMLs"); canceladas: chaves canceladas no mês.
 */
async function enviarAoIntegra({ db, id, codigo, cnpj, competencia, arquivos, canceladas = [], log = () => {} }) {
  const cfg = await config(db);
  if (!(cfg.enviarXmls || cfg.conferirXmls) || !S.empresaNoSci(cfg, codigo)) return null;
  let enviadas = 0;
  let falhas = 0;
  let erro = '';
  let conferencia = null;
  try {
    if (cfg.enviarXmls) {
      const todos = lerEnviados();
      const ja = new Set(todos[id] || []);
      const { lotes } = S.xmlsParaEnviar(arquivos, ja);
      if (lotes.length) {
        const r = await clienteIntegra().enviar(cnpj, lotes);
        r.enviadas.forEach(m => ja.add(m));
        todos[id] = [...ja];
        gravarEnviados(todos);
        enviadas = r.enviadas.length;
        falhas = r.falhas;
        erro = r.erro;
      }
    }
    if (cfg.conferirXmls) {
      const empresaId = await clienteReport().empresaPeloDocumento(String(cnpj || ''));
      if (!empresaId) erro = erro || 'a empresa não foi achada no SCI pelo CNPJ (a conferência ficou para depois)';
      else {
        const doSieg = arquivos.filter(a => !S.ehEventoDoXml(a.xml)).map(a => S.chaveDoXml(a.xml)).filter(Boolean);
        const tipos = [...new Set(arquivos.map(a => S.tipoNoIntegra(a.xml)).filter(t => t && t !== 'nfse'))];
        const doSci = [];
        for (const tipo of tipos) for (const mov of ['entrada', 'saida']) doSci.push(...await clienteIntegra().chavesDoMes(empresaId, tipo, mov, competencia));
        conferencia = S.conferirComOSci(doSieg, doSci, canceladas);
      }
    }
  } catch (err) { erro = motivo(err); }
  const resumo = S.resumoDoIntegra({ agora: new Date(), enviadas, falhas, erro, conferencia });
  await db.collection('siegNotas').doc(id).update({ sci: resumo }).catch(err => log('SCI: não consegui gravar o resumo do Integra NET em', id, '-', motivo(err)));
  log('SCI: Integra NET de', id, '-', S.fraseDoIntegra(resumo) + (erro ? ' (' + erro + ')' : ''));
  return resumo;
}

// ---------- 3. o que o cliente fez com as guias publicadas ----------

/** Uma passada: as publicações pendentes, agrupadas por empresa, uma busca por empresa; grava só o que mudou. */
async function lerDeVoltaUmaVez(db, log = () => {}) {
  const cfg = await config(db);
  if (!cfg.lerDeVolta) return 0;
  const snap = await db.collection('solicitacoesEmail').where('sciReport.pendente', '==', true).limit(300).get();
  const porEmpresa = new Map();
  for (const d of snap.docs) {
    const s = d.get('sciReport') || {};
    const empresaId = Number(s.empresaId) || 0;
    if (!empresaId) continue;
    if (!porEmpresa.has(empresaId)) porEmpresa.set(empresaId, []);
    porEmpresa.get(empresaId).push(d);
  }
  let gravados = 0;
  const limite = Date.now() - LER_DE_VOLTA_DIAS * 24 * HORA;
  for (const [empresaId, docs] of porEmpresa) {
    try {
      const comps = docs.map(d => String(d.get('competencia') || '')).filter(c => /^\d{4}-\d{2}$/.test(c)).sort();
      if (!comps.length) continue;
      const daSci = await clienteReport().publicacoes(empresaId, comps[0], comps[comps.length - 1]);
      for (const d of docs) {
        const { publicadas, mudou, terminou } = S.situacaoDeVolta(S.publicadasDoRegistro(d.get('sciReport.publicadas')), daSci);
        const velho = Date.parse(String(d.get('enviadoEm') || '')) < limite;
        if (!mudou && !terminou && !velho) continue;
        await d.ref.update({ 'sciReport.publicadas': publicadas, 'sciReport.pendente': !terminou && !velho, 'sciReport.lidoEm': new Date().toISOString() });
        gravados++;
      }
    } catch (err) { log('SCI: não consegui ler de volta as guias da empresa', empresaId, 'no SCI Report -', motivo(err)); }
  }
  if (gravados) log('SCI: o SCI Report mudou', gravados, 'envio(s) de guias (visto ou pagamento informado)');
  return gravados;
}

/** De hora em hora, das 8h às 20h de Brasília. Desligado em config/sci, só lê a configuração (1 leitura por hora). */
function iniciarLeituraDeVolta(db, log = () => {}) {
  const horaEmBrasilia = () => Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
  const rodar = () => {
    const h = horaEmBrasilia();
    if (h < 8 || h > 20) return;
    lerDeVoltaUmaVez(db, log).catch(err => log('SCI: a leitura de volta do SCI Report deu erro -', motivo(err)));
  };
  setInterval(rodar, HORA);
  log('SCI: leitura de volta do SCI Report ligada (só age com config/sci.lerDeVolta)');
}

module.exports = { publicarGuias, enviarAoIntegra, lerDeVoltaUmaVez, iniciarLeituraDeVolta, config, segredos, buscar, ENDERECOS_DA_SCI };
