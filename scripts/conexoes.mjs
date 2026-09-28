#!/usr/bin/env node
// Trava das conexões do nads. Decisão do usuário (2026-09-28): o nads usa o MESMO banco da
// conferencia-nilma.web.app, e mais nada. Esta checagem falha se:
//  1. aparecer dependência de rede fora do permitido (só "firebase", e só no apps/web);
//  2. código fora de apps/web/src/dados/*.firestore.ts importar/usar Firebase;
//  3. qualquer código fizer fetch/XHR/WebSocket para fora;
//  4. o firebase.json tiver algo além de "hosting" (impede publicar regras/funções do banco).
// Não edite a lista pra passar: se precisar de outra conexão, pergunte ao usuário.
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PACOTES_PROIBIDOS = /^(firebase-admin|@firebase\/.*|googleapis|@google\/.*|@google-cloud\/.*|openai|@anthropic-ai\/.*|axios)$/;
const ONDE_PODE_FIREBASE = /[\\/]apps[\\/]web[\\/]src[\\/]dados[\\/][^\\/]+\.firestore\.ts$/;
const TEXTOS_FIREBASE = [/from\s+['"]firebase(\/[a-z-]+)?['"]/, /\b(getFirestore|initializeFirestore|firebase\.firestore)\b/, /\binitializeApp\s*\(/, /firebaseio\.com/];
const TEXTOS_REDE = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bnew\s+WebSocket\b/, /\bsendBeacon\b/, /\bEventSource\b/];

const achados = [];
const ignorar = new Set(['node_modules', '.git', 'dist', 'dist-tipos', '.claude', 'docs', '.firebase']);

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
    for (const re of TEXTOS_REDE) if (re.test(l)) achados.push(rel + ':' + (i + 1) + ': chamada de rede ("' + re.source + '")');
  });
});

// 4) firebase.json: só hospedagem
const fj = path.join(raiz, 'firebase.json');
if (fs.existsSync(fj)) {
  const extras = Object.keys(JSON.parse(fs.readFileSync(fj, 'utf8'))).filter(k => k !== 'hosting');
  if (extras.length) achados.push('firebase.json: só "hosting" é permitido (achei: ' + extras.join(', ') + ') — regras e funções do banco não se publicam daqui');
}

if (achados.length) {
  console.error('conexoes: ' + achados.length + ' achado(s):');
  for (const a of achados) console.error('  ' + a);
  process.exit(1);
}
console.log('conexoes: ok — só o Firestore da Conferência, só em dados/*.firestore.ts; firebase.json só com hospedagem.');
