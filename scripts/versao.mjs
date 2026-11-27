#!/usr/bin/env node
// Soma 1 no último número da versão do sistema (apps/web/src/versao.ts): 0.0.1 → 0.0.2.
// Rodar uma vez antes de cada publicação (regra do Vitor, 2026-09-28).
// Chegou a 1000, sobe o do meio e zera o último (Vitor, 2026-11-27: "quando chegar em 1000, coloca uma casa no 0.1.0"):
// 0.0.999 → 0.1.0; 0.1.999 → 0.2.0.
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const arq = path.join(raiz, 'apps', 'web', 'src', 'versao.ts');
const txt = fs.readFileSync(arq, 'utf8');
const m = txt.match(/VERSAO_SISTEMA = '(\d+)\.(\d+)\.(\d+)'/);
if (!m) { console.error('versao: não achei VERSAO_SISTEMA em ' + arq); process.exit(1); }
const ultimo = Number(m[3]) + 1;
const nova = ultimo >= 1000 ? m[1] + '.' + (Number(m[2]) + 1) + '.0' : m[1] + '.' + m[2] + '.' + ultimo;
fs.writeFileSync(arq, txt.replace(m[0], "VERSAO_SISTEMA = '" + nova + "'"));
console.log('versao: ' + m[1] + '.' + m[2] + '.' + m[3] + ' → ' + nova);
