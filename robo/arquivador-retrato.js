// O RETRATO dos índices do arquivador novo (07/11/2026). Reler chaves.jsonl, os manifestos e o diário a cada reinício levava
// ~116 s (197.844 chaves, 461.053 conteúdos). O retrato é o índice já montado (v8.serialize do Map), gravado logo depois de
// uma leitura, com, para cada .jsonl de origem, até onde ele foi lido (o fim da última linha completa) e uma impressão digital
// do começo e do trecho final lido. No início: lê o retrato e só o que foi acrescentado depois em cada .jsonl. Se alguma origem
// não bater (sumiu, encolheu, mudou o começo ou o trecho final), se o código que monta o índice mudou, ou se o retrato é
// velho (RETRATO_VALE_DIAS), relê tudo como antes. O retrato nunca substitui os .jsonl: é só cache.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const v8 = require('v8');

const FORMATO = 1;
const CABECA = 64 * 1024, CAUDA = 4 * 1024;
const RETRATO_VALE_DIAS = 7;

const sha1 = b => crypto.createHash('sha1').update(b).digest('hex');
/** Impressão digital de um arquivo até o byte `fim`: o começo (64 KB) e o trecho final (4 KB antes de `fim`). */
function impressao(arquivo, fim) {
  if (!fim) return '';
  const fd = fs.openSync(arquivo, 'r');
  try {
    const a = Buffer.alloc(Math.min(CABECA, fim)), ca = fs.readSync(fd, a, 0, a.length, 0);
    const n = Math.min(CAUDA, fim), b = Buffer.alloc(n), cb = fs.readSync(fd, b, 0, n, fim - n);
    return sha1(a.subarray(0, ca)) + sha1(b.subarray(0, cb));
  } finally { fs.closeSync(fd); }
}
/** A assinatura do código: o retrato de um código velho não vale (mudou a forma de montar o índice). */
const assinaturaDoArquivo = f => { try { return sha1(fs.readFileSync(f)).slice(0, 16); } catch (e) { return ''; } };

/**
 * Lê o retrato. `assinatura` = o que, se mudar, invalida (código, raiz, caminhos).
 * → { dados, fontes: Map arquivo → fim } quando todas as origens do retrato ainda batem, senão null.
 */
function ler(arquivo, assinatura) {
  let r;
  try { r = v8.deserialize(fs.readFileSync(arquivo)); } catch (e) { return null; }
  try {
    if (!r || r.formato !== FORMATO || r.assinatura !== assinatura || !r.dados) return null;
    if (Date.now() - r.em > RETRATO_VALE_DIAS * 864e5) return null;
    const fontes = new Map();
    for (const f of r.fontes) {
      if (!f.fim) { fontes.set(f.arquivo, 0); continue; }          // não existia quando o retrato foi feito
      let st; try { st = fs.statSync(f.arquivo); } catch (e) { return null; }
      if (st.size < f.fim || impressao(f.arquivo, f.fim) !== f.imp) return null;
      fontes.set(f.arquivo, f.fim);
    }
    return { dados: r.dados, fontes };
  } catch (e) { return null; }
}
/** Grava o retrato (atômico). fontes: [{ arquivo, fim }]; a impressão é tirada aqui. Falha em silêncio (é só cache). */
function gravar(arquivo, assinatura, dados, fontes) {
  try {
    const fs2 = fontes.map(f => { let imp = ''; try { imp = impressao(f.arquivo, f.fim); } catch (e) { return { arquivo: f.arquivo, fim: 0, imp: '' }; } return { arquivo: f.arquivo, fim: f.fim, imp }; });
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    const tmp = arquivo + '.tmp';
    fs.writeFileSync(tmp, v8.serialize({ formato: FORMATO, assinatura, em: Date.now(), fontes: fs2, dados }));
    fs.renameSync(tmp, arquivo);
    return true;
  } catch (e) { return false; }
}

module.exports = { ler, gravar, impressao, assinaturaDoArquivo, FORMATO, RETRATO_VALE_DIAS };
