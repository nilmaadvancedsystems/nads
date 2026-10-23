// Reprocessa NÃO IDENTIFICADOS pelas regras de agora (23/10/2026). SIMULAÇÃO por padrão; --aplicar arquiva o que se
// resolveu (o executor de sempre: rename no G:, o manifesto) e anota no índice da subpasta quem mudou de motivo.
//   node reprocessar-ni.js [--aplicar] [--saida <pasta>] [--lote 200]
// Grava <saida>\reprocesso.jsonl (um documento por linha: o motivo de antes e o resultado de agora) e o resumo.
'use strict';
if (!process.env.UV_THREADPOOL_SIZE) process.env.UV_THREADPOOL_SIZE = '24';
const fs = require('fs');
const path = require('path');
const A = require('./arquivador-novo');
const R = require('./arquivador-regras');
const K = require('./arquivador-chaves');
const T = require('./arquivador-conteudos');

const arg = (n, padrao) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : padrao; };
const APLICAR = process.argv.includes('--aplicar');
const ORIGEM = arg('--origem', 'G:\\Meu Drive\\Claudio Secretario');
const SAIDA = arg('--saida', path.join(A.CONTROLE, 'reprocesso-ni'));
const LOTE = +arg('--lote', 150);
const log = (...m) => console.log(new Date().toLocaleTimeString('pt-BR'), ...m);

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const pastaNi = path.join(ORIGEM, 'NÃO IDENTIFICADOS');
  const todos = A.arquivosDosNaoIdentificados(pastaNi);
  log('em NÃO IDENTIFICADOS: ' + todos.length + ' arquivos · ' + (APLICAR ? 'PRODUÇÃO' : 'simulação'));
  const manifestoAntigo = path.join(process.env.ARQUIVO_RAIZ || 'C:\\Users\\DPTO FISCAL 004\\GUSTAVO\\claudio', '_CONTROLE', 'MANIFESTO', 'manifesto.jsonl');
  const cadastro = A.carregarCadastro({});
  const chaves = K.carregar({ controle: A.CONTROLE, manifestoAntigo, raiz: R.RAIZ_CLIENTES });
  const conteudos = T.carregar({ controle: A.CONTROLE, manifestoAntigo });
  if (!APLICAR) { chaves.arquivo = null; conteudos.arquivo = null; }
  const base = { modo: APLICAR ? 'PRODUCAO' : 'SIMULACAO', confirmo: true, origem: ORIGEM, cadastro, chaves, conteudos, manifesto: A.indiceDoManifesto(manifestoAntigo), manifestoAntigo, contas: A.lerContas(A.CONTROLE), registrar: false, log: () => {} };
  const saida = fs.createWriteStream(path.join(SAIDA, 'reprocesso.jsonl'));
  const conta = {};
  const t0 = Date.now();
  for (let i = 0; i < todos.length; i += LOTE) {
    const res = await A.reprocessarNaoIdentificados(Object.assign({}, base, { arquivos: todos.slice(i, i + LOTE) }));
    for (const x of A.planos(res).filter(y => y.acao !== 'CONTEINER')) {
      const k = (x.motivoAntes || '?') + ' → ' + (x.acao === 'NAO_IDENTIFICADO' || x.acao === 'FICA' ? x.motivo : x.acao) + (x.erro ? ' (erro)' : '');
      conta[k] = (conta[k] || 0) + 1;
      saida.write(JSON.stringify({ rel: x.rel, dentroDe: x.dentroDe || null, antes: x.motivoAntes, acao: x.acao, motivo: x.motivo || null, tipo: x.tipo, cliente: x.cliente || null, ano: x.anoRaiz || null, onde: x.onde || null, erro: x.erro || null, evidencia: (x.evidencias || []).slice(-2).join(' · ').slice(0, 300) }) + '\n');
    }
    log((i + LOTE) + '/' + todos.length);
  }
  saida.end();
  const resumo = { em: new Date().toISOString(), arquivos: todos.length, modo: base.modo, segundos: Math.round((Date.now() - t0) / 1000), transicoes: Object.fromEntries(Object.entries(conta).sort((a, b) => b[1] - a[1])) };
  fs.writeFileSync(path.join(SAIDA, 'resumo.json'), JSON.stringify(resumo, null, 1));
  log('fim: ' + JSON.stringify(resumo).slice(0, 2000));
  try { await A.encerrarOcr(); } catch (e) { /* segue */ }
  process.exit(0);
})().catch(e => { console.log('erro:', e.stack); process.exit(1); });
