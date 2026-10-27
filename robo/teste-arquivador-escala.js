// A escala do arquivador novo (23/10/2026: a carga de ~320 mil arquivos do SIEG na Claudio Secretario). Rode:
//   node --expose-gc teste-arquivador-escala.js            (ESCALA_ARQUIVOS=20000 muda o tamanho da pasta de teste)
// Mede, com nomes falsos:
//   1. a memória dos índices com 320 mil documentos (o de conteúdo: "já arquivado" sem abrir o destino; o de chaves);
//   2. uma passada inteira numa pasta de verdade (temporária) com ESCALA_ARQUIVOS arquivos: o laço do Node nunca fica
//      parado (o ponto do robô e o banco seguem), a memória não cresce com a pasta e o progresso sai no painel.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const C = require('./arquivador-continuo');
const K = require('./arquivador-chaves');
const T = require('./arquivador-conteudos');
const R = require('./arquivador-regras');

let falhas = 0, total = 0;
function verdade(nome, ok, detalhe) { total++; if (!ok) { falhas++; console.log('FALHOU  ' + nome + (detalhe ? ' (' + detalhe + ')' : '')); } else console.log('ok  ' + nome + (detalhe ? ' (' + detalhe + ')' : '')); }
const gc = () => { if (global.gc) { global.gc(); global.gc(); } };
const mb = b => Math.round(b / 1048576);
const N = 320000;

(async () => {
  // ---------- 1. os índices com 320 mil documentos ----------
  gc();
  const h0 = process.memoryUsage().heapUsed;
  const idx = new T.Conteudos(null);
  const pastas = 2000;   // ~235 clientes × as pastas de XML/eventos por mês
  for (let i = 0; i < N; i++) {
    const sha = crypto.createHash('sha256').update(String(i)).digest('hex');
    const ch = String(31261000000000 + i).padEnd(44, '7');
    const onde = 'G:\\Meu Drive\\2026\\' + (i % 235) + ' - CLIENTE EXEMPLO ' + (i % 235) + ' LTDA - ME\\FISCAL\\SIMPLES NACIONAL\\12. XML\\NF-e\\' + (i % pastas >= 1000 ? 'EVENTOS\\' : '') + '10-2026_NF-e_' + i + '.xml';
    idx.juntar([sha, 'XML:' + ch + ':135260000' + i], onde);
  }
  gc();
  const h1 = process.memoryUsage().heapUsed;
  const achou = idx.achar(crypto.createHash('sha256').update('12345').digest('hex'));
  verdade('índice de conteúdo: 320 mil documentos (640 mil chaves) em ' + mb(h1 - h0) + ' MB', idx.tamanho === 2 * N && mb(h1 - h0) < 200 && achou.length === 1 && /NF-e_12345\.xml$/.test(achou[0]), 'achou ' + achou[0]);
  const ki = new K.Indice(null);
  for (let i = 0; i < N; i++) {
    // uma chave de NF-e válida não importa aqui: o índice só guarda as que valem; as falsas usam o formato da NFS-e
    ki.juntar('NFSE:' + String(11222333000100 + (i % 500)) + ':' + i, i % 235, ['FISCAL', 'SIMPLES NACIONAL', '12. XML', 'NFS-e'], 'doc', 'teste');
  }
  gc();
  const h2 = process.memoryUsage().heapUsed;
  verdade('índice de chaves: 320 mil chaves em ' + mb(Math.max(0, h2 - h1)) + ' MB', ki.tamanho === N && mb(h2 - h1) < 250);
  verdade('os dois índices juntos: ' + mb(h2 - h0) + ' MB de heap', mb(h2 - h0) < 400 && idx.tamanho > 0);
  console.log('   memória do processo com os dois índices: heap ' + mb(process.memoryUsage().heapUsed) + ' MB, rss ' + mb(process.memoryUsage().rss) + ' MB');

  // ---------- 2. uma passada inteira numa pasta grande ----------
  const quantos = +process.env.ESCALA_ARQUIVOS || 20000;
  const sb = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'teste-escala-'));
  try {
    const origem = path.join(sb, 'origem'), controle = path.join(sb, 'controle');
    fs.mkdirSync(controle, { recursive: true });
    fs.writeFileSync(path.join(controle, 'config.json'), JSON.stringify({ modo: 'simulacao', estavelMs: 0, lote: 100 }));
    const velho = new Date(Date.now() - 3600e3);
    const t0 = Date.now();
    for (let i = 0; i < quantos; i++) {
      const d = path.join(origem, 'SIEG', String(i % 200).padStart(3, '0'));
      if (i < 200) fs.mkdirSync(d, { recursive: true });
      const f = path.join(d, 'arquivo-' + i + '.txt');
      fs.writeFileSync(f, 'conteudo ' + i);
      fs.utimesSync(f, velho, velho);
    }
    console.log('   pasta de teste: ' + quantos + ' arquivos em 200 pastas (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s para criar)');
    const progresso = [];
    const painel = { atividade: () => {}, erro: () => {}, estado: () => {}, modulo: () => {}, fazendo: (id, t) => { if (id === 'arquivador-novo-leitura' && t) progresso.push(t); } };
    const v = C.iniciar({ origem, controle, controleAntigo: path.join(sb, 'sem-rotina'), clientes: path.join(sb, '2026'), cadastro: R.montarCadastro([], []), painel, umaVez: true, sieg: null, log: () => {} });
    // o laço do Node: o maior atraso de um relógio de 100 ms durante a passada (o ponto do robô bate a cada minuto)
    let maiorAtraso = 0, esperado = Date.now() + 100, picoHeap = 0;
    const relogio = setInterval(() => { const agora = Date.now(); maiorAtraso = Math.max(maiorAtraso, agora - esperado); esperado = agora + 100; picoHeap = Math.max(picoHeap, process.memoryUsage().heapUsed); }, 100);
    gc();
    const antes = process.memoryUsage().heapUsed;
    const t1 = Date.now();
    const r = await v.ciclo();
    const ms = Date.now() - t1;
    clearInterval(relogio);
    v.parar();
    verdade('passada inteira: decidiu os ' + quantos + ' em ' + (ms / 1000).toFixed(0) + ' s (' + Math.round(quantos / (ms / 60000)) + '/min, sem Drive)', r.decididos === quantos, JSON.stringify(r));
    verdade('o laço do Node não parou (maior atraso ' + maiorAtraso + ' ms)', maiorAtraso < 2000);
    verdade('memória: o pico da passada ficou em ' + mb(picoHeap - antes) + ' MB acima do começo', mb(picoHeap - antes) < 300);
    verdade('o progresso saiu no painel ("Lendo a pasta: N de ~T arquivos · …")', progresso.some(t => /^Lendo a pasta: [\d.]+ arquivos · [\d.]+ na fila \(G:\)/.test(t)), progresso[Math.floor(progresso.length / 2)]);
    const est = JSON.parse(fs.readFileSync(path.join(controle, 'continuo', 'estado.json'), 'utf8'));
    verdade('a próxima passada já sabe o tamanho da pasta (a estimativa do "de ~T")', est.totais && est.totais['G:'] === quantos);
    console.log('   estado.json: ' + Math.round(fs.statSync(path.join(controle, 'continuo', 'estado.json')).size / 1024) + ' KB com ' + Object.keys(est.decididos).length + ' decididos (em simulação nada sai da pasta; em produção saem e são esquecidos)');
  } finally { fs.rmSync(sb, { recursive: true, force: true }); }
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.log('FALHOU com erro:', e.stack); process.exit(1); });
