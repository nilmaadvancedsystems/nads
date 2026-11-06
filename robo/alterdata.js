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
const numeros = require('./alterdata-numeros');
const { garantirTelaAtiva } = require('./sessao-no-console');

const DRIVE = process.env.ARQUIVO_DRIVE || 'G:\\Meu Drive';
const ONDE = process.env.ARQ_SO_SERVIDOR === '1' ? 'servidor' : 'pc';
// a pasta de trabalho de cada pedido: no servidor, o disco local (o G: de lá está em "transmitir" e leva ~30 s por arquivo;
// os arquivos sobem direto para o banco, a pasta é só o rascunho); no PC, o Drive, como no teste de 04/11/2026
const PASTA_PEDIDOS = process.env.ALTERDATA_PEDIDOS
  || (ONDE === 'servidor' ? 'D:\\nads-dados\\alterdata\\pedidos' : path.join(DRIVE, 'Claudio Secretario', 'Alterdata', 'pedidos'));
// o Python do servidor fica em D:\Programas\Python313 (fora do PATH); no PC, o do PATH
const PYTHON = process.env.PYTHON_EXE || ['D:\\Programas\\Python313\\python.exe'].find(p => fs.existsSync(p)) || 'python';
const ROTEIROS = { balancete: path.join(__dirname, 'alterdata_balancete.py'), razao: path.join(__dirname, 'alterdata_razao.py'), importar: path.join(__dirname, 'alterdata_importar.py') };
const ROTEIRO_ESTADO = path.join(__dirname, 'alterdata_estado.py');
// a tela de atualizações do Alterdata ao abrir: o robô clica em "Ver depois" (05/11/2026)
const ROTEIRO_AVISOS = path.join(__dirname, 'alterdata_avisos.py');
// o login do robô (04/11/2026, Vitor: "tem um login criado especificamente para o robo, onde ele tem permissão so de puxar
// relatorio"): a credencial fica só no Gerenciador de Credenciais do Windows (nads-alterdata-robo); sem ela, o robô só espera
const ROTEIRO_LOGIN = path.join(__dirname, 'alterdata_login.py');
const WCONT = process.env.ALTERDATA_WCONT || 'C:\\Program Files (x86)\\Alterdata\\Pack\\Diamond\\Contabil\\wcont.exe';
const ABRIR_DE_NOVO_MS = 15 * 60 * 1000;
const LIMITE_MS = 9 * 60 * 1000;
const PEDACO = 700 * 1000;   // caracteres de base64 por pedaço (o documento do Firestore vai até 1 MiB)
const VERIFICAR_MS = 60 * 1000;
const ASSENTAR_MS = 60 * 1000;

const agora = () => new Date().toISOString();
const ESTADOS = { ok: 'aberto e logado', login: 'na tela de login', abrindo: 'entrando (tela de abertura)', fechado: 'fechado', dois: 'aberto duas vezes', erro: 'sem resposta' };

/** Se já tem um Contábil (wcont.exe) rodando nesta máquina, mesmo sem janela à mostra (05/11/2026, Vitor: "o robo tem que
 *  verificar se o contabil ja ta aberto antes de abrir outro"). Na dúvida (o tasklist falhou), diz que sim: não abre. */
function contabilRodando() {
  return new Promise(resolve => execFile('tasklist', ['/fi', 'imagename eq wcont.exe', '/fo', 'csv', '/nh'], { windowsHide: true, timeout: 30 * 1000 },
    (err, out) => resolve(err ? true : /wcont\.exe/i.test(String(out || '')))));
}

/** O Contábil desta máquina: ok | login | fechado | dois | erro (sem mexer em nada). */
function estadoDoContabil() {
  return new Promise(resolve => {
    // 90 s: o roteiro leva 0,1 s, mas no servidor ocupado o Python às vezes demora mais de 30 s só para abrir
    execFile(PYTHON, ['-I', ROTEIRO_ESTADO], { cwd: __dirname, windowsHide: true, timeout: 90 * 1000 }, (err, out, errs) => {
      const m = String(out || '').match(/ESTADO:\s*(\w+)/);
      const c = String(out || '').match(/CAMPOS:\s*(.+)/);
      const d = String(out || '').match(/DIAG:\s*(.+)/);
      const aviso = String(out || '').match(/AVISO:\s*(\d+)\s*(.*)/);
      if (c && d) d[1] = d[1] + ' · campos: ' + c[1];
      // o porquê, para o log: o DIAG do roteiro, ou o fim do erro do Python, ou o prazo
      const porque = d ? d[1].trim() : err ? (err.killed ? 'passou de 90 s' : String(errs || err.message).trim().split('\n').pop().slice(0, 200)) : '';
      resolve({ estado: m ? m[1] : 'erro', porque, prazo: !m && !!err && !!err.killed, aviso: aviso ? { janela: aviso[1], qual: aviso[2].trim() } : null });
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
function rodarRoteiro(relatorio, a, passo, sinal, clique = () => {}) {
  const args = relatorio === 'razao' ? [String(a.codigo), a.inicio, a.fim, a.pasta, a.destino]
    : relatorio === 'importar' ? [String(a.codigo), a.lote, a.destino]
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
        const c = l.match(/^CLIQUE:\s*(.+)$/);
        if (c) void clique(c[1]);
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
  let semResposta = 0;
  let okDesde = 0;
  // a tela de atualizações: um clique em "Ver depois" por janela (se não fechar, não insiste; o log diz)
  const avisosClicados = new Set();
  async function verDepois(aviso) {
    // a mesma janela não leva outro clique se o primeiro deu; se não deu (sem tela ativa, por exemplo), tenta na checagem seguinte
    if (avisosClicados.has(aviso.janela)) return false;
    const r = await rodarPy(ROTEIRO_AVISOS, [aviso.janela], 60 * 1000);
    let res = { ok: false, erro: 'o roteiro parou sem resultado' };
    try { const m = r.out.match(/RESULTADO:\s*(\{.*\})/); if (m) res = JSON.parse(m[1]); } catch (_) { /* mal escrito */ }
    const ok = !!res.ok;
    if (ok) avisosClicados.add(aviso.janela);
    log('Alterdata: a tela de atualizações do Contábil (' + aviso.qual + '): ' + (ok ? 'cliquei em "Ver depois"' : 'não fechou com o "Ver depois" (' + res.erro + ')'));
    return ok;
  }

  let ultimoConsole = '';
  async function verificar() {
    // no servidor: a sessão do robô desconectada (o RDP fechado) vai para o console, senão nenhum clique funciona
    if (ONDE === 'servidor') {
      const c = await garantirTelaAtiva().catch(e => 'não consegui ver a sessão: ' + e.message);
      if (c && c !== ultimoConsole) log('Alterdata: ' + c);
      ultimoConsole = c;
    }
    let r = await estadoDoContabil();
    if (r.aviso && await verDepois(r.aviso)) r = await estadoDoContabil();
    // com a tela de atualizações na frente, o Contábil não está pronto para relatório
    if (r.aviso && r.estado === 'ok') r.estado = 'abrindo';
    // um prazo estourado sozinho não muda o estado (o servidor às vezes demora a abrir o Python); dois seguidos, sim
    semResposta = r.prazo ? semResposta + 1 : 0;
    const novo = r.prazo && semResposta < 2 && estado ? estado : r.estado;
    const porque = r.porque;
    if (novo !== estado) {
      log('Alterdata: o Contábil deste ' + ONDE + ' está ' + ESTADOS[novo] + (porque ? ' (' + porque + ')' : ''));
      painel.modulo('alterdata', 'Alterdata', novo === 'ok', 'o Contábil está ' + ESTADOS[novo]);
    }
    estado = novo;
    // pronto desde quando: logo depois de abrir (o login, o Guia) o Contábil ainda carrega e não responde (05/11/2026: o
    // pedido feito na hora deu "Window is not responding"); o pedido só é pego com ASSENTAR_MS de Contábil pronto
    if (estado !== 'ok') okDesde = 0; else if (!okDesde) okDesde = Date.now();
    if (estado === 'ok') loginParado = '';   // alguém (ou o robô) entrou: se o login tinha falhado, vale tentar de novo depois
    await estadoDoc.set({ ligado: true, maquinas: { [ONDE]: { contabil: estado, login: loginParado, em: agora() } }, atualizadoEm: agora() }, { merge: true }).catch(() => {});
    if (estado === 'login' || estado === 'fechado') void entrarSozinho(estado);
    return estado;
  }

  // O login do robô: só com a credencial nads-alterdata-robo no Gerenciador de Credenciais desta sessão. Contábil fechado:
  // abre o wcont.exe (no máximo a cada 15 min); tela de login: UMA tentativa. Se falhar, para (loginParado) até alguém
  // entrar na mão: nunca tenta de novo em laço, a conta pode ser bloqueada.
  let loginParado = '';
  let entrando = false;
  let abertoEm = 0;
  let avisouRodando = false;
  const rodarPy = (arquivo, args, ms) => new Promise(resolve => execFile(PYTHON, ['-I', arquivo, ...args], { cwd: __dirname, windowsHide: true, timeout: ms },
    (err, out) => resolve({ err, out: String(out || '') })));
  let credencialVistaEm = 0;
  async function entrarSozinho(como) {
    if (entrando || loginParado) return;
    entrando = true;
    try {
      // a credencial: vista uma vez a cada 10 min (o Python leva uns segundos para abrir; antes era a cada vez)
      if (Date.now() - credencialVistaEm > 10 * 60 * 1000) {
        const tem = await rodarPy(ROTEIRO_LOGIN, ['--tem'], 90 * 1000);
        const temCredencial = /TEM:\s*sim/.test(tem.out);
        // no banco (robo/alterdata.maquinas.{onde}.credencial), para quem olha saber se o robô achou a credencial
        await estadoDoc.set({ maquinas: { [ONDE]: { credencial: temCredencial ? 'sim' : /TEM:\s*nao/.test(tem.out) ? 'nao' : 'erro' } } }, { merge: true }).catch(() => {});
        if (!temCredencial) return;   // sem a credencial: espera alguém entrar
        credencialVistaEm = Date.now();
      }
      if (como === 'fechado') {
        if (Date.now() - abertoEm < ABRIR_DE_NOVO_MS || !fs.existsSync(WCONT)) return;
        // já tem um Contábil rodando (abrindo, travado ou sem janela nesta sessão): não abre outro
        if (await contabilRodando()) {
          if (!avisouRodando) log('Alterdata: o Contábil deste ' + ONDE + ' parece fechado, mas o wcont.exe está rodando; não abro outro');
          avisouRodando = true;
          return;
        }
        avisouRodando = false;
        abertoEm = Date.now();
        log('Alterdata: o Contábil deste ' + ONDE + ' estava fechado; abrindo para o robô entrar');
        spawn(WCONT, [], { cwd: path.dirname(WCONT), detached: true, stdio: 'ignore' }).unref();
        // 05/11/2026 ("o robo demora muito para coloca a senha"): não espera a checagem do minuto; o roteiro de login
        // fica olhando e entra assim que a tela de login aparece
      }
      log('Alterdata: entrando no Contábil deste ' + ONDE + ' com o usuário do robô');
      const r = await rodarPy(ROTEIRO_LOGIN, como === 'fechado' ? ['--esperar', '180'] : [], 300 * 1000);
      const m = r.out.match(/RESULTADO:\s*(\{.*\})/);
      let res = { ok: false, erro: 'o roteiro de login parou sem resultado' };
      try { if (m) res = JSON.parse(m[1]); } catch (_) { /* mal escrito */ }
      if (res.ok) { log('Alterdata: o robô entrou no Contábil'); setTimeout(() => void verificar(), 5000); return; }
      // a tela de login não apareceu (o Contábil abriu de outro jeito ou travou): não é tentativa de senha, não para
      if (res.semTela) { log('Alterdata: abri o Contábil, mas a tela de login não apareceu em 3 min'); return; }
      loginParado = res.erro || 'não deu';
      log('Alterdata: o login do robô não deu (' + loginParado + '); não tento de novo até alguém entrar no Contábil');
      painel.modulo('alterdata', 'Alterdata', false, 'o login do robô não deu: ' + loginParado);
      await estadoDoc.set({ maquinas: { [ONDE]: { login: loginParado, em: agora() } } }, { merge: true }).catch(() => {});
    } finally { entrando = false; }
  }

  const banco = {
    async ler(id) { const s = await pedidos.doc(id).get(); return s.exists ? s.data() : null; },
    async pegar(id) {
      if (await verificar() !== 'ok') return null;   // fica para a máquina que estiver com o Contábil pronto
      // acabou de abrir: espera assentar e tenta de novo (o pedido continua pendente)
      const falta = ASSENTAR_MS - (Date.now() - okDesde);
      if (falta > 0) { setTimeout(() => fila.chegou(id), falta + 1000).unref(); return null; }
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
    // os números lidos (05/11/2026): pedidosAlterdata/{id}/numeros/{balancete | razao | razao-nnn}; só no pedido mensal
    async importar(id, rel, arquivo, p) {
      if ((p.tipo || 'balancete') !== 'mensal') return null;
      const buf = fs.readFileSync(arquivo);
      const col = pedidos.doc(id).collection('numeros');
      if (rel === 'balancete') {
        const contas = numeros.lerBalancete(buf);
        if (!contas.length) throw new Error('não achei conta nenhuma no balancete');
        await col.doc('balancete').set({ codigo: Number(p.codigo), competencia: p.competencia, contas, n: contas.length, em: agora() });
        return { contas: contas.length };
      }
      const r = numeros.lerRazao(buf);
      const pedacos = numeros.emPedacos(r.lancamentos);
      for (let i = 0; i < pedacos.length; i++) await col.doc('razao-' + String(i).padStart(3, '0')).set({ n: i, lancamentos: pedacos[i] });
      await col.doc('razao').set({ codigo: Number(p.codigo), competencia: p.competencia, contas: r.contas, n: r.lancamentos.length, pedacos: pedacos.length, em: agora() });
      return { contas: r.contas.length, lancamentos: r.lancamentos.length };
    },
    // a mesma planilha (sha256) já importada nesta empresa: não importa de novo (06/11/2026)
    async importadoIgual(id, codigo, sha256) {
      const s = await pedidos.where('codigo', '==', codigo).get();
      const igual = s.docs.find(d => d.id !== id && d.data().tipo === 'importar' && d.data().sha256 === sha256 && ['pronto', 'trabalhando'].includes(d.data().status));
      return igual ? { id: igual.id, lote: igual.data().lote || '' } : null;
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
