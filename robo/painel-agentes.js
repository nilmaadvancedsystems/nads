// O painel dos agentes no nads (Vitor, 13/10/2026: "tem como upar uma página no nads disso?"; "estou em outro PC via
// controle remoto"): os ganchos do Claude Code deste PC gravam cada evento em ~/.claude/painel/eventos.jsonl (o painel
// local, http://localhost:4517). Aqui o robô lê esse arquivo, junta o estado de cada sessão (o mesmo do painel local:
// cada agente, o que está fazendo agora e as últimas ações) e grava um documento por sessão em painelAgentes/{sessão},
// no banco do Entregas, a cada 3 s e só quando mudou. No nads: Cadastro › Agentes (só o admin lê, pela regra).
// Só o resumo: o projeto, o último pedido (300 caracteres), o comando/arquivo de cada ação (160) e o estado.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ARQUIVO = path.join(os.homedir(), '.claude', 'painel', 'eventos.jsonl');
const COLECAO = 'painelAgentes';
const A_CADA_MS = 3000;
const ATIVA_MS = 2 * 60 * 60 * 1000;   // sessão parada há mais de 2 h: o documento fica, sem atualizar
const APAGAR_MS = 24 * 60 * 60 * 1000; // e some depois de 24 h
const INICIO_MAX = 4 * 1024 * 1024;

const projeto = cwd => String(cwd || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';

/** Aplica um evento ao estado das sessões (o mesmo do painel.html). Devolve o id da sessão que mudou. */
function aplicar(sessoes, e) {
  if (!e || !e.sessao) return null;
  if (!sessoes.has(e.sessao)) sessoes.set(e.sessao, { sessao: e.sessao, cwd: '', modelo: '', status: 'parado', pedido: '', nivel: '', aviso: '', ultimo: 0, agentes: new Map(), pedidos: {} });
  const s = sessoes.get(e.sessao);
  if (e.cwd) s.cwd = e.cwd;
  s.ultimo = Math.max(s.ultimo, +new Date(e.ts) || 0);
  const chave = e.agente || 'principal';
  if (!s.agentes.has(chave)) s.agentes.set(chave, { chave, tipo: e.agente ? (e.tipo || 'subagente') : 'principal', modelo: '', status: 'parado', agora: null, hist: [], msg: '', inicio: '' });
  const a = s.agentes.get(chave);
  if (e.agente && e.tipo) a.tipo = e.tipo;
  switch (e.ev) {
    case 'SessionStart': s.status = 'parado'; if (e.modelo) s.modelo = e.modelo; break;
    case 'UserPromptSubmit': s.pedido = e.pedido || s.pedido; s.status = 'trabalhando'; s.aviso = ''; break;
    case 'Porteiro': s.nivel = e.nivel || ''; break;
    case 'PreToolUse':
      if (e.delegaTipo && e.delegaModelo) s.pedidos[e.delegaTipo] = e.delegaModelo;
      a.agora = { fer: e.ferramenta || '', txt: e.resumo || '', ts: e.ts, id: e.id || '' };
      if (e.agente) a.status = 'trabalhando';
      s.status = 'trabalhando'; s.aviso = ''; break;
    case 'PostToolUse': case 'PostToolUseFailure':
      a.hist.unshift({ ts: e.ts, fer: e.ferramenta || '', txt: e.resumo || e.msg || '', ms: e.ms || 0, falhou: e.ev === 'PostToolUseFailure' });
      a.hist.length = Math.min(a.hist.length, 6);
      if (a.agora && (!e.id || a.agora.id === e.id)) a.agora = null;
      break;
    case 'SubagentStart':
      a.status = 'trabalhando'; a.inicio = e.ts;
      if (s.pedidos[a.tipo]) { a.modelo = s.pedidos[a.tipo]; delete s.pedidos[a.tipo]; }
      break;
    case 'SubagentStop': a.status = 'terminou'; a.agora = null; a.msg = e.msg || ''; break;
    case 'Notification': s.status = 'esperando'; s.aviso = e.msg || ''; break;
    case 'Stop': if (!e.agente) { s.status = 'parado'; a.agora = null; a.msg = e.msg || a.msg; } break;
    case 'SessionEnd': s.status = 'encerrada'; break;
  }
  return e.sessao;
}

/** O modelo de cada agente do usuário (o frontmatter de ~/.claude/agents/*.md): rapido → haiku, forte → opus… */
function modelosDosAgentes() {
  const m = {};
  try {
    const dir = path.join(os.homedir(), '.claude', 'agents');
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const fm = /^---\s*([\s\S]*?)\n---/.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
      const nome = fm && (/^name:\s*(.+)$/m.exec(fm[1]) || [])[1];
      const modelo = fm && (/^model:\s*(.+)$/m.exec(fm[1]) || [])[1];
      if (nome && modelo) m[nome.trim()] = modelo.trim();
    }
  } catch { /* sem a pasta: sem modelos */ }
  return m;
}

/** O documento da sessão no banco (o principal primeiro, depois os subagentes mais novos; no máximo 9). */
function documentoDaSessao(s, modelos = {}) {
  const ags = [...s.agentes.values()].sort((x, y) => (x.chave === 'principal' ? -1 : y.chave === 'principal' ? 1 : String(y.inicio).localeCompare(String(x.inicio))));
  return {
    sessao: s.sessao, projeto: projeto(s.cwd), status: s.status, nivel: s.nivel, modelo: s.modelo,
    pedido: s.pedido, aviso: s.aviso, ultimo: new Date(s.ultimo || Date.now()).toISOString(), maquina: os.hostname(),
    agentes: ags.slice(0, 9).map(a => ({
      chave: a.chave, tipo: a.tipo, modelo: a.modelo || modelos[a.tipo] || '', status: a.status, msg: a.msg,
      agora: a.agora ? { fer: a.agora.fer, txt: a.agora.txt, ts: a.agora.ts } : null,
      hist: a.hist.map(h => ({ ts: h.ts, fer: h.fer, txt: h.txt, ms: h.ms, falhou: !!h.falhou })),
    })),
    maisAgentes: Math.max(0, ags.length - 9),
  };
}

function iniciarPainelAgentes({ db, log }) {
  if (!fs.existsSync(path.dirname(ARQUIVO))) { log('painel dos agentes: sem ~/.claude/painel neste PC, desligado'); return () => {}; }
  const sessoes = new Map();
  let lido = 0;
  const mudadas = new Set();
  const gravado = new Map(); // sessão → o JSON gravado (não grava de novo o mesmo)
  let modelos = modelosDosAgentes();
  setInterval(() => { modelos = modelosDosAgentes(); }, 10 * 60 * 1000);

  function lerTrecho(de, ate) {
    const buf = Buffer.alloc(ate - de);
    const fd = fs.openSync(ARQUIVO, 'r');
    try { fs.readSync(fd, buf, 0, buf.length, de); } finally { fs.closeSync(fd); }
    return buf.toString('utf8');
  }
  function aplicarLinhas(texto) {
    for (const l of texto.split('\n')) {
      if (!l.trim()) continue;
      try { const id = aplicar(sessoes, JSON.parse(l)); if (id) mudadas.add(id); } catch { /* linha ruim: pula */ }
    }
  }

  // o histórico recente, de uma vez
  try {
    const t = fs.statSync(ARQUIVO).size;
    const de = Math.max(0, t - INICIO_MAX);
    let texto = lerTrecho(de, t);
    if (de > 0) texto = texto.slice(texto.indexOf('\n') + 1);
    aplicarLinhas(texto);
    lido = t;
  } catch { lido = 0; }

  function lerNovas() {
    let t = 0;
    try { t = fs.statSync(ARQUIVO).size; } catch { return; }
    if (t < lido) lido = 0; // o arquivo foi cortado: lê de novo do começo
    if (t === lido) return;
    const texto = lerTrecho(lido, t);
    const fim = texto.lastIndexOf('\n');
    if (fim < 0) return;
    lido += Buffer.byteLength(texto.slice(0, fim + 1));
    aplicarLinhas(texto.slice(0, fim));
  }

  let gravando = false;
  async function gravar() {
    if (gravando) return;
    gravando = true;
    try {
      lerNovas();
      const agora = Date.now();
      for (const id of [...mudadas]) {
        mudadas.delete(id);
        const s = sessoes.get(id);
        if (!s || agora - s.ultimo > ATIVA_MS) continue;
        const doc = documentoDaSessao(s, modelos);
        const json = JSON.stringify(doc);
        if (gravado.get(id) === json) continue;
        await db.collection(COLECAO).doc(id).set(Object.assign(doc, { atualizadoEm: new Date().toISOString() }));
        gravado.set(id, json);
      }
    } catch (err) { log('painel dos agentes:', err.message); }
    finally { gravando = false; }
  }
  async function limpar() {
    try {
      const velho = new Date(Date.now() - APAGAR_MS).toISOString();
      const q = await db.collection(COLECAO).where('ultimo', '<', velho).limit(100).get();
      for (const d of q.docs) await d.ref.delete();
    } catch (err) { log('painel dos agentes (limpeza):', err.message); }
  }
  const t1 = setInterval(() => { void gravar(); }, A_CADA_MS);
  const t2 = setInterval(() => { void limpar(); }, 60 * 60 * 1000);
  void limpar();
  log('painel dos agentes: ligado (' + COLECAO + ')');
  return () => { clearInterval(t1); clearInterval(t2); };
}

module.exports = { iniciarPainelAgentes, aplicar, documentoDaSessao, modelosDosAgentes };
