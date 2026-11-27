// O Claude do PC do escritório entendendo o cliente do WhatsApp (27/11/2026, o dono: "conecta um chat do claude ao robo
// (esse claude do escritorio) sem api pra ver").
//
// O robô do WhatsApp roda na nuvem, que não tem o Claude. Quando o cliente escreve com as próprias palavras ("me manda o
// DAS de outubro") e a chave "Entender com o Claude do escritório" está ligada (config/whatsapp.ia), o robô da nuvem deixa
// a pergunta em whatsappInterpretacoes/{id} { status: 'pendente', pergunta } e espera até 25 s. Aqui (claude-do-pc.js),
// cada pergunta vira um `claude -p` da assinatura (sem API), como o atendente da Consulta rápida:
//   - SEM nenhuma ferramenta (`--tools ""`), sem MCP, numa pasta vazia, sem guardar sessão: o Claude não vê banco,
//     arquivo, telefone nem internet; só o nome da empresa e o texto do cliente;
//   - a resposta é só a opção do menu ({"opcao": N}); a regra (core: whatsappAtendimento.ts › opcaoDoClaude) confere.
// O robô da nuvem apaga o pedido depois de ler a resposta. O banco é lido pelo admin SDK (sem regra nova).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const W = require('./gerado/whatsapp');

const CLAUDE = process.env.CLAUDE_EXE || path.join(os.homedir(), '.local', 'bin', 'claude.exe');
const COLECAO = 'whatsappInterpretacoes';
const MODELO = 'haiku';                 // só classificar: o mais rápido
// escrever a resposta ao cliente (27/11/2026: "quero que o claude realmente escreva"): o sonnet, que escreve melhor
const MODELO_QUE_ESCREVE = process.env.WHATSAPP_CLAUDE_MODELO || 'sonnet';
const LIMITE_MS = 20000;                // classificar; o robô da nuvem desiste em ESPERA_DO_CLAUDE_MS
const LIMITE_PARA_ESCREVER_MS = 35000;
const PASTA = path.join(os.tmpdir(), 'nilma-whatsapp');
const VELHO_MS = 10 * 60000;

function ambienteLimpo() {
  const env = Object.assign({}, process.env);
  Object.keys(env).forEach(k => { if (/^CLAUDE_?CODE|^CLAUDECODE$|^ANTHROPIC_/.test(k)) delete env[k]; });
  return env;
}

/** Os argumentos do `claude -p`, sem ferramenta nenhuma: 'escrever' (a resposta ao cliente) ou só classificar. */
function argumentos(modo) {
  const escrever = modo === 'escrever';
  return ['-p', '--model', escrever ? MODELO_QUE_ESCREVE : MODELO, '--system-prompt', escrever ? W.INSTRUCOES_DO_ESCRITOR : W.INSTRUCOES_DO_CLAUDE, '--tools', '', '--strict-mcp-config',
    '--permission-mode', 'dontAsk', '--no-session-persistence', '--setting-sources', 'project', '--disable-slash-commands',
    '--output-format', 'text'];
}

/** Pergunta ao Claude deste PC; devolve a saída (texto) ou erro. `rodar` é trocado no teste. */
function perguntar(pergunta, rodar, modo) {
  if (rodar) return rodar(pergunta, modo);
  const limite = modo === 'escrever' ? LIMITE_PARA_ESCREVER_MS : LIMITE_MS;
  fs.mkdirSync(PASTA, { recursive: true });
  return new Promise((ok, falha) => {
    const filho = spawn(CLAUDE, argumentos(modo), { cwd: PASTA, env: ambienteLimpo(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let saida = '';
    let erro = '';
    const relogio = setTimeout(() => { try { filho.kill(); } catch (e) { /* segue */ } falha(new Error('o Claude passou de ' + Math.round(limite / 1000) + ' s')); }, limite);
    filho.stdout.on('data', b => { saida += String(b); });
    filho.stderr.on('data', b => { erro += String(b); });
    filho.on('error', err => { clearTimeout(relogio); falha(err); });
    filho.on('close', code => { clearTimeout(relogio); if (code === 0) ok(saida); else falha(new Error((erro || 'o Claude terminou com o código ' + code).slice(0, 200))); });
    filho.stdin.on('error', () => {});
    filho.stdin.end(pergunta);
  });
}

/** Atende um pedido: pega numa transação (dois PCs não fazem o mesmo), pergunta e grava a opção. */
async function atender(db, ref, { log, rodar } = {}) {
  const pegou = await db.runTransaction(async tx => {
    const s = await tx.get(ref);
    if (!s.exists || s.get('status') !== 'pendente') return null;
    tx.update(ref, { status: 'interpretando', pcEm: new Date().toISOString() });
    return s.data();
  });
  if (!pegou) return null;
  try {
    const modo = pegou.modo === 'escrever' ? 'escrever' : 'classificar';
    const saida = await perguntar(String(pegou.pergunta || '').slice(0, 8000), rodar, modo);
    if (modo === 'escrever') {
      // a nuvem confere a resposta (respostaDoEscritor): aqui só devolve o que o Claude escreveu
      await ref.update({ status: 'feito', saida: String(saida || '').slice(0, 4000), feitoEm: new Date().toISOString() });
      if (log) log('whatsapp: o Claude escreveu a resposta ao cliente');
      return saida;
    }
    const opcao = W.opcaoDoClaude(saida);
    await ref.update({ status: 'feito', opcao, feitoEm: new Date().toISOString() });
    if (log) log('whatsapp: o Claude entendeu a mensagem do cliente como', opcao === null ? 'nenhuma opção' : 'a opção ' + opcao);
    return opcao;
  } catch (err) {
    await ref.update({ status: 'erro', erro: String(err.message || err).slice(0, 200) }).catch(() => {});
    if (log) log('whatsapp: o Claude não respondeu:', err.message);
    return null;
  }
}

/** Liga no claude-do-pc.js: escuta só os pedidos pendentes (lê só o que muda) e limpa os esquecidos. */
function iniciarWhatsappClaude({ db, log }) {
  const pendentes = () => db.collection(COLECAO).where('status', '==', 'pendente');
  const parar = pendentes().onSnapshot(snap => {
    snap.docChanges().filter(m => m.type === 'added').forEach(m => { atender(db, m.doc.ref, { log }).catch(err => log('whatsapp: falha no Claude:', err.message)); });
  }, err => log('whatsapp: não escutei os pedidos do Claude:', err.message));
  // o que ficou para trás (o robô da nuvem caiu antes de apagar): some depois de 10 min
  const faxina = setInterval(async () => {
    try {
      const velhos = await db.collection(COLECAO).where('criadoEm', '<', new Date(Date.now() - VELHO_MS).toISOString()).limit(50).get();
      for (const d of velhos.docs) await d.ref.delete().catch(() => {});
    } catch (e) { /* tenta de novo depois */ }
  }, VELHO_MS);
  log('whatsapp: o Claude do escritório entende as mensagens dos clientes (quando a chave estiver ligada)');
  return () => { parar(); clearInterval(faxina); };
}

module.exports = { iniciarWhatsappClaude, atender, argumentos, COLECAO };

// Sozinho, fora do claude-do-pc.js (27/11/2026, o dono: "consegue rodar no meu zephyrus apenas por enquanto?"): só esta
// parte, num PC que tenha o Claude Code logado, enquanto o PC do escritório não pega o código novo. Rodar:
//   set CLAUDE_EXE=<caminho do claude.exe>   (se não for o ~/.local/bin/claude.exe)
//   node robo/whatsapp-claude.js
// Dois PCs juntos não atrapalham: a transação em atender() deixa cada pedido com um só.
if (require.main === module) {
  const log = (...m) => console.log(new Date().toLocaleString('pt-BR'), '[whatsapp-claude]', ...m);
  const db = require('./firestore-client').getDb('entregas-2e5e2');
  const parar = iniciarWhatsappClaude({ db, log });
  const sair = () => { parar(); process.exit(0); };
  process.on('SIGINT', sair);
  process.on('SIGTERM', sair);
}
