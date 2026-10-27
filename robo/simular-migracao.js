// A simulação da migração (23/10/2026): uma amostra ESTRATIFICADA da Claudio Secretario passa pelas regras do arquivador
// novo em SIMULAÇÃO (nada é movido, copiado nem gravado no Drive; o contínuo fica desligado). Só lê: baixa do Google Drive
// o conteúdo dos arquivos da amostra e diz quanto baixou.
//
//   node simular-migracao.js [--saida <pasta>] [--por-estrato 20] [--alvo 3000] [--soltos 300] [--rural 300] [--lista <arquivo>]
//
// A amostra: no máximo N por combinação pasta do cliente × subpasta/tipo × ano (cobrindo todos), mais XMLs soltos (sem a
// pasta de um cliente) e os da pasta PRODUTOR RURAL. Grava <saida>\simulacao.jsonl (um item por linha) e <saida>\resumo.json.
'use strict';
if (!process.env.UV_THREADPOOL_SIZE) process.env.UV_THREADPOOL_SIZE = '24';
const fs = require('fs');
const path = require('path');
const A = require('./arquivador-novo');
const R = require('./arquivador-regras');
const K = require('./arquivador-chaves');
const T = require('./arquivador-conteudos');
const MIG = require('./arquivador-migracao');

const arg = (n, padrao) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : padrao; };
const ORIGEM = arg('--origem', 'G:\\Meu Drive\\Claudio Secretario');
const SAIDA = arg('--saida', path.join(A.CONTROLE, 'simulacao-migracao'));
const POR_ESTRATO = +arg('--por-estrato', 20), ALVO = +arg('--alvo', 3000), SOLTOS = +arg('--soltos', 300), RURAL = +arg('--rural', 300);
const fora = s => s.startsWith('_') || /^CLAUDE FAVOR N[ÃA]O MEXER$/i.test(s) || s === 'NÃO IDENTIFICADOS';
const log = (...m) => console.log(new Date().toLocaleTimeString('pt-BR'), ...m);

/** Todos os nomes (sem abrir arquivo), 12 pastas de cada vez. */
async function listar(raiz) {
  const arquivos = [], filas = [''];
  let ativos = 0;
  await new Promise(fim => {
    const puxar = () => {
      if (!filas.length && !ativos) return fim();
      while (ativos < 12 && filas.length) {
        const rel = filas.shift(); ativos++;
        fs.promises.readdir(rel ? path.join(raiz, rel) : raiz, { withFileTypes: true }).then(l => {
          for (const e of l) { const r = rel ? rel + '\\' + e.name : e.name; if (e.isDirectory()) { if (!fora(e.name)) filas.push(r); } else if (e.name !== 'desktop.ini' && !e.name.startsWith('_nao_identificados')) arquivos.push(r); }
        }, () => {}).finally(() => { ativos--; puxar(); });
      }
    };
    puxar();
  });
  return arquivos.sort();
}

/** O estrato: a pasta do cliente (a primeira com código) × as duas subpastas seguintes (sem as de data) × o ano. */
function estrato(rel, cad) {
  const partes = R.partesDoCaminho(rel);
  const i = partes.slice(0, -1).findIndex(p => /^\d{1,4}\b/.test(p) && !/^\d{1,2}$|^\d{1,2}[.\-_ ]\d{4}$|^(19|20)\d{2}/.test(p));
  const cliente = i >= 0 ? partes.slice(0, i + 1).join('\\') : null;
  const resto = MIG.partesSemData(i >= 0 ? partes.slice(i + 1).join('\\') : rel).slice(0, 2).join('\\');
  const a = R.anoDaPasta(rel);
  return { cliente, chave: (cliente || '(sem pasta de cliente)\\' + (partes.length > 1 ? partes[0] : '')) + ' | ' + resto + ' | ' + (a ? a.ano : '?') };
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const t0 = Date.now();
  const cad = A.carregarCadastro({});
  const listaArq = arg('--lista');
  const todos = listaArq ? fs.readFileSync(listaArq, 'utf8').split(/\r?\n/).filter(Boolean) : await listar(ORIGEM);
  log('na pasta: ' + todos.length + ' arquivos (listados em ' + Math.round((Date.now() - t0) / 1000) + ' s)');
  // os estratos
  const porEstrato = new Map();
  const soltos = [], rural = [];
  for (const rel of todos) {
    if (/PRODUTOR RURAL/i.test(rel)) { rural.push(rel); continue; }
    const e = estrato(rel, cad);
    if (!e.cliente && /\.xml$/i.test(rel)) { soltos.push(rel); continue; }
    if (!porEstrato.has(e.chave)) porEstrato.set(e.chave, []);
    porEstrato.get(e.chave).push(rel);
  }
  const espalhado = (l, n) => l.length <= n ? l.slice() : Array.from({ length: n }, (_, i) => l[Math.floor(i * l.length / n)]);
  let cap = POR_ESTRATO, amostra;
  const alvoEstratos = Math.max(100, ALVO - Math.min(SOLTOS, soltos.length) - Math.min(RURAL, rural.length));
  do { amostra = [...porEstrato.values()].flatMap(l => espalhado(l, cap)); if (amostra.length <= alvoEstratos * 1.15 || cap === 1) break; cap--; } while (true);
  amostra = amostra.concat(espalhado(soltos, SOLTOS), espalhado(rural, RURAL));
  log('amostra: ' + amostra.length + ' arquivos (' + porEstrato.size + ' estratos, até ' + cap + ' por estrato; ' + Math.min(SOLTOS, soltos.length) + ' XMLs soltos de ' + soltos.length + '; ' + Math.min(RURAL, rural.length) + ' de PRODUTOR RURAL de ' + rural.length + ')');
  fs.writeFileSync(path.join(SAIDA, 'amostra.txt'), amostra.join('\n'));
  // o contexto: só leitura (o índice de conteúdo sem gravar; o de chaves sem gravar)
  const manifestoAntigo = path.join(process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio', '_CONTROLE', 'MANIFESTO', 'manifesto.jsonl');
  const chaves = K.carregar({ controle: A.CONTROLE, manifestoAntigo, raiz: R.RAIZ_CLIENTES });
  chaves.arquivo = null;
  const conteudos = T.carregar({ controle: A.CONTROLE, manifestoAntigo });
  conteudos.arquivo = null;
  const manifesto = A.indiceDoManifesto(manifestoAntigo);
  const contas = A.lerContas(A.CONTROLE);
  log('contexto: ' + cad.porCod.size + ' clientes, ' + chaves.tamanho + ' chaves, ' + conteudos.tamanho + ' conteúdos; mapa da migração ' + JSON.stringify(cad.mapaMigracao && cad.mapaMigracao.estatistica));
  const saida = fs.createWriteStream(path.join(SAIDA, 'simulacao.jsonl'));
  let bytes = 0, feitos = 0;
  const t1 = Date.now();
  for (let i = 0; i < amostra.length; i += 40) {
    const lote = amostra.slice(i, i + 40);
    let res;
    try {
      res = await A.executar({ modo: 'SIMULACAO', origem: ORIGEM, arquivos: lote, cadastro: cad, contas, manifesto, manifestoAntigo, chaves, conteudos, esperaVencida: () => false, registrar: false, log: () => {} });
    } catch (e) { log('lote ' + i + ': erro ' + e.message); continue; }
    for (const x of A.planos(res)) {
      if (x.acao !== 'CONTEINER' && !x.dentroDe) bytes += x.tamanho || 0;
      if (x.acao === 'CONTEINER') { bytes += x.tamanho || 0; continue; }
      const g = MIG.chaveDoGrupo(x.motivo, x.dentroDe || x.rel);
      saida.write(JSON.stringify({ rel: x.rel, dentroDe: x.dentroDe || null, acao: x.acao, motivo: x.motivo || null, tipo: x.tipo || null, cliente: x.cliente || null, clienteNome: x.clienteNome || null, ano: x.anoRaiz || null, onde: x.onde || null, sugestao: x.destinoSugerido || null, migracao: x.pelaMigracao || null, pastaNova: !!x.criarPastaCliente, tamanho: x.tamanho || 0, grupo: g.pasta, evidencia: (x.evidencias || []).slice(-2).join(' · ').slice(0, 300) }) + '\n');
    }
    feitos += lote.length;
    if ((i / 40) % 5 === 0) log(feitos + '/' + amostra.length + ' · ' + Math.round(bytes / 1048576) + ' MB baixados · ' + Math.round(feitos / ((Date.now() - t1) / 60000)) + '/min');
  }
  saida.end();
  const ms = Date.now() - t1;
  const resumo = { em: new Date().toISOString(), naPasta: todos.length, estratos: porEstrato.size, porEstrato: cap, amostra: amostra.length, xmlsSoltos: soltos.length, produtorRural: rural.length, baixadoMB: Math.round(bytes / 1048576 * 10) / 10, segundos: Math.round(ms / 1000), porMinuto: Math.round(amostra.length / (ms / 60000)) };
  fs.writeFileSync(path.join(SAIDA, 'resumo.json'), JSON.stringify(resumo, null, 1));
  log('fim: ' + JSON.stringify(resumo));
  try { await A.encerrarOcr(); } catch (e) { /* segue */ }
  process.exit(0);
})().catch(e => { console.log('erro:', e.stack); process.exit(1); });
