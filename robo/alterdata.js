// Os relatórios do Alterdata pelo robô (Vitor, 14/10/2026: "vamos começar com o balancete"; "eu não quero o Claude como
// robô"; 04/11/2026: "quero criar um robo que puxa balancete e planilha de conta e upa no nads", "isso tem que rodar no
// servidor"). Os pedidos ficam em pedidosAlterdata:
//   - {tipo:'balancete'}: a Conferência pede o balancete; o .xlsx volta em pedidosAlterdata/{id}/arquivo/xlsx (base64);
//   - {tipo:'mensal'}: a página Alterdata da empresa (Tarefas) pede o balancete e o razão de todas as contas do mês; os
//     arquivos voltam em pedaços (pedidosAlterdata/{id}/partes/{balancete|razao}-{nnn}, {dados: base64}) e o resumo em
//     arquivos.{balancete|razao} = {status, nome, tamanho, partes, erro}.
// Os roteiros (alterdata_balancete.py, alterdata_razao.py) rodam no Contábil JÁ ABERTO E LOGADO desta máquina (nunca
// digitam login, não tocam no banco do Alterdata). A fila (alterdata-fila.js) faz um por vez, com pasta própria por pedido,
// junta o repetido e tem prazo. Quem atende: a máquina com o Contábil aberto e logado. Cada pedido é pego numa transação
// (pendente → trabalhando, com o onde): duas máquinas nunca pegam o mesmo. O estado do Contábil de cada máquina vai para
// robo/alterdata.maquinas.{onde} (a página mostra quando nenhum está pronto).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { ouvir } = require('./ouvinte');
const painel = require('./painel');
const { criarFilaAlterdata, periodo } = require('./alterdata-fila');

const DRIVE = process.env.ARQUIVO_DRIVE || 'G:\\Meu Drive';
const ONDE = process.env.ARQ_SO_SERVIDOR === '1' ? 'servidor' : 'pc';
// a pasta de trabalho de cada pedido: no servidor, o disco local (o G: de lá está em "transmitir" e leva ~30 s por arquivo;
// os arquivos sobem direto para o banco, a pasta é só o rascunho); no PC, o Drive, como no teste de 04/11/2026
const PASTA_PEDIDOS = process.env.ALTERDATA_PEDIDOS
  || (ONDE === 'servidor' ? 'D:\\nads-dados\\alterdata\\pedidos' : path.join(DRIVE, 'Claudio Secretario', 'Alterdata', 'pedidos'));
// o Python do servidor fica em D:\Programas\Python313 (fora do PATH); no PC, o do PATH
const PYTHON = process.env.PYTHON_EXE || ['D:\\Programas\\Python313\\python.exe'].find(p => fs.existsSync(p)) || 'python';
const ROTEIROS = { balancete: path.join(__dirname, 'alterdata_balancete.py'), razao: path.join(__dirname, 'alterdata_razao.py') };
const ROTEIRO_ESTADO = path.join(__dirname, 'alterdata_estado.py');
const LIMITE_MS = 9 * 60 * 1000;
const PEDACO = 700 * 1000;   // caracteres de base64 por pedaço (o documento do Firestore vai até 1 MiB)
const VERIFICAR_MS = 60 * 1000;

const agora = () => new Date().toISOString();
const ESTADOS = { ok: 'aberto e logado', login: 'na tela de login', fechado: 'fechado', dois: 'aberto duas vezes', erro: 'sem resposta' };

/** O Contábil desta máquina: ok | login | fechado | dois | erro (sem mexer em nada). */
function estadoDoContabil() {
  return new Promise(resolve => {
    execFile(PYTHON, ['-I', ROTEIRO_ESTADO], { cwd: __dirname, windowsHide: true, timeout: 30 * 1000 }, (err, out, errs) => {
      const m = String(out || '').match(/ESTADO:\s*(\w+)/);
      const d = String(out || '').match(/DIAG:\s*(.+)/);
      // o porquê, para o log: o DIAG do roteiro, ou o fim do erro do Python, ou o prazo
      const porque = d ? d[1].trim() : err ? (err.killed ? 'passou de 30 s' : String(errs || err.message).trim().split('\n').pop().slice(0, 200)) : '';
      resolve({ estado: m ? m[1] : 'erro', porque });
    });
  });
}

/** Mata o Python e o que ele abriu (no Windows, a árvore inteira). */
function matar(filho) {
  try {
    if (process.platform === 'win32') execFile('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { windowsHide: true }, () => {});
    else filho.kill();
  } catch (_) { /* já saiu */ }
}

/** Roda um roteiro; PASSO: … vira passo; RESULTADO: {…} é o fim; o sinal (o prazo da fila) mata o roteiro. */
function rodarRoteiro(relatorio, a, passo, sinal) {
  const args = relatorio === 'razao'
    ? [String(a.codigo), a.inicio, a.fim, a.pasta, a.destino]
    : [String(a.codigo), a.inicio, a.fim, a.destino];
  return new Promise(resolve => {
    const filho = spawn(PYTHON, ['-I', ROTEIROS[relatorio], ...args], { cwd: __dirname, windowsHide: true });
    let resto = '', erros = '', resultado = null;
    filho.stdout.on('data', b => {
      resto += b.toString('utf8');
      const linhas = resto.split(/\r?\n/);
      resto = linhas.pop();
      for (const l of linhas) {
        const m = l.match(/^PASSO:\s*(.+)$/);
        if (m) void passo(m[1]);
        const r = l.match(/^RESULTADO:\s*(\{.*\})\s*$/);
        if (r) { try { resultado = JSON.parse(r[1]); } catch (_) { /* mal escrito */ } }
      }
    });
    filho.stderr.on('data', b => { erros += b.toString('utf8'); if (erros.length > 2000) erros = erros.slice(-2000); });
    if (sinal) sinal.addEventListener('abort', () => matar(filho));
    filho.on('error', err => resolve({ ok: false, erro: 'não consegui rodar o Python: ' + err.message }));
    filho.on('close', () => resolve(resultado || { ok: false, erro: 'o roteiro parou sem resultado' + (erros ? ': ' + erros.trim().split('\n').pop().slice(0, 200) : '') }));
  });
}

function iniciarAlterdata(db, log) {
  const faltam = Object.values(ROTEIROS).concat(ROTEIRO_ESTADO).filter(r => !fs.existsSync(r));
  if (faltam.length) { log('Alterdata: desligado (falta ' + faltam.map(f => path.basename(f)).join(', ') + ')'); painel.modulo('alterdata', 'Alterdata', false, 'falta o roteiro'); return; }
  const estadoDoc = db.collection('robo').doc('alterdata');
  const pedidos = db.collection('pedidosAlterdata');
  log('Alterdata: ligado neste ' + ONDE + ' (balancete e razão do Contábil; Python ' + PYTHON + ')');

  // o Contábil daqui: verificado a cada minuto e antes de cada pedido; vai para o banco e para o painel
  let estado = '';
  async function verificar() {
    const { estado: novo, porque } = await estadoDoContabil();
    if (novo !== estado) {
      log('Alterdata: o Contábil deste ' + ONDE + ' está ' + ESTADOS[novo] + (porque ? ' (' + porque + ')' : ''));
      painel.modulo('alterdata', 'Alterdata', novo === 'ok', 'o Contábil está ' + ESTADOS[novo]);
    }
    estado = novo;
    await estadoDoc.set({ ligado: true, maquinas: { [ONDE]: { contabil: estado, em: agora() } }, atualizadoEm: agora() }, { merge: true }).catch(() => {});
    return estado;
  }

  const banco = {
    async ler(id) { const s = await pedidos.doc(id).get(); return s.exists ? s.data() : null; },
    async pegar(id) {
      if (await verificar() !== 'ok') return null;   // fica para a máquina que estiver com o Contábil pronto
      const ref = pedidos.doc(id);
      return db.runTransaction(async t => {
        const s = await t.get(ref);
        if (!s.exists || s.data().status !== 'pendente') return null;
        t.update(ref, { status: 'trabalhando', onde: ONDE, pegoEm: agora() });
        return s.data();
      });
    },
    atualizar: (id, campos) => pedidos.doc(id).update(campos),
    async gravarArquivo(id, rel, buf, nome, tipo) {
      const ref = pedidos.doc(id);
      if (tipo === 'balancete') {   // o da Conferência, como sempre foi
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
        await ref.collection('arquivo').doc('xlsx').set({ base64: buf.toString('base64'), nome, tamanho: buf.length, sha256, quando: agora() });
        return { partes: 1 };
      }
      const b64 = buf.toString('base64');
      const n = Math.max(1, Math.ceil(b64.length / PEDACO));
      for (let i = 0; i < n; i++) {
        await ref.collection('partes').doc(rel + '-' + String(i).padStart(3, '0')).set({ n: i, dados: b64.slice(i * PEDACO, (i + 1) * PEDACO) });
      }
      return { partes: n };
    },
    async prontoIgual(id, p) {
      const s = await pedidos.where('codigo', '==', Number(p.codigo)).get();
      const igual = s.docs.find(d => {
        const o = d.data();
        return d.id !== id && o.tipo === 'mensal' && o.competencia === p.competencia && o.status === 'pronto' && !o.mesmoQue && String(o.fimEm || '') >= String(p.criadoEm || '');
      });
      return igual ? { id: igual.id, arquivos: igual.data().arquivos || {} } : null;
    },
  };

  const fila = criarFilaAlterdata({ banco, rodar: rodarRoteiro, pastaDoPedido: id => path.join(PASTA_PEDIDOS, id), log, painel, limiteMs: LIMITE_MS });

  // o que ficou no meio, nesta máquina, quando o robô reiniciou volta para a fila uma vez
  pedidos.where('status', '==', 'trabalhando').get().then(s => Promise.all(s.docs.filter(d => (d.data().onde || 'pc') === ONDE).map(d => {
    const t = Number(d.data().tentativas || 0);
    return t < 1 ? d.ref.update({ status: 'pendente', tentativas: t + 1, passos: [] })
      : d.ref.update({ status: 'erro', erro: 'o robô reiniciou no meio duas vezes; peça de novo', fimEm: agora() });
  }))).catch(() => {});

  // os pendentes: cada um entra na fila (o mesmo id não entra duas vezes); a cada minuto, com o Contábil pronto, os que
  // ficaram (o Contábil estava fechado quando chegaram) entram de novo
  const pendentes = new Set();
  ouvir('pedidos do Alterdata', () => pedidos.where('status', '==', 'pendente'), snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') { pendentes.delete(ch.doc.id); fila.saiu(ch.doc.id); } else { pendentes.add(ch.doc.id); fila.chegou(ch.doc.id); }
    }
  }, log);
  void verificar();
  setInterval(async () => {
    if (await verificar() === 'ok') for (const id of pendentes) fila.chegou(id);
  }, VERIFICAR_MS).unref();
}

module.exports = { iniciarAlterdata, periodo, estadoDoContabil };
