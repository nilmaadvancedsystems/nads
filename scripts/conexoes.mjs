#!/usr/bin/env node
// Trava das conexões do nads. Decisão do usuário (2026-09-28): o nads usa o MESMO banco da
// conferencia-nilma.web.app, e mais nada. Exceção liberada pelo Vitor (2026-09-29): o Creditor lê o
// Drive do escritório pelo Entregas (app Pendências), SÓ em extratudo/dados/drive.firestore.ts: o mapa
// das pastas, o pedido ao robô e o download da cópia temporária (o único fetch permitido).
// Mais uma, liberada pelo Vitor (2026-09-30, "Pedir extratos"), no mesmo arquivo: ler o cadastro de clientes
// do Entregas (e-mails e telefone) e pôr o pedido de e-mail na fila do robô (solicitacoesEmail).
// Esta checagem falha se:
//  1. aparecer dependência de rede fora do permitido (só "firebase", e só no apps/web);
//  2. código fora de apps/web/src/aplicativos/<app>/dados/*.firestore.ts importar/usar Firebase;
//  3. qualquer código fizer fetch/XHR/WebSocket para fora;
//  4. o firebase.json (só em apps/web) tiver algo além de "hosting", ou houver arquivo de regras do banco.
// Não edite a lista pra passar: se precisar de outra conexão, pergunte ao usuário.
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PACOTES_PROIBIDOS = /^(firebase-admin|@firebase\/.*|googleapis|@google\/.*|@google-cloud\/.*|openai|@anthropic-ai\/.*|axios)$/;
const ONDE_PODE_FIREBASE = /[\\/]apps[\\/]web[\\/]src[\\/]aplicativos[\\/][^\\/]+[\\/]dados[\\/][^\\/]+\.firestore\.ts$/;
const TEXTOS_FIREBASE = [/from\s+['"]firebase(\/[a-z-]+)?['"]/, /\b(getFirestore|initializeFirestore|firebase\.firestore)\b/, /\binitializeApp\s*\(/, /firebaseio\.com/];
const TEXTOS_REDE = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bnew\s+WebSocket\b/, /\bsendBeacon\b/, /\bEventSource\b/];
// o download da cópia que o robô do Entregas publica (e só dela: o arquivo confere o endereço antes)
const ONDE_PODE_FETCH = /[\\/]apps[\\/]web[\\/]src[\\/]aplicativos[\\/]extratudo[\\/]dados[\\/]drive\.firestore\.ts$/;

const achados = [];
const ignorar = new Set(['node_modules', '.git', 'dist', 'dist-sites', 'dist-tipos', '.claude', 'docs', '.firebase']);

function varrer(dir, fn) {
  for (const nome of fs.readdirSync(dir)) {
    if (ignorar.has(nome)) continue;
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) varrer(p, fn);
    else fn(p);
  }
}

// 1) dependências
varrer(raiz, p => {
  if (path.basename(p) !== 'package.json') return;
  const rel = path.relative(raiz, p);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const campo of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const dep of Object.keys(j[campo] || {})) {
      if (PACOTES_PROIBIDOS.test(dep)) achados.push(rel + ': dependência proibida "' + dep + '"');
      if (dep === 'firebase' && rel !== path.join('apps', 'web', 'package.json')) achados.push(rel + ': "firebase" só pode estar no apps/web');
    }
  }
});

// 2) e 3) código-fonte (comentários podem citar o Firestore; código não)
function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length));
}
varrer(raiz, p => {
  if (!/\.(ts|tsx|js|mjs|cjs)$/.test(p) || /\.test\.tsx?$/.test(p) || /[\\/]__legado__[\\/]/.test(p) || /[\\/]scripts[\\/]conexoes\.mjs$/.test(p)) return;
  const rel = path.relative(raiz, p);
  const linhas = semComentarios(fs.readFileSync(p, 'utf8')).split('\n');
  const podeFirebase = ONDE_PODE_FIREBASE.test(p);
  linhas.forEach((l, i) => {
    if (!podeFirebase) for (const re of TEXTOS_FIREBASE) if (re.test(l)) achados.push(rel + ':' + (i + 1) + ': Firebase fora de dados/*.firestore.ts ("' + re.source + '")');
    for (const re of TEXTOS_REDE) {
      if (!re.test(l)) continue;
      if (re === TEXTOS_REDE[0] && ONDE_PODE_FETCH.test(p)) continue;
      achados.push(rel + ':' + (i + 1) + ': chamada de rede ("' + re.source + '")');
    }
  });
});

// 4) firebase.json: um só, em apps/web, e só com hospedagem (regras e funções do banco nunca se
//    publicam daqui). Também não pode haver arquivo de regras do banco no repositório.
const ONDE_PODE_FIREBASE_JSON = path.join('apps', 'web', 'firebase.json');
varrer(raiz, p => {
  const nome = path.basename(p);
  const rel = path.relative(raiz, p);
  if (/\.rules$/.test(nome)) achados.push(rel + ': arquivo de regras do banco não pode ficar no repositório');
  if (nome !== 'firebase.json') return;
  if (rel !== ONDE_PODE_FIREBASE_JSON) { achados.push(rel + ': o firebase.json só pode ficar em ' + ONDE_PODE_FIREBASE_JSON); return; }
  const extras = Object.keys(JSON.parse(fs.readFileSync(p, 'utf8'))).filter(k => k !== 'hosting');
  if (extras.length) achados.push(rel + ': só "hosting" é permitido (achei: ' + extras.join(', ') + ') — regras e funções do banco não se publicam daqui');
});

if (achados.length) {
  console.error('conexoes: ' + achados.length + ' achado(s):');
  for (const a of achados) console.error('  ' + a);
  process.exit(1);
}
// o download do Drive só pode ir para a cópia do robô do Entregas
const drive = path.join(raiz, 'apps', 'web', 'src', 'aplicativos', 'extratudo', 'dados', 'drive.firestore.ts');
if (fs.existsSync(drive) && !/url\.startsWith\(LINK_DO_ROBO\)/.test(fs.readFileSync(drive, 'utf8'))) {
  console.error('conexoes: drive.firestore.ts precisa conferir o endereço (url.startsWith(LINK_DO_ROBO)) antes do fetch');
  process.exit(1);
}
console.log('conexoes: ok — o Firestore da Conferência e (só no drive.firestore.ts) o Drive pelo Entregas, só em dados/*.firestore.ts; firebase.json só com hospedagem.');
