// Arquivador: o pedaço do robô que fica NESTE PC.
//
// O robô do Gmail foi pra nuvem, mas o arquivamento não pode ir junto: ele é a
// rotina "Claudio Secretario" (/organizar), que roda pelo Claude instalado
// aqui e move arquivos no G:. Este programa faz duas coisas, e só elas:
//
// 1. Atende o botão "Arquivar agora" do Pendências. O app grava o pedido em
//    solicitacoesArquivo; aqui ele vira a mesma execução que a tarefa
//    agendada das 9h faz (/organizar PRODUCAO na pasta da rotina), sem
//    ninguém aprovar passo a passo — decisão do escritório em 24/09/2026.
//
// 2. Publica no banco o que foi arquivado, lendo o manifesto e os relatórios
//    da rotina (arquivo-manifesto.js). Isso vale pra toda execução, inclusive
//    a das 9h: a aba Arquivo mostra tudo, venha de onde vier.
//
// O que ele NÃO faz: não altera nada no repositório da rotina (GUSTAVO\claudio)
// nem nas regras dela. Só lê _CONTROLE\ e chama o comando que já existe.
//
// Duas execuções ao mesmo tempo moveriam os mesmos arquivos e bagunçariam as
// pastas dos clientes. Por isso, antes de começar, o pedido espera se:
//   - a rotina deu sinal de vida nos últimos minutos (arquivo novo em
//     _CONTROLE), o que quer dizer que outra execução está rodando; ou
//   - é o horário da execução das 9h e ela ainda não terminou hoje.
//
// Uso: node arquivador.js     (fica rodando; o iniciar-arquivador.cmd liga no boot)
require('./fuso.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { getDb } = require('./firestore-client');
const { ouvir } = require('./ouvinte');
const man = require('./arquivo-manifesto');

const RAIZ = process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio';
const CONTROLE = path.join(RAIZ, '_CONTROLE');
const CLAUDE = process.env.CLAUDE_EXE || path.join(os.homedir(), '.local', 'bin', 'claude.exe');
// (01/10/2026: era 'G:\Meu Drive', que no JavaScript vira "G:Meu Drive" — a barra some)
const DRIVE = process.env.ARQUIVO_DRIVE || 'G:\\Meu Drive';
const MODOS = ['PRODUCAO', 'SIMULACAO'];
// Quem pensa e quem faz (pedido do escritório, 28/09/2026): o Opus 5.5
// orquestra a rotina e os subagentes que ela abre pra executar rodam no
// Sonnet 5. O Opus 5.5 pede o Claude Code 2.1.280 ou mais novo.
const MODELO_ORQUESTRADOR = process.env.ARQUIVO_MODELO || 'claude-opus-5-5';
const MODELO_EXECUTOR = process.env.ARQUIVO_MODELO_EXECUTOR || 'claude-sonnet-5';

const LIMITE_EXECUCAO_MS = 3 * 36e5;     // rotina travada não segura o PC o dia inteiro
const SINAL_DE_OUTRA_EXECUCAO_MS = 10 * 60000;
const PUBLICAR_A_CADA_MS = 10 * 60000;
const JANELA_DAS_9H = { de: [8, 30], ate: [11, 0] };  // a tarefa agendada roda às 9h (+ até 10 min de sorteio)

const log = (...m) => console.log(new Date().toLocaleString('pt-BR'), '[arquivo]', ...m);
const agora = () => new Date().toISOString();

// ---------- um arquivador só ----------
const TRAVA = path.join(__dirname, 'arquivador.lock');
try {
  const pid = parseInt(fs.readFileSync(TRAVA, 'utf8'), 10);
  if (pid && pid !== process.pid) { try { process.kill(pid, 0); log('já existe um arquivador rodando (processo ' + pid + ')'); process.exit(3); } catch (e) {} }
} catch (e) {}
fs.writeFileSync(TRAVA, String(process.pid));
process.on('exit', () => { try { if (parseInt(fs.readFileSync(TRAVA, 'utf8'), 10) === process.pid) fs.unlinkSync(TRAVA); } catch (e) {} });

const db = getDb('entregas-2e5e2');
const fila = db.collection('solicitacoesArquivo');
const estadoRef = db.collection('robo').doc('arquivador');

let estado = { situacao: 'livre', pedidoId: null, desde: agora(), mensagem: null };
function baterPonto() {
  // junto com o ponto, se a rotina está rodando por fora (a tarefa das 9h ou alguém rodando à mão): o nads mostra no
  // "Arquivar agora" do Drive (05/10/2026). Vai no mesmo ponto de cada minuto — nenhuma gravação a mais.
  let rotina = null;
  try { rotina = rotinaPorFora(); } catch (e) { /* só o aviso; o ponto segue */ }
  estadoRef.set(Object.assign({ em: agora(), pc: os.hostname(), rotina }, estado), { merge: true })
    .catch(err => log('não consegui bater o ponto:', err.message));
}
function mudarEstado(novo) { estado = Object.assign({ desde: agora(), pedidoId: null, mensagem: null }, novo); baterPonto(); }

// ---------- a rotina está rodando por fora? ----------
function maisRecenteEm(pasta, profundidade) {
  let maior = 0;
  let itens = [];
  try { itens = fs.readdirSync(pasta, { withFileTypes: true }); } catch (e) { return 0; }
  for (const it of itens) {
    const c = path.join(pasta, it.name);
    try {
      if (it.isDirectory()) { if (profundidade > 0) maior = Math.max(maior, maisRecenteEm(c, profundidade - 1)); }
      else maior = Math.max(maior, fs.statSync(c).mtimeMs);
    } catch (e) { /* arquivo sumiu no meio: segue */ }
  }
  return maior;
}

function hojeIso() { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function minutosDoDia(h, m) { return h * 60 + m; }

// A rotina rodando agora, para mostrar no nads: a trava que ela cria ao começar (_CONTROLE\_execucao.lock, com a
// execução, o início, o modo e a fase em que está — 01-ORQUESTRADOR, Fase 0) e o arquivo mais novo que ela mexeu.
// Trava sem sinal há mais de 30 min (ou com mais de 4 h, que a própria rotina trata como resíduo) não conta.
function rotinaPorFora() {
  let trava = null;
  try { trava = JSON.parse(fs.readFileSync(path.join(CONTROLE, '_execucao.lock'), 'utf8')); } catch (e) {}
  const mes = new Date().toISOString().slice(0, 7);
  const ultimoSinal = Math.max(
    maisRecenteEm(path.join(CONTROLE, 'LOGS', mes), 2),
    maisRecenteEm(path.join(CONTROLE, 'MANIFESTO'), 0),
    maisRecenteEm(path.join(CONTROLE, 'STAGING'), 2),
    maisRecenteEm(path.join(CONTROLE, '_tmp_exec'), 1),
    (() => { try { return fs.statSync(path.join(CONTROLE, '_execucao.lock')).mtimeMs; } catch (e) { return 0; } })()
  );
  const inicio = trava && Date.parse(trava.timestamp_inicio);
  const travaViva = !!trava && !!inicio && Date.now() - inicio < 4 * 36e5 && Date.now() - ultimoSinal < 30 * 60000;
  return {
    ativa: travaViva || Date.now() - ultimoSinal < SINAL_DE_OUTRA_EXECUCAO_MS,
    execucao: (travaViva && trava.id_execucao) || null,
    inicio: (travaViva && trava.timestamp_inicio) || null,
    modo: (travaViva && trava.modo) || null,
    fase: (travaViva && trava.fase_atual != null) ? String(trava.fase_atual) : null,
    ultimoSinalEm: ultimoSinal ? new Date(ultimoSinal).toISOString() : null,
    // a execução é a de um pedido do botão (o nads já mostra pelo pedido)
    deUmPedido: ocupado,
  };
}

// ---------- a conversa da rotina e o relatório do dia, para o nads ----------
// (Vitor, 05/10/2026: "quero um relatório com as mensagens de resposta do Claude") O Claude que roda a rotina neste PC
// (a tarefa das 9h, ou a execução de um pedido) guarda a conversa em ~/.claude/projects/<pasta da rotina>/<sessão>.jsonl.
// A cada minuto, se a conversa mais recente ou o RELATORIO-<dia>.txt mudaram, publica em robo/arquivadorConversa as
// últimas mensagens de texto (as do Claude e as suas; sem as ferramentas) e o relatório. Só lê; grava só quando muda.
const PASTA_CONVERSAS = path.join(os.homedir(), '.claude', 'projects', RAIZ.replace(/[^A-Za-z0-9]/g, '-'));
const conversaRef = db.collection('robo').doc('arquivadorConversa');
let assinaturaConversa = '';

function lerFim(arquivo, bytes) {
  const fd = fs.openSync(arquivo, 'r');
  try {
    const tam = fs.fstatSync(fd).size;
    const n = Math.min(bytes, tam);
    const b = Buffer.alloc(n);
    fs.readSync(fd, b, 0, n, tam - n);
    const s = b.toString('utf8');
    return n < tam ? s.slice(s.indexOf('\n') + 1) : s;   // a primeira linha pode ter vindo pela metade
  } finally { fs.closeSync(fd); }
}

function lerConversaDaRotina() {
  let maisNova = null;
  try {
    for (const nome of fs.readdirSync(PASTA_CONVERSAS)) {
      if (!nome.endsWith('.jsonl')) continue;
      const st = fs.statSync(path.join(PASTA_CONVERSAS, nome));
      if (!maisNova || st.mtimeMs > maisNova.mtime) maisNova = { nome, mtime: st.mtimeMs };
    }
  } catch (e) { return null; }
  if (!maisNova) return null;
  const mensagens = [];
  // os agentes que a rotina despacha (separador, classificador…): as etapas que o nads mostra e a % do lote. Cada um nasce
  // num tool_use "Agent" (com a descrição) e termina num <task-notification> com o mesmo tool-use-id e o status.
  const agentes = new Map();
  for (const linha of lerFim(path.join(PASTA_CONVERSAS, maisNova.nome), 1500 * 1024).split('\n')) {
    let o; try { o = JSON.parse(linha); } catch (e) { continue; }
    const m = o.message || {};
    if (o.type === 'assistant' && Array.isArray(m.content)) {
      const texto = m.content.filter(c => c && c.type === 'text').map(c => c.text).join('\n').trim();
      if (texto) mensagens.push({ em: o.timestamp || '', quem: 'claude', texto: texto.slice(0, 3000) });
      for (const c of m.content) {
        if (c && c.type === 'tool_use' && c.name === 'Agent' && c.input) {
          agentes.set(c.id, { id: c.id, descricao: String(c.input.description || 'Agente').slice(0, 80), tipo: String(c.input.subagent_type || ''), em: o.timestamp || '', status: 'rodando' });
        }
      }
    } else if (o.type === 'user' && typeof m.content === 'string') {
      if (/^\s*<task-notification/.test(m.content)) {
        const id = (/<tool-use-id>([^<]+)<\/tool-use-id>/.exec(m.content) || [])[1];
        const st = (/<status>([^<]+)<\/status>/.exec(m.content) || [])[1] || '';
        const a = id && agentes.get(id);
        if (a) a.status = st === 'completed' ? 'concluido' : st === 'killed' || st === 'failed' ? 'erro' : a.status;
      } else if (!/^\s*<(command-|local-command)/.test(m.content)) {
        mensagens.push({ em: o.timestamp || '', quem: 'voce', texto: m.content.trim().slice(0, 1000) });
      }
    }
  }
  return {
    sessao: maisNova.nome.replace(/\.jsonl$/, ''), atualizadaEm: new Date(maisNova.mtime).toISOString(), mensagens: mensagens.slice(-40),
    agentes: Array.from(agentes.values()).slice(-30),
  };
}

function lerRelatorioDoDia() {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const nome = 'RELATORIO-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + dia + '.txt';
  const arq = path.join(CONTROLE, 'LOGS', mes, dia, nome);
  try {
    const st = fs.statSync(arq);
    const texto = fs.readFileSync(arq, 'utf8');
    return { arquivo: nome, em: new Date(st.mtimeMs).toISOString(), texto: texto.length > 30000 ? texto.slice(0, 30000) + '\n\n[relatório cortado aqui]' : texto };
  } catch (e) { return null; }
}

async function publicarConversa() {
  let conversa = null, relatorio = null;
  try { conversa = lerConversaDaRotina(); } catch (e) { /* segue com o relatório */ }
  try { relatorio = lerRelatorioDoDia(); } catch (e) { /* segue com a conversa */ }
  const assinatura = (conversa ? conversa.sessao + ':' + conversa.atualizadaEm + ':' + conversa.mensagens.length + ':' + conversa.agentes.map(a => a.status[0]).join('') : '-') + '|' + (relatorio ? relatorio.em : '-');
  if (assinatura === assinaturaConversa) return;
  try {
    await conversaRef.set({
      em: agora(),
      sessao: conversa ? conversa.sessao : null,
      atualizadaEm: conversa ? conversa.atualizadaEm : null,
      mensagens: conversa ? conversa.mensagens : [],
      agentes: conversa ? conversa.agentes : [],
      relatorio,
    });
    assinaturaConversa = assinatura;
  } catch (err) { log('não consegui publicar a conversa da rotina:', err.message); }
}

// ---------- parar a organização pelo nads ----------
// (09/10/2026: "quero que coloque um botão de cancelar a organização") Quem pode pedir o arquivamento pede para parar
// (arquivadorParar). Aqui: acha os Claude deste PC que estão rodando o /organizar (o do botão e o das 9h) e encerra
// cada um com tudo o que ele abriu (taskkill /T). O pedido do botão que estava rodando vira "cancelado", não "erro".
const pedidosParar = db.collection('arquivadorParar');
let paradaPedida = null;   // { por } quando o nads mandou parar a organização do botão

function processosDaOrganizacao() {
  try {
    const saida = execFileSync('powershell', ['-NoProfile', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='claude.exe'\" | Where-Object { $_.CommandLine -match '/organizar' } | ForEach-Object { $_.ProcessId }"],
    { encoding: 'utf8', windowsHide: true });
    return saida.split(/\s+/).map(Number).filter(n => n > 0);
  } catch (e) { log('parar: não consegui listar os processos:', e.message); return []; }
}

async function atenderParar(doc) {
  const p = doc.data();
  if (ocupado) paradaPedida = { por: p.criadoPor || '' };
  const pids = processosDaOrganizacao();
  let parados = 0;
  for (const pid of pids) {
    try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); parados++; }
    catch (e) { /* já tinha terminado */ }
  }
  log('parar a organização (' + (p.criadoPor || '?') + '):', parados ? parados + ' processo(s) encerrado(s)' : 'nada rodando');
  if (!parados) paradaPedida = null;
  await doc.ref.update({ status: parados ? 'feito' : 'nada', parados, fimEm: agora() }).catch(() => {});
}

// ---------- escrever para o Claude da rotina pelo nads ----------
// (07/10/2026: "coloque para eu conversar com o claude aqui") O admin escreve na janela do Arquivador (Drive) e a mensagem
// chega em arquivadorMensagens. Aqui, uma por vez: com a rotina parada, retoma a sessão da conversa (claude --resume
// <sessão> -p "<mensagem>", com as mesmas permissões e pasta da rotina); a resposta entra no arquivo da conversa e sobe
// para o nads pela publicação de sempre (publicarConversa). Com a rotina rodando (o botão ou a das 9h), espera ela
// terminar: duas execuções na mesma conversa se atropelariam.
const mensagensRef = db.collection('arquivadorMensagens');
let respondendo = false;
const SESSAO_VALIDA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responderNaSessao(sessao, texto) {
  return new Promise(resolve => {
    const env = Object.assign(ambienteLimpo(), { CLAUDE_CODE_SUBAGENT_MODEL: MODELO_EXECUTOR });
    const filho = spawn(CLAUDE, ['--resume', sessao, '-p', texto, '--model', MODELO_ORQUESTRADOR, '--permission-mode', 'bypassPermissions',
      '--add-dir', DRIVE, '--output-format', 'json'], { cwd: RAIZ, windowsHide: true, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = '', erros = '';
    filho.stdout.on('data', b => { saida += String(b); });
    filho.stderr.on('data', b => { erros += String(b); if (erros.length > 4000) erros = erros.slice(-4000); });
    const relogio = setTimeout(() => { try { filho.kill(); } catch (e) {} }, LIMITE_EXECUCAO_MS);
    filho.on('error', err => { clearTimeout(relogio); resolve({ ok: false, texto: err.message }); });
    filho.on('close', code => {
      clearTimeout(relogio);
      let r = null; try { r = JSON.parse(saida); } catch (e) { /* saída que não é JSON */ }
      const limpos = erros.split(/\r?\n/).filter(l => l.trim() && !/^Ignoring \d+ permissions\./.test(l)).join('\n');
      const texto = String((r && r.result) || saida || limpos || ('o Claude saiu com o código ' + code)).trim();
      resolve({ ok: code === 0 && !(r && r.is_error), texto });
    });
  });
}

async function atenderMensagens() {
  // com a organização do botão rodando, não sai daqui calado: marca "esperando a rotina terminar" (a tela mostra)
  if (respondendo) return;
  respondendo = true;
  try {
    for (;;) {
      const snap = await mensagensRef.where('status', 'in', ['pendente', 'aguardando']).get();
      const fila = snap.docs.sort((a, b) => String(a.data().criadoEm).localeCompare(String(b.data().criadoEm)));
      if (!fila.length) break;
      const doc = fila[0];
      const m = doc.data();
      const texto = String(m.texto || '').trim().slice(0, 4000);
      if (!texto) { await doc.ref.update({ status: 'erro', erro: 'mensagem vazia', fimEm: agora() }); continue; }
      // a sessão: a que a tela mostrava; se não vale ou sumiu, a mais nova desta pasta
      let sessao = SESSAO_VALIDA.test(String(m.sessao || '')) && fs.existsSync(path.join(PASTA_CONVERSAS, m.sessao + '.jsonl')) ? m.sessao : null;
      if (!sessao) { const c = lerConversaDaRotina(); sessao = c ? c.sessao : null; }
      if (!sessao) { await doc.ref.update({ status: 'erro', erro: 'não há conversa do Claude neste PC', fimEm: agora() }); continue; }
      const espera = ocupado ? 'um pedido do botão está rodando' : motivoPraEsperar();
      if (espera) {
        if (m.status !== 'aguardando') await doc.ref.update({ status: 'aguardando', aguardandoMotivo: espera, aguardandoEm: agora() });
        break;   // tenta de novo na próxima volta
      }
      await doc.ref.update({ status: 'respondendo', sessao, inicioEm: agora() });
      log('mensagem do nads para o Claude da rotina (' + (m.criadoPor || '?') + ')');
      const r = await responderNaSessao(sessao, texto);
      await doc.ref.update(r.ok ? { status: 'respondida', resposta: r.texto.slice(0, 3000), fimEm: agora() } : { status: 'erro', erro: r.texto.slice(0, 600) || 'o Claude não respondeu', fimEm: agora() });
      assinaturaConversa = '';   // publica a conversa de novo já com a resposta
      await publicarConversa();
    }
  } catch (err) { log('mensagens para o Claude:', err.message); }
  finally { respondendo = false; }
}

// Motivo pra esperar, ou null se pode começar.
function motivoPraEsperar() {
  const mes = new Date().toISOString().slice(0, 7);
  const ultimoSinal = Math.max(
    maisRecenteEm(path.join(CONTROLE, 'LOGS', mes), 2),
    maisRecenteEm(path.join(CONTROLE, 'MANIFESTO'), 0),
    maisRecenteEm(path.join(CONTROLE, 'STAGING'), 2)
  );
  if (Date.now() - ultimoSinal < SINAL_DE_OUTRA_EXECUCAO_MS) {
    return 'a rotina está rodando agora (provavelmente a das 9h); começo quando ela terminar';
  }
  const d = new Date();
  const m = minutosDoDia(d.getHours(), d.getMinutes());
  if (m >= minutosDoDia(...JANELA_DAS_9H.de) && m < minutosDoDia(...JANELA_DAS_9H.ate)) {
    const feitaHoje = man.listarExecucoes(CONTROLE).some(e => e.id.startsWith('EXEC-' + hojeIso() + '-') &&
      new Date(man.dataDoId(e.id)).getHours() >= 9);
    if (!feitaHoje) return 'é o horário da organização das 9h; começo depois que ela terminar';
  }
  return null;
}

// ---------- publicar o que foi arquivado ----------
// Lembra, neste PC, o que já subiu pro banco (id -> assinatura). Assim cada
// passada só grava execução nova ou que mudou, e não gasta gravação à toa.
const ARQ_PUBLICADOS = path.join(__dirname, 'arquivador-publicados.json');
function lerPublicados() { try { return JSON.parse(fs.readFileSync(ARQ_PUBLICADOS, 'utf8')); } catch (e) { return {}; } }
function gravarPublicados(p) { try { fs.writeFileSync(ARQ_PUBLICADOS, JSON.stringify(p)); } catch (e) {} }

let publicando = false;
async function publicar(ligarPedido) {
  if (publicando) return [];
  publicando = true;
  const novos = [];
  try {
    let manifesto = '', qualidade = '';
    try { manifesto = fs.readFileSync(path.join(CONTROLE, 'MANIFESTO', 'manifesto.jsonl'), 'utf8'); } catch (e) {}
    try { qualidade = fs.readFileSync(path.join(CONTROLE, 'MANIFESTO', 'qualidade.jsonl'), 'utf8'); } catch (e) {}
    const porExec = man.agruparManifesto(manifesto);
    const qual = man.lerQualidade(qualidade);
    const relatorios = new Map(man.listarExecucoes(CONTROLE).map(e => [e.id, e]));
    const ids = new Set([...porExec.keys(), ...relatorios.keys()]);
    const publicados = lerPublicados();
    for (const id of ids) {
      const rel = relatorios.get(id);
      const assinatura = (porExec.get(id) || []).length + ':' + (rel ? Math.round(rel.mtime) : 0) + ':' + JSON.stringify(qual.get(id) || null);
      if (publicados[id] === assinatura) continue;
      let texto = '';
      if (rel) { try { texto = fs.readFileSync(rel.txt, 'utf8'); } catch (e) {} }
      const { resumo, detalhe } = man.montarExecucao(id, porExec.get(id), qual.get(id), texto, rel ? rel.mtime : null);
      resumo.publicadoEm = agora();
      if (ligarPedido && ligarPedido.id === id) resumo.pedidoId = ligarPedido.pedidoId;
      const ref = db.collection('arquivamentos').doc(id);
      await ref.set(resumo, { merge: true });
      // merge: a mensagem final do Claude (respostaClaude) é gravada depois,
      // pelo pedido, e uma republicação não pode apagá-la.
      await ref.collection('detalhe').doc('tudo').set(detalhe, { merge: true });
      publicados[id] = assinatura;
      gravarPublicados(publicados);
      novos.push(id);
    }
    if (novos.length) log('publicado no banco:', novos.length, 'execução(ões):', novos.slice(-5).join(', ') + (novos.length > 5 ? '…' : ''));
  } catch (err) {
    log('não consegui publicar o arquivamento:', err.message);
  } finally { publicando = false; }
  return novos;
}

// ---------- rodar a rotina ----------
function branchDaRotina() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).trim();
}

// Sem as variáveis de uma sessão do Claude que por acaso tenha ligado este
// programa: a rotina tem que nascer como uma sessão nova, igual à das 9h.
function ambienteLimpo() {
  const env = Object.assign({}, process.env);
  Object.keys(env).forEach(k => { if (/^CLAUDE_?CODE|^CLAUDECODE$|^ANTHROPIC_/.test(k)) delete env[k]; });
  return env;
}

// Uma linha legível pra cada coisa que o Claude faz. É o que aparece ao vivo
// no quadro "Organizando" da tela.
function descreverPasso(item) {
  const i = item.input || {};
  const base = f => String(f || '').split(/[\\/]/).filter(Boolean).pop() || '';
  const curto = (x, n) => { x = String(x || '').replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n - 1) + '…' : x; };
  switch (item.name) {
    case 'TodoWrite': {
      const lista = Array.isArray(i.todos) ? i.todos : [];
      const agora = lista.find(x => x.status === 'in_progress');
      const feitas = lista.filter(x => x.status === 'completed').length;
      return agora ? 'etapa ' + (feitas + 1) + '/' + lista.length + ': ' + curto(agora.activeForm || agora.content, 160)
        : 'plano: ' + feitas + '/' + lista.length + ' etapas concluídas';
    }
    case 'Task': case 'Agent': return 'subagente ' + (i.subagent_type || '') + ': ' + curto(i.description || i.prompt, 140);
    case 'Read': return 'lendo ' + base(i.file_path);
    case 'Write': return 'gravando ' + base(i.file_path);
    case 'Edit': case 'MultiEdit': return 'atualizando ' + base(i.file_path);
    case 'Glob': return 'procurando arquivos: ' + curto(i.pattern, 100);
    case 'Grep': return 'procurando "' + curto(i.pattern, 60) + '"';
    case 'Bash': case 'PowerShell': return curto(i.description || i.command, 160);
    default: return item.name || 'passo';
  }
}

// A lista de etapas que o Claude mantém (TodoWrite) é o termômetro do
// arquivamento: quantas já foram, quantas são e qual está andando. Só a do
// Claude principal — a de um subagente é o plano de um pedaço, não do todo.
function etapasDe(c, sub) {
  if (c.name !== 'TodoWrite' || sub) return {};
  const lista = Array.isArray((c.input || {}).todos) ? c.input.todos : [];
  if (!lista.length) return {};
  const atual = lista.find(x => x.status === 'in_progress');
  return { etapas: {
    feitas: lista.filter(x => x.status === 'completed').length,
    total: lista.length,
    atual: atual ? String(atual.activeForm || atual.content || '').slice(0, 160) : null,
    nomes: lista.map(x => ({ nome: String(x.content || '').slice(0, 120), status: x.status })).slice(0, 30),
  } };
}

function rodarRotina(modo, aoAndar) {
  return new Promise(resolve => {
    const erros = [];
    let resposta = '';
    let sucesso = null;
    let resto = '';
    // stream-json: uma linha JSON por evento (texto do Claude, ferramenta
    // usada, resultado final). É daí que sai o andamento ao vivo.
    const env = Object.assign(ambienteLimpo(), { CLAUDE_CODE_SUBAGENT_MODEL: MODELO_EXECUTOR });
    const filho = spawn(CLAUDE, ['-p', '/organizar ' + modo, '--model', MODELO_ORQUESTRADOR, '--permission-mode', 'bypassPermissions',
      '--add-dir', DRIVE, '--output-format', 'stream-json', '--verbose'],
      { cwd: RAIZ, windowsHide: true, env, stdio: ['ignore', 'pipe', 'pipe'] });
    filho.stdout.on('data', b => {
      resto += String(b);
      const linhas = resto.split(/\r?\n/);
      resto = linhas.pop();
      for (const l of linhas) {
        if (!l.trim()) continue;
        let ev;
        try { ev = JSON.parse(l); } catch (e) { continue; }
        const sub = !!ev.parent_tool_use_id;
        if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
          for (const c of ev.message.content) {
            if (c.type === 'text' && c.text && c.text.trim()) aoAndar({ texto: c.text.trim().replace(/\s+/g, ' ').slice(0, 300), sub, tipo: 'fala' });
            if (c.type === 'tool_use') aoAndar(Object.assign({ texto: descreverPasso(c), sub, tipo: c.name === 'TodoWrite' ? 'etapa' : 'passo' }, etapasDe(c, sub)));
          }
        }
        if (ev.type === 'result') {
          resposta = String(ev.result || '');
          sucesso = ev.subtype === 'success' && !ev.is_error;
          // quem trabalhou de fato (orquestrador e subagentes)
          if (ev.modelUsage) log('modelos usados:', Object.keys(ev.modelUsage).join(', '));
        }
      }
    });
    filho.stderr.on('data', b => { erros.push(String(b)); if (erros.length > 20) erros.shift(); });
    const relogio = setTimeout(() => { log('a rotina passou de 3 horas; encerrando'); try { filho.kill(); } catch (e) {} }, LIMITE_EXECUCAO_MS);
    filho.on('error', err => { clearTimeout(relogio); resolve({ ok: false, texto: err.message }); });
    filho.on('close', code => {
      clearTimeout(relogio);
      const ok = code === 0 && sucesso !== false;
      resolve({ ok, texto: (resposta || erros.join('')).trim(), code });
    });
  });
}

let ocupado = false;
async function atenderFila() {
  if (ocupado) return;
  ocupado = true;
  try {
    for (;;) {
      const snap = await fila.where('status', 'in', ['pendente', 'aguardando']).get();
      const pedidos = snap.docs.sort((a, b) => String(a.data().criadoEm).localeCompare(String(b.data().criadoEm)));
      if (!pedidos.length) break;
      const doc = pedidos[0];
      const p = doc.data();
      const modo = MODOS.includes(p.modo) ? p.modo : null;
      if (!modo) { await doc.ref.update({ status: 'erro', erro: 'modo desconhecido: ' + p.modo, erroEm: agora() }); continue; }

      const espera = motivoPraEsperar();
      if (espera) {
        if (p.status !== 'aguardando' || p.aguardandoMotivo !== espera) {
          await doc.ref.update({ status: 'aguardando', aguardandoMotivo: espera, aguardandoEm: agora() });
          log('pedido', doc.id, 'esperando:', espera);
        }
        mudarEstado({ situacao: 'aguardando', pedidoId: doc.id, mensagem: espera });
        break;   // tenta de novo na próxima volta do relógio
      }

      try {
        const branch = branchDaRotina();
        if (modo === 'PRODUCAO' && branch !== 'main') throw new Error('a pasta da rotina está na branch "' + branch + '", não na main; produção só roda na main');
      } catch (err) {
        await doc.ref.update({ status: 'erro', erro: err.message, erroEm: agora() });
        log('pedido', doc.id, 'recusado:', err.message);
        continue;
      }

      const inicio = Date.now();
      await doc.ref.update({ status: 'processando', processandoEm: agora(), pc: os.hostname(), aguardandoMotivo: null });
      mudarEstado({ situacao: 'rodando', pedidoId: doc.id, mensagem: 'organizando (' + modo + ')' });
      log('pedido', doc.id, 'de', p.criadoPor || 'alguém', '- rodando /organizar', modo);

      // Andamento ao vivo: as últimas linhas vão pro pedido de tempos em tempos
      // (não a cada linha, pra não gastar gravação à toa).
      const andamento = [];
      let passos = 0, sujo = false, ultimaEscrita = 0;
      let progresso = null;   // { feitas, total, atual, nomes, em } — vira a % da tela
      const gravarAndamento = forcar => {
        if (!sujo || (!forcar && Date.now() - ultimaEscrita < 8000)) return;
        sujo = false; ultimaEscrita = Date.now();
        doc.ref.update(Object.assign({ andamento: andamento.slice(-40), passos, ultimoPassoEm: agora() }, progresso ? { progresso } : {})).catch(() => {});
      };
      const timerAndamento = setInterval(() => gravarAndamento(false), 4000);
      const r = await rodarRotina(modo, linha => {
        passos++;
        if (linha.etapas) { progresso = Object.assign({ em: agora() }, linha.etapas); delete linha.etapas; }
        andamento.push(Object.assign({ em: agora() }, linha));
        if (andamento.length > 200) andamento.shift();
        sujo = true;
      });
      clearInterval(timerAndamento);
      gravarAndamento(true);

      // Qual execução saiu desta rodada: o relatório mais novo, do mesmo tipo,
      // criado depois que começamos.
      // Pela hora em que o relatório foi gravado, não pelo nome: o nome já
      // saiu com prefixo errado e hora em UTC.
      const execucao = man.listarExecucoes(CONTROLE)
        .filter(e => e.mtime >= inicio - 60000)
        .map(e => e.id).pop() || null;
      await publicar(execucao ? { id: execucao, pedidoId: doc.id } : null);

      const resposta = r.texto.length > 30000 ? r.texto.slice(-30000) : r.texto;
      // A mensagem final também fica junto da execução: a lista de pedidos da
      // tela só mostra os últimos, e a execução fica pra sempre.
      if (execucao && resposta) {
        await db.collection('arquivamentos').doc(execucao).collection('detalhe').doc('tudo')
          .set({ respostaClaude: resposta, pedidoId: doc.id }, { merge: true })
          .catch(err => log('não consegui guardar a mensagem do Claude na execução:', err.message));
      }
      if (paradaPedida) {
        // parada pelo nads ("Cancelar a organização"): não é erro da rotina
        await doc.ref.update({ status: 'cancelado', canceladoEm: agora(), canceladoPor: paradaPedida.por, execucao, resposta });
        log('pedido', doc.id, 'cancelado pelo nads (' + (paradaPedida.por || '?') + ')');
        paradaPedida = null;
      } else if (r.ok) {
        await doc.ref.update({ status: 'concluido', concluidoEm: agora(), execucao, resposta });
        log('pedido', doc.id, 'concluído', execucao ? '(' + execucao + ')' : '(sem relatório novo)');
      } else {
        await doc.ref.update({ status: 'erro', erro: 'a rotina terminou com erro' + (r.code != null ? ' (código ' + r.code + ')' : ''), erroEm: agora(), execucao, resposta });
        log('pedido', doc.id, 'falhou, código', r.code);
      }
      mudarEstado({ situacao: 'livre' });
    }
  } catch (err) {
    log('erro atendendo a fila:', err.message);
  } finally { ocupado = false; }
}

// ---------- início ----------
async function iniciar() {
  // Pedido que ficou "processando" quando o PC desligou: não roda de novo às
  // cegas — metade dos arquivos pode já ter sido movida.
  const presos = await fila.where('status', '==', 'processando').get();
  for (const d of presos.docs) {
    await d.ref.update({ status: 'erro', erro: 'o PC desligou no meio da organização; confira a pasta Claudio Secretario antes de pedir de novo', erroEm: agora() });
  }
  mudarEstado({ situacao: 'livre' });
  setInterval(baterPonto, 60 * 1000);

  await publicar(null);
  setInterval(() => publicar(null), PUBLICAR_A_CADA_MS);
  // a conversa do Claude da rotina e o relatório do dia (o nads mostra no Arquivar agora)
  void publicarConversa();
  setInterval(() => { void publicarConversa(); }, 60 * 1000);
  // parar a organização que está rodando (o botão "Cancelar a organização" do nads)
  pedidosParar.where('status', '==', 'pendente').onSnapshot(snap => {
    for (const ch of snap.docChanges()) if (ch.type === 'added') void atenderParar(ch.doc).catch(err => log('parar:', err.message));
  }, err => log('parar a organização:', err.message));
  // as mensagens escritas no nads para o Claude da rotina (só o admin escreve)
  mensagensRef.where('status', '==', 'pendente').onSnapshot(() => { void atenderMensagens(); }, err => log('mensagens para o Claude:', err.message));
  setInterval(() => { void atenderMensagens(); }, 60 * 1000);

  ouvir('pedidos de arquivamento', () => fila.where('status', '==', 'pendente'), snap => { if (!snap.empty) atenderFila(); }, log);
  // Pedido que está esperando a das 9h terminar: confere de 2 em 2 minutos.
  setInterval(() => { if (!ocupado) atenderFila(); }, 2 * 60000);
  log('arquivador ligado em', os.hostname(), '— rotina em', RAIZ);

  // O atendente da Consulta rápida pega carona neste processo: também é o
  // Claude deste PC, e assim liga no boot e volta sozinho junto com o
  // arquivador. Uma falha nele não derruba o arquivamento.
  // O SIEG (as notas do Fiscal do nads) também pega carona aqui: as credenciais ficam neste PC. Sem elas, fica desligado.
  // o FGTS Digital no PC (08/10/2026): o Edge aparece na tela; a verificação do gov.br é feita pela pessoa (aqui ou pela
  // tela ao vivo no nads)
  // desde 09/10/2026 pelo Claude do PC no Chrome logado (fgts-claude.js); o robô do navegador (fgts-digital.js) fica para a nuvem
  try { require('./fgts-claude').iniciarFgtsPeloClaude(db, log); }
  catch (err) { log('FGTS não ligou:', err.message); }
  try { require('./sieg').iniciarSieg({ db, log }); }
  catch (err) { log('SIEG desligado:', err.message); }

  try { pararIA = require('./atendente-claude').iniciarAtendenteClaude({ db, log }); }
  catch (err) { log('atendente de IA desligado:', err.message); }
}

let pararIA = null;
function desligar() {
  Promise.all([
    estadoRef.set({ em: new Date(0).toISOString(), situacao: 'desligado', desligadoEm: agora() }, { merge: true }),
    pararIA ? pararIA() : null,
  ]).catch(() => {}).finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}
process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);
process.on('unhandledRejection', err => log('erro não tratado (segui rodando):', err && err.message ? err.message : String(err)));

iniciar().catch(err => { log('ERRO ao iniciar:', err.message); process.exit(1); });
