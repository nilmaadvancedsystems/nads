// O relatório da simulação da migração (simular-migracao.js): a taxa de identificação, para onde vai cada grupo, o que
// fica em NÃO IDENTIFICADOS e por quê, e os GRUPOS de Para resolver ordenados pelo tamanho — na amostra e projetados para a
// pasta inteira (cada arquivo da amostra vale pelo tamanho do estrato dele).
//   node relatorio-simulacao-migracao.js <pasta da simulação> [--lista <todos os nomes>]
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./arquivador-regras');
const A = require('./arquivador-novo');
const MIG = require('./arquivador-migracao');

const pasta = process.argv[2];
const arg = (n, padrao) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : padrao; };
const itens = fs.readFileSync(path.join(pasta, 'simulacao.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const resumo = JSON.parse(fs.readFileSync(path.join(pasta, 'resumo.json'), 'utf8'));
const amostra = fs.readFileSync(path.join(pasta, 'amostra.txt'), 'utf8').split('\n').filter(Boolean);
const cad = A.carregarCadastro({});

// o peso de cada arquivo da amostra: o tamanho do estrato / quantos dele entraram na amostra (com a lista completa)
const estratoDe = rel => {
  const partes = R.partesDoCaminho(rel);
  const i = partes.slice(0, -1).findIndex(p => /^\d{1,4}\b/.test(p) && !/^\d{1,2}$|^\d{1,2}[.\-_ ]\d{4}$|^(19|20)\d{2}/.test(p));
  const cliente = i >= 0 ? partes.slice(0, i + 1).join('\\') : null;
  const resto = MIG.partesSemData(i >= 0 ? partes.slice(i + 1).join('\\') : rel).slice(0, 2).join('\\');
  const a = R.anoDaPasta(rel);
  return (cliente || '(sem pasta de cliente)\\' + (partes.length > 1 ? partes[0] : '')) + ' | ' + resto + ' | ' + (a ? a.ano : '?');
};
const peso = new Map();
const listaArq = arg('--lista');
if (listaArq) {
  const tamanho = new Map(), naAmostra = new Map();
  for (const rel of fs.readFileSync(listaArq, 'utf8').split(/\r?\n/).filter(Boolean)) { const k = estratoDe(rel); tamanho.set(k, (tamanho.get(k) || 0) + 1); }
  for (const rel of amostra) { const k = estratoDe(rel); naAmostra.set(k, (naAmostra.get(k) || 0) + 1); }
  for (const rel of amostra) { const k = estratoDe(rel); peso.set(rel, (tamanho.get(k) || 1) / (naAmostra.get(k) || 1)); }
}
const p = x => peso.get(x.dentroDe || x.rel) || 1;
const mil = n => Math.round(n).toLocaleString('pt-BR');
const pct = (a, b) => (b ? (100 * a / b).toFixed(1).replace('.', ',') + '%' : '-');

const conta = (f) => { const m = new Map(); for (const x of itens) { const k = f(x); if (k == null) continue; const e = m.get(k) || { n: 0, w: 0, ex: [] }; e.n++; e.w += p(x); if (e.ex.length < 3) e.ex.push(x); m.set(k, e); } return [...m.entries()].sort((a, b) => b[1].w - a[1].w); };
const L = [];
const total = itens.length, wTotal = itens.reduce((s, x) => s + p(x), 0);
const ok = itens.filter(x => x.acao === 'ARQUIVAR' || x.acao === 'JA_ARQUIVADO');
L.push('# Simulação da migração (' + resumo.em.slice(0, 16).replace('T', ' ') + ')', '');
L.push('Na pasta: ' + mil(resumo.naPasta) + ' arquivos · amostra: ' + mil(resumo.amostra) + ' (' + resumo.estratos + ' estratos, até ' + resumo.porEstrato + ' por estrato) · documentos decididos (com os de dentro dos .zip/.rar): ' + mil(total));
L.push('Baixado do Drive: ' + String(resumo.baixadoMB).replace('.', ',') + ' MB · ' + resumo.segundos + ' s · ' + resumo.porMinuto + ' arquivos/min (só ler e decidir, em simulação)', '');
L.push('## Identificação', '');
L.push('Na amostra: ' + pct(ok.length, total) + ' identificados (' + mil(ok.length) + ' de ' + mil(total) + '); projetado para a pasta: ' + pct(ok.reduce((s, x) => s + p(x), 0), wTotal), '');
for (const [k, e] of conta(x => x.acao)) L.push('- ' + k + ': ' + mil(e.n) + ' na amostra (' + pct(e.n, total) + ') · ~' + mil(e.w) + ' na pasta');
L.push('', '## Para onde vai (ARQUIVAR e JÁ ARQUIVADO), por tipo e ano da raiz', '');
for (const [k, e] of conta(x => (x.acao === 'ARQUIVAR' || x.acao === 'JA_ARQUIVADO') ? (x.tipo || '?') + ' · ' + (x.ano || '2026') + (x.migracao ? ' · pela pasta de origem' : '') : null).slice(0, 60)) {
  const ex = e.ex[0];
  const dest = String(ex.onde || '').replace(/^[A-Z]:\\Meu Drive\\/i, '').replace(/ \(neste lote\)$/, '');
  L.push('- ' + k + ': ' + mil(e.n) + ' (~' + mil(e.w) + ') · ex.: ' + dest);
}
L.push('', '## Raiz de ano criada (pastas de cliente que nascem)', '');
const novas = new Map();
for (const x of itens) if (x.pastaNova && x.ano && x.onde) { const partes = String(x.onde).split('\\'); const k = partes.slice(2, 4).join('\\'); novas.set(k, (novas.get(k) || 0) + 1); }
L.push([...novas.keys()].sort().slice(0, 80).join(' · ') || '(nenhuma)');
L.push('', '## NÃO IDENTIFICADOS, por motivo', '');
for (const [k, e] of conta(x => x.acao === 'NAO_IDENTIFICADO' ? x.motivo : null)) L.push('- ' + k + ': ' + mil(e.n) + ' (~' + mil(e.w) + ') · ex.: ' + e.ex.map(x => x.rel.split('\\').slice(-3).join('\\') + ' — ' + x.evidencia.slice(0, 120)).join(' | '));
L.push('', '## Os GRUPOS de Para resolver (pela causa e pela pasta de origem), os maiores primeiro, com a sugestão', '');
const grupos = conta(x => x.acao === 'NAO_IDENTIFICADO' || x.acao === 'FICA' ? x.motivo + ' | ' + x.grupo : null);
let i = 0;
for (const [k, e] of grupos) {
  const [motivo, gpasta] = k.split(' | ');
  const ex = e.ex[0];
  const cp = R.clienteDaPasta(ex.dentroDe || ex.rel, cad);
  const tp = cad.mapaMigracao.tipoDaOrigem(ex.dentroDe || ex.rel);
  const sugestao = [cp && cp.forte ? 'cliente ' + cp.codigo : cp ? 'cliente ' + cp.codigo + '? (só o código)' : null, tp ? 'tipo ' + tp.tipoDoc : null].filter(Boolean).join(', ') || 'sem sugestão';
  L.push((++i) + '. ~' + mil(e.w) + ' (' + e.n + ' na amostra) · ' + motivo + ' · ' + gpasta + ' · sugestão: ' + sugestao + ' · ex.: ' + e.ex.map(x => path.win32.basename(x.rel)).join(', '));
  if (i >= 120) break;
}
const out = path.join(pasta, 'relatorio.md');
fs.writeFileSync(out, L.join('\n') + '\n');
fs.writeFileSync(path.join(pasta, 'grupos.json'), JSON.stringify(grupos.map(([k, e]) => ({ motivo: k.split(' | ')[0], pasta: k.split(' | ')[1], naAmostra: e.n, projetado: Math.round(e.w), exemplos: e.ex.map(x => x.rel) })), null, 1));
console.log(L.join('\n'));
