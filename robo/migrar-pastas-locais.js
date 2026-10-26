// Migra os dados do robô do AppData para as pastas locais fora dele (pastas-locais.js; 26/10/2026).
//
// Rode por um processo que VÊ os dados de verdade: o AppData que o robô usava quando foi religado pelo Claude para Windows
// é a cópia particular do pacote (…\Packages\Claude_…\LocalCache\Local\…); um terminal aberto pelo Claude vê essa cópia.
// Copia sem sobrescrever (o que já existe no destino fica), e diz o que copiou.
//   node migrar-pastas-locais.js [--de <pasta do controle antigo>] [--simular]
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./pastas-locais');

const arg = (n, padrao) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : padrao; };
const SIMULAR = process.argv.includes('--simular');
const pares = [
  [arg('--de', P.ANTIGO_CONTROLE), P.CONTROLE],
  [path.join(arg('--de-robo', P.ANTIGO_ROBO), 'sieg-perfil'), path.join(P.ROBO, 'sieg-perfil')],
];
const conta = { copiados: 0, jaExistiam: 0, bytes: 0, erros: 0 };
function copiar(de, para) {
  let st; try { st = fs.statSync(de); } catch (e) { return; }
  if (st.isDirectory()) { if (!SIMULAR) fs.mkdirSync(para, { recursive: true }); for (const n of fs.readdirSync(de)) copiar(path.join(de, n), path.join(para, n)); return; }
  if (fs.existsSync(para)) { conta.jaExistiam++; return; }
  try { if (!SIMULAR) { fs.copyFileSync(de, para, fs.constants.COPYFILE_EXCL); fs.utimesSync(para, st.atime, st.mtime); } conta.copiados++; conta.bytes += st.size; }
  catch (e) { conta.erros++; console.log('erro: ' + de + ' → ' + e.message); }
}
for (const [de, para] of pares) {
  if (!fs.existsSync(de)) { console.log('não existe (pulei): ' + de); continue; }
  console.log((SIMULAR ? '[simulação] ' : '') + de + ' → ' + para);
  copiar(de, para);
}
console.log(JSON.stringify(Object.assign({}, conta, { mb: Math.round(conta.bytes / 1048576) })));
const cfg = path.join(P.CONTROLE, 'config.json');
console.log('config.json em ' + cfg + ': ' + (fs.existsSync(cfg) ? fs.readFileSync(cfg, 'utf8').trim() : '(não existe)'));
