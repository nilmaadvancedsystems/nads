#!/usr/bin/env node
// Inventário de camadas de um arquivo legado (HTML de arquivo único ou .js).
//
// Lê os <script> embutidos, acha cada função (com nome, ou anônima grande
// dentro de um evento) e marca o que ela faz: banco, arquivo, tela, eventos,
// navegador, estado global... Com isso sugere a camada MVVM de destino.
// É um ponto de partida: quem migra confere e decide.
//
// Uso:
//   node inventario.mjs <arquivo.html|.js> [--json] [--min-anon 15]
//   (rode `npm i` nesta pasta uma vez)

import fs from 'node:fs';
import path from 'node:path';

let acorn, loose, walk;
try {
  acorn = await import('acorn');
  loose = await import('acorn-loose');
  walk = await import('acorn-walk');
} catch {
  console.error('Faltam as dependências. Rode uma vez:  npm i  (na pasta scripts/ da skill)');
  process.exit(2);
}

const args = process.argv.slice(2);
const arquivo = args.find(a => !a.startsWith('--'));
const querJson = args.includes('--json');
const minAnon = Number(args[args.indexOf('--min-anon') + 1]) || 15;
if (!arquivo) {
  console.error('Uso: node inventario.mjs <arquivo.html|.js> [--json] [--min-anon 15]');
  process.exit(1);
}
const texto = fs.readFileSync(arquivo, 'utf8');

// ---------- 1. blocos de código (com a linha onde começam no arquivo) ----------
function blocos(src, nome) {
  if (!/\.html?$/i.test(nome)) return [{ codigo: src, linha0: 0 }];
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue;                       // externo
    if (/type\s*=\s*["'](?!text\/javascript|module)[^"']+["']/i.test(attrs)) continue; // JSON, template
    const antes = src.slice(0, m.index + m[0].indexOf('>') + 1);
    const linha0 = antes.split('\n').length - 1;
    out.push({ codigo: m[2], linha0 });
  }
  return out;
}

// ---------- 2. sinais: o que o trecho faz ----------
const SINAIS = {
  banco:    /\.(collection|doc)\s*\(|onSnapshot|runTransaction|\.batch\s*\(\)|\b(getDocs?|setDoc|updateDoc|addDoc|deleteDoc|writeBatch)\s*\(|firebase\.firestore|FieldValue|serverTimestamp/,
  auth:     /firebase\.auth|\bauth\(\)|signIn\w*\(|onAuthStateChanged|currentUser|signOut\(/,
  rede:     /\bfetch\s*\(|XMLHttpRequest|sendBeacon/,
  arquivo:  /XLSX\.|FileReader|\.arrayBuffer\s*\(|TextDecoder|sheet_to_json|new Blob\(|\.readAsText/,
  telaLe:   /getElementById|querySelector(All)?\s*\(|\$\(\s*['"`]|\.value\b|\.checked\b|\.files\b|\.dataset\./,
  telaEscreve: /\.innerHTML\s*[+]?=|outerHTML|insertAdjacentHTML|\.textContent\s*=|\.innerText\s*=|classList\.|appendChild|\.hidden\s*=|\.style\.|setAttribute\(|removeChild|\.replaceChildren/,
  html:     /['"`]\s*<\/?[a-z][a-z0-9-]*[\s>/'"`]/i,
  eventos:  /addEventListener|\.on(click|change|input|submit|keydown|keyup|load)\s*=/,
  navegador: /localStorage|sessionStorage|indexedDB|\blocation\.|history\.(push|replace)State/,
  retorno:  /\b(toast|modal|alerta|alert|confirm|prompt)\s*\(/,
  tempo:    /setTimeout|setInterval|requestAnimationFrame/,
};

function sinaisDe(trecho) {
  const s = {};
  for (const [k, re] of Object.entries(SINAIS)) if (re.test(trecho)) s[k] = true;
  return s;
}

// ---------- 3. análise ----------
const funcoes = [];
const estadoGlobal = new Map();   // nome -> linha
const constantes = new Map();
const infra = new Map();
const INFRA = /^(db|auth|app|storage|messaging|firebaseConfig|firebase\w*|fs|firestore)$/;
const bibliotecas = [];
let linhasTotais = texto.split('\n').length;

function parse(codigo) {
  const op = { ecmaVersion: 'latest', sourceType: 'script', locations: true,
    allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, allowHashBang: true };
  try { return { ast: acorn.parse(codigo, op), tolerante: false }; }
  catch { return { ast: loose.parse(codigo, op), tolerante: true }; }
}

// corpo "de cima": o programa mais o corpo de cada IIFE solta no topo
// (function(){ … })() — o jeito de todos os nossos HTML. A IIFE em si não
// entra no inventário: ela é só o embrulho.
const embrulhos = new Set();
function corpoDeCima(ast) {
  const corpo = [];
  for (const st of ast.body) {
    corpo.push(st);
    if (st.type !== 'ExpressionStatement') continue;
    let e = st.expression;
    if (e.type === 'UnaryExpression') e = e.argument;            // !function(){}()
    if (e.type !== 'CallExpression') continue;
    const f = e.callee.type === 'MemberExpression' ? e.callee.object : e.callee; // (function(){}).call(this)
    if (f && /Function/.test(f.type) && f.body.type === 'BlockStatement') { embrulhos.add(f); corpo.push(...f.body.body); }
  }
  return corpo;
}

const ehFuncao = n => n && /^(FunctionExpression|ArrowFunctionExpression|FunctionDeclaration)$/.test(n.type);

function nomeDoContexto(node, ancestrais, codigo) {
  if (node.type === 'FunctionDeclaration' && node.id) return node.id.name;
  const pai = ancestrais[ancestrais.length - 2];
  if (!pai) return null;
  if (pai.type === 'VariableDeclarator' && pai.id.type === 'Identifier') return pai.id.name;
  if (pai.type === 'AssignmentExpression') return codigo.slice(pai.left.start, pai.left.end).replace(/\s+/g, ' ');
  if ((pai.type === 'Property' || pai.type === 'MethodDefinition') && pai.key)
    return pai.key.name || pai.key.value || null;
  if (pai.type === 'CallExpression') {
    // callback: addEventListener('click', …), onSnapshot(…), forEach(…)
    const callee = codigo.slice(pai.callee.start, pai.callee.end).replace(/\s+/g, ' ');
    const a0 = pai.arguments[0];
    const rot = a0 && a0.type === 'Literal' ? `('${a0.value}')` : '';
    return `(anônima) ${callee.length > 60 ? '…' + callee.slice(-60) : callee}${rot}`;
  }
  return null;
}

for (const bloco of blocos(texto, arquivo)) {
  if (!bloco.codigo.trim()) continue;
  const { ast } = parse(bloco.codigo);
  const L = n => n.loc.start.line + bloco.linha0;
  // biblioteca colada no HTML (ex.: SheetJS minificado): linhas gigantes.
  // O que começa numa linha dessas não é código do sistema.
  const linhasDoBloco = bloco.codigo.split('\n');
  const minificado = n => (linhasDoBloco[n.loc.start.line - 1] || '').length > 1000;
  const kbMin = Math.round(linhasDoBloco.filter(l => l.length > 1000).reduce((t, l) => t + l.length, 0) / 1024);
  if (kbMin > 50) bibliotecas.push({ linha: bloco.linha0 + 1, tamanho: kbMin * 1024 });

  // de cima: CONSTANTES/tabelas (vão pro core como dados), infraestrutura
  // (db, auth, config do Firebase) e o resto = estado global mutável
  for (const st of corpoDeCima(ast)) {
    if (st.type !== 'VariableDeclaration') continue;
    for (const d of st.declarations) {
      if (d.id.type !== 'Identifier' || ehFuncao(d.init) || minificado(d)) continue;
      const n = d.id.name;
      if (/^[A-Z][A-Z0-9_]*$/.test(n) || /_$/.test(n) && /^[A-Z]/.test(n)) constantes.set(n, L(d));
      else if (INFRA.test(n)) infra.set(n, L(d));
      else if (st.kind !== 'const') estadoGlobal.set(n, L(d));
    }
  }

  walk.fullAncestor(ast, (node, _st, ancestrais) => {
    if (!ehFuncao(node) || embrulhos.has(node) || minificado(node)) return;
    const nome = nomeDoContexto(node, ancestrais, bloco.codigo);
    const linhas = node.loc.end.line - node.loc.start.line + 1;
    const anonima = !nome || nome.startsWith('(anônima)');
    if (anonima && linhas < minAnon) return;                     // callbacks pequenos: ruído
    const trecho = bloco.codigo.slice(node.start, node.end);
    const usa = new Set(), muda = new Set(), chama = new Set();
    walk.simple(node.body, {
      Identifier(n) { if (estadoGlobal.has(n.name)) usa.add(n.name); },
      AssignmentExpression(n) {
        let alvo = n.left;
        while (alvo.type === 'MemberExpression') alvo = alvo.object;
        if (alvo.type === 'Identifier' && estadoGlobal.has(alvo.name)) muda.add(alvo.name);
      },
      CallExpression(n) { if (n.callee.type === 'Identifier') chama.add(n.callee.name); },
    });
    funcoes.push({
      nome: nome || '(anônima)', linha: L(node), linhas, anonima,
      sinais: sinaisDe(trecho), usa: [...usa], muda: [...muda], chama: [...chama],
    });
  });
}

// ---------- 4. o que a função faz por tabela (até 2 chamadas de distância) ----------
// Ex.: na Conferência renderGeral → autoMarcarConferidos → save (grava no
// banco), e padraoPorCfop → emp() (lê a empresa aberta do estado global).
const porNome = new Map(funcoes.filter(f => !f.anonima).map(f => [f.nome, f]));
for (const f of funcoes) f.chama = f.chama.filter(c => porNome.has(c) && c !== f.nome);
const tocaBancoDireto = f => f.sinais.banco || f.sinais.auth;
function caminhos(f, teste, prof = 2, visto = new Set([f.nome])) {
  const achados = [];
  for (const c of f.chama) {
    if (visto.has(c)) continue;
    const g = porNome.get(c);
    if (teste(g)) achados.push(c);
    else if (prof > 1) for (const p of caminhos(g, teste, prof - 1, new Set([...visto, c]))) achados.push(c + ' → ' + p);
  }
  return achados;
}
for (const f of funcoes) {
  f.chamaBanco = caminhos(f, tocaBancoDireto);
  // estado global lido por uma função "acessora" (ex.: emp() devolve dados[atual])
  f.usaVia = caminhos(f, g => g.usa.length > 0 && g.linhas <= 6 && !tocaBancoDireto(g), 1);
}

// ---------- 5. camada sugerida ----------
function camada(f) {
  const s = f.sinais;
  const dados = s.banco || s.auth || s.rede;
  const grava = dados || f.chamaBanco.length > 0;
  const tela = s.telaLe || s.telaEscreve || s.html;
  // handler: callback de evento ou atribuído a .onclick/.onchange…
  const handler = /\.on[a-z]+$|addEventListener|\(anônima\).*\.(on|ao)\b/i.test(f.nome) || (f.anonima && s.eventos);
  const motivos = [];
  if (dados && tela) motivos.push('banco + tela');
  if (s.arquivo && (s.telaEscreve || dados)) motivos.push('arquivo + ' + (dados ? 'banco' : 'tela'));
  if (f.chamaBanco.length && s.telaEscreve && f.linhas > 5) motivos.push('desenha e grava (' + f.chamaBanco.join('; ') + ')');
  if ((handler || s.eventos) && (dados || f.linhas > 40)) motivos.push('evento com lógica dentro (' + f.linhas + ' linhas)');
  if (motivos.length) return { camada: 'MISTA', destino: 'dividir: ' + motivos.join('; ') };

  const estado = [...f.usa, ...f.usaVia.map(v => v + '()')];
  if (dados) return { camada: 'Model', destino: 'repositório (packages/core/<dominio>/repo)' };
  if (!tela && /^(fmt|format|esc|escape|brl|moeda|normaliz|slug|semAcento|dataBR|pad)/i.test(f.nome))
    return { camada: 'Model', destino: 'util (packages/core/formatos) — provavelmente já existe lá' };
  if (s.arquivo || /^(ler|parse|parsear|decod|extrair)/i.test(f.nome))
    return { camada: 'Model', destino: 'arquivo: ler/gerar (packages/core/<dominio>/arquivos)' + (estado.length ? ' — lê estado: ' + estado.join(', ') : '') };
  if (handler || s.eventos || s.retorno || s.tempo || s.navegador || f.muda.length || grava)
    return { camada: 'ViewModel', destino: 'ação/estado do hook da tela (use<Tela>.ts)' };
  if (s.telaEscreve || s.telaLe) return { camada: 'View', destino: 'componente (.tsx)' };
  if (s.html) return { camada: 'View', destino: 'template → JSX' };
  if (estado.length) return { camada: 'Model', destino: 'regra — hoje lê estado global (' + estado.join(', ') + '): passar por parâmetro' };
  return { camada: 'Model', destino: 'regra pura (packages/core/<dominio>/regras) + teste' };
}
for (const f of funcoes) Object.assign(f, camada(f));

// ---------- 6. saída ----------
if (querJson) {
  console.log(JSON.stringify({ arquivo, linhas: linhasTotais, bibliotecas,
    estadoGlobal: Object.fromEntries(estadoGlobal), constantes: Object.fromEntries(constantes),
    infra: Object.fromEntries(infra), funcoes }, null, 2));
  process.exit(0);
}

const ordem = ['MISTA', 'Model', 'ViewModel', 'View'];
const cont = Object.fromEntries(ordem.map(c => [c, funcoes.filter(f => f.camada === c).length]));
const sinaisTxt = s => Object.keys(s).join(', ') || '—';
const lista = a => (a.length ? a.slice(0, 6).join(', ') + (a.length > 6 ? ` +${a.length - 6}` : '') : '—');
const out = [];
out.push(`# Inventário de camadas — ${path.basename(arquivo)}`, '');
out.push(`${linhasTotais} linhas · ${funcoes.length} funções · ` + ordem.map(c => `${c}: ${cont[c]}`).join(' · '), '');
if (bibliotecas.length) out.push(`Bibliotecas coladas no arquivo (ignoradas): ` + bibliotecas.map(b => `linha ${b.linha} (${Math.round(b.tamanho / 1024)} KB)`).join(', '), '');
const nomes = m => [...m].map(([n, l]) => `\`${n}\` (L${l})`).join(' · ');
if (estadoGlobal.size) out.push(`## Estado global (${estadoGlobal.size}) — vira estado dos ViewModels ou parâmetro das regras`, '', nomes(estadoGlobal), '');
if (constantes.size) out.push(`## Constantes e tabelas (${constantes.size}) — dados do domínio (packages/core) ou config da tela`, '', nomes(constantes), '');
if (infra.size) out.push(`## Infraestrutura (${infra.size}) — some: vira packages/core/firebase`, '', nomes(infra), '');
for (const c of ordem) {
  const fs_ = funcoes.filter(f => f.camada === c).sort((a, b) => a.linha - b.linha);
  if (!fs_.length) continue;
  const titulo = { MISTA: 'MISTA — dividir antes de migrar', Model: 'Model (packages/core)', ViewModel: 'ViewModel (hooks)', View: 'View (componentes)' }[c];
  out.push(`## ${titulo} (${fs_.length})`, '');
  out.push('| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |', '|---|---:|---:|---|---|---|');
  for (const f of fs_) {
    const le = [...f.usa, ...f.usaVia.map(v => v + '()')];
    const est = le.length || f.muda.length ? `${lista(le)} / ${lista(f.muda)}` : '—';
    out.push(`| \`${f.nome.replace(/\|/g, '\\|')}\` | ${f.linha} | ${f.linhas} | ${sinaisTxt(f.sinais)}${f.chamaBanco.length ? ' · chama ' + f.chamaBanco.join(', ') : ''} | ${est} | ${f.destino} |`);
  }
  out.push('');
}
console.log(out.join('\n'));
