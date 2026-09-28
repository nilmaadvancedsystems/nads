#!/usr/bin/env node
// Trava do nads: a cópia NÃO fala com banco nem com serviço de fora (regra do usuário).
// Falha se achar Firebase/Google/IA nas dependências, ou no código e no build (dist/)
// qualquer sinal de conexão. Uma linha por achado. Não edite a lista pra passar:
// se precisar de exceção, pergunte ao usuário.
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PACOTES_PROIBIDOS = /^(firebase|firebase-admin|@firebase\/.*|googleapis|@google\/.*|@google-cloud\/.*|openai|@anthropic-ai\/.*|axios)$/;
const TEXTOS_PROIBIDOS = [
  /firebaseio\.com/, /firebaseapp\.com/, /googleapis\.com/, /\bfirestore\b/i, /\binitializeApp\s*\(/,
  /\bfetch\s*\(\s*['"`]https?:/, /\bXMLHttpRequest\b/, /\bnew\s+WebSocket\b/, /\bsendBeacon\b/, /\bEventSource\b/,
];
// comentários que DESCREVEM o original podem citar Firestore; código não.
const PERMITIDO_EM_COMENTARIO = true;

const achados = [];
const ignorar = new Set(['node_modules', '.git', 'dist-tipos', '.claude', 'docs']);

function varrer(dir, fn) {
  for (const nome of fs.readdirSync(dir)) {
    if (ignorar.has(nome)) continue;
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) varrer(p, fn);
    else fn(p);
  }
}

// 1) dependências
varrer(raiz, p => {
  if (path.basename(p) !== 'package.json') return;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const campo of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const dep of Object.keys(j[campo] || {})) if (PACOTES_PROIBIDOS.test(dep)) achados.push(path.relative(raiz, p) + ': dependência proibida "' + dep + '"');
  }
});

// 2) código-fonte e build
function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length));
}
varrer(raiz, p => {
  if (!/\.(ts|tsx|js|mjs|cjs|html)$/.test(p) || /\.test\.tsx?$/.test(p) || /[\\/]__legado__[\\/]/.test(p) || p.endsWith('sem-rede.mjs')) return;
  const bruto = fs.readFileSync(p, 'utf8');
  const txt = PERMITIDO_EM_COMENTARIO && !/[\\/]dist[\\/]/.test(p) ? semComentarios(bruto) : bruto;
  const linhas = txt.split('\n');
  linhas.forEach((l, i) => {
    for (const re of TEXTOS_PROIBIDOS) if (re.test(l)) achados.push(path.relative(raiz, p) + ':' + (i + 1) + ': "' + re.source + '"');
  });
});

if (achados.length) {
  console.error('sem-rede: ' + achados.length + ' achado(s) — o nads não pode falar com banco nem com serviço de fora:');
  for (const a of achados) console.error('  ' + a);
  process.exit(1);
}
console.log('sem-rede: ok — nenhuma dependência nem chamada de rede para fora.');
