// Os relatórios do Alterdata pelo robô do PC (Vitor, 14/10/2026: "vamos começar com o balancete"; "eu não quero o Claude
// como robô"). A Conferência pede (pedidosAlterdata {tipo:'balancete', codigo, empresa, competencia, status:'pendente'}); o
// robô roda o roteiro alterdata_balancete.py no Contábil JÁ ABERTO E LOGADO deste PC (nunca digita login, não toca no banco
// do Alterdata), um pedido por vez, e:
//   - grava cada passo no pedido (a Conferência mostra ao vivo);
//   - salva o .xlsx em G:\Meu Drive\Claudio Secretario\Balancetes\Balancete <cód> <AAAA-MM>.xlsx;
//   - põe o arquivo no pedido (pedidosAlterdata/{id}/arquivo/xlsx, base64) e marca pronto; a Conferência importa sozinha.
// Se o Contábil estiver fechado, na tela de login ou com uma janela inesperada, o pedido vira erro com o motivo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { ouvir } = require('./ouvinte');
// o painel do robô (21/10/2026): o balancete que está saindo agora, os prontos e os erros
const painel = require('./painel');

const DRIVE = process.env.ARQUIVO_DRIVE || 'G:\\Meu Drive';
const PASTA = path.join(DRIVE, 'Claudio Secretario', 'Balancetes');
const PYTHON = process.env.PYTHON_EXE || 'python';
const ROTEIRO = path.join(__dirname, 'alterdata_balancete.py');
const LIMITE_MS = 8 * 60 * 1000;

const agora = () => new Date().toISOString();
const competenciaValida = c => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(c || ''));

/** O primeiro e o último dia da competência, como o Alterdata pede (dd/mm/aaaa). */
function periodo(competencia) {
  const [a, m] = competencia.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return ['01/' + mm + '/' + a, String(ultimo).padStart(2, '0') + '/' + mm + '/' + a];
}

function iniciarAlterdata(db, log) {
  if (!fs.existsSync(ROTEIRO)) { log('Alterdata: desligado (falta ' + ROTEIRO + ')'); painel.modulo('alterdata', 'Balancete do Alterdata', false, 'falta o roteiro ' + path.basename(ROTEIRO)); return; }
  const estado = db.collection('robo').doc('alterdata');
  const pedidos = db.collection('pedidosAlterdata');
  estado.set({ ligado: true, onde: 'pc', atualizadoEm: agora() }, { merge: true }).catch(() => {});
  log('Alterdata: ligado (balancete do Contábil)');

  // o que ficou no meio quando o robô reiniciou volta para a fila uma vez
  pedidos.where('status', '==', 'trabalhando').get().then(s => Promise.all(s.docs.map(d => {
    const t = Number(d.data().tentativas || 0);
    return t < 1 ? d.ref.update({ status: 'pendente', tentativas: t + 1, passos: [] })
      : d.ref.update({ status: 'erro', erro: 'o robô reiniciou no meio duas vezes; peça de novo', fimEm: agora() });
  }))).catch(() => {});

  const fila = [];
  let ocupado = false;
  async function proximo() {
    if (ocupado || !fila.length) return;
    ocupado = true;
    const doc = fila.shift();
    try { await atender(doc); } catch (err) {
      log('Alterdata: erro', err.message);
      painel.erro('alterdata', 'O robô do Alterdata parou', err.message);
      await doc.ref.update({ status: 'erro', erro: 'o robô parou: ' + String(err.message).slice(0, 200), fimEm: agora() }).catch(() => {});
    }
    ocupado = false;
    painel.fazendo('alterdata', null);
    proximo();
  }
  ouvir('pedidos do Alterdata', () => pedidos.where('status', '==', 'pendente'), snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'added' && !fila.some(d => d.id === ch.doc.id)) fila.push(ch.doc);
      if (ch.type === 'removed') { const i = fila.findIndex(d => d.id === ch.doc.id); if (i >= 0) fila.splice(i, 1); }
    }
    setTimeout(proximo, 1000);
  }, log);

  async function atender(doc) {
    const p = doc.data();
    const ref = doc.ref;
    if (p.tipo !== 'balancete') { await ref.update({ status: 'erro', erro: 'tipo de relatório desconhecido: ' + p.tipo, fimEm: agora() }); return; }
    const codigo = Number(p.codigo);
    if (!Number.isInteger(codigo) || codigo <= 0) { await ref.update({ status: 'erro', erro: 'código da empresa inválido', fimEm: agora() }); return; }
    if (!competenciaValida(p.competencia)) { await ref.update({ status: 'erro', erro: 'competência inválida', fimEm: agora() }); return; }
    const [inicio, fim] = periodo(p.competencia);
    const destino = path.join(PASTA, 'Balancete ' + codigo + ' ' + p.competencia + '.xlsx');
    const passos = [];
    const passo = nome => { passos.push({ n: passos.length + 1, nome: String(nome).slice(0, 200), quando: agora() }); return ref.update({ passos }).catch(() => {}); };
    await ref.update({ status: 'trabalhando', inicioEm: agora(), passos: [] });
    const comp = p.competencia.slice(5) + '/' + p.competencia.slice(0, 4);
    painel.fazendo('alterdata', 'Balancete ' + codigo + ' ' + comp + ' no Alterdata');
    log('Alterdata: balancete', codigo, p.competencia);
    const r = await rodar([String(codigo), inicio, fim, destino], passo);
    if (!r.ok) {
      await ref.update({ status: 'erro', erro: r.erro || 'o roteiro não terminou', fimEm: agora() });
      log('Alterdata: erro', codigo, p.competencia, r.erro);
      painel.erro('alterdata', 'O balancete ' + codigo + ' ' + comp + ' não saiu', r.erro || 'o roteiro não terminou');
      return;
    }
    const xlsx = fs.readFileSync(destino);
    const nome = path.basename(destino);
    await ref.collection('arquivo').doc('xlsx').set({ base64: xlsx.toString('base64'), nome, tamanho: xlsx.length, sha256: crypto.createHash('sha256').update(xlsx).digest('hex'), quando: agora() });
    await ref.update({ status: 'pronto', arquivoNome: nome, arquivadoEm: path.relative(DRIVE, destino), fimEm: agora() });
    log('Alterdata: balancete pronto', codigo, p.competencia, xlsx.length, 'bytes');
    painel.atividade('alterdata', 'Gerou o balancete ' + codigo + ' ' + comp + ' no Alterdata', path.relative(DRIVE, destino) + (p.criadoPor ? ' · pedido de ' + p.criadoPor : ''));
  }

  /** Roda o roteiro; PASSO: … vira passo; RESULTADO: {…} é o fim. */
  function rodar(args, passo) {
    return new Promise(resolve => {
      const filho = spawn(PYTHON, ['-I', ROTEIRO, ...args], { cwd: __dirname, windowsHide: true });
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
      const relogio = setTimeout(() => { try { filho.kill(); } catch (_) {} }, LIMITE_MS);
      filho.on('error', err => { clearTimeout(relogio); resolve({ ok: false, erro: 'não consegui rodar o Python: ' + err.message }); });
      filho.on('close', () => {
        clearTimeout(relogio);
        resolve(resultado || { ok: false, erro: 'o roteiro parou sem resultado' + (erros ? ': ' + erros.trim().split('\n').pop().slice(0, 200) : '') });
      });
    });
  }
}

module.exports = { iniciarAlterdata, periodo };
