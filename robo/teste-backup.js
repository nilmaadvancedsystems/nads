// Testes do backup diário: prazo do filho, tentativas do dia, leitura em fluxo do retrato e envio retomável ao Drive (tudo com fakes).
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { rodarFilho, tentativasDoDia } = require('./backup-diario');
const { lerColecoes } = require('./backup-planilha');
const { enviarArquivoRetomavel } = require('./drive-arquivos');
let total = 0, falhas = 0;
const igual = (nome, a, b) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) { falhas++; console.log('FALHOU ', nome, JSON.stringify(a), '≠', JSON.stringify(b)); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));

(async () => {
  // tentativas do dia
  igual('sem estado: zero', tentativasDoDia({}, '2026-11-07').backup, 0);
  igual('mesmo dia: conta', tentativasDoDia({ backupTentativas: { dia: '2026-11-07', backup: 2 } }, '2026-11-07').backup, 2);
  igual('outro dia: zera', tentativasDoDia({ backupTentativas: { dia: '2026-11-06', backup: 2, avisado: { backup: '2026-11-06' } } }, '2026-11-07').backup, 0);
  igual('aviso de ontem não vale', tentativasDoDia({ backupTentativas: { dia: '2026-11-06', avisado: { backup: '2026-11-06' } } }, '2026-11-07').avisado, {});

  // prazo do filho
  const lento = path.join(tmp, 'lento.js'); fs.writeFileSync(lento, 'setInterval(()=>{},1000)');
  const t0 = Date.now();
  const r = await rodarFilho(lento, { prazoMs: 700 });
  igual('estourou o prazo: falha com prazo', [r.ok, r.prazo], [false, true]);
  igual('e não esperou além do prazo', Date.now() - t0 < 5000, true);
  const rapido = path.join(tmp, 'rapido.js'); fs.writeFileSync(rapido, 'console.log("OK: feito")');
  igual('termina no prazo: ok', (await rodarFilho(rapido, { prazoMs: 5000 })).ok, true);
  const quebra = path.join(tmp, 'quebra.js'); fs.writeFileSync(quebra, 'console.error("FATAL: sem memória");process.exit(3)');
  const rq = await rodarFilho(quebra, { prazoMs: 5000, filtro: (l, f) => f });
  igual('código de saída ruim: falha com o motivo', [rq.ok, rq.resumo], [false, 'FATAL: sem memória']);

  // leitura em fluxo (blocos de 7 bytes para cruzar todas as fronteiras)
  const banco = { projeto: 'x', feitoEm: 'y', colecoes: {
    clientes: { a: { dados: { nome: 'Fulano "{[ \ }" ]', obs: 'ç ã é 日本' } } },
    outras: { z: { dados: { n: 1 } } },
    entregas: { e1: { dados: { k: [1, 2, { m: '}' }] } } },
    vazia: {},
  }, totalDeDocumentos: 3 };
  const arq = path.join(tmp, 'banco-2026-11-07.json'); fs.writeFileSync(arq, JSON.stringify(banco, null, 1));
  for (const bloco of [7, 13, 1024]) {
    igual('lê só o pedido (bloco ' + bloco + ')', lerColecoes(arq, ['clientes', 'entregas', 'documentosMensal'], bloco), { clientes: banco.colecoes.clientes, entregas: banco.colecoes.entregas });
  }

  // envio retomável com cliente falso: 25 bytes em partes de 10, a segunda parte falha uma vez
  const grande = path.join(tmp, 'banco.json'); fs.writeFileSync(grande, 'abcdefghijklmnopqrstuvwxy');
  const sessoes = path.join(tmp, 'sessoes.json');
  function falso(opcoes) {
    const f = { chamadas: [], recebido: 0, criou: 0, falhar: opcoes.falharNaParte };
    f.request = async req => {
      f.chamadas.push(req.method + ' ' + (req.headers['Content-Range'] || 'abrir'));
      if (req.method === 'POST') { f.criou++; return { status: 200, headers: { location: 'https://upload/sessao1' }, data: {} }; }
      const cr = req.headers['Content-Range'];
      if (cr.startsWith('bytes */')) return f.recebido ? { status: 308, headers: { range: 'bytes=0-' + (f.recebido - 1) } } : { status: 308, headers: {} };
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(cr);
      if (f.falhar && Number(m[1]) === 10) { f.falhar = false; throw new Error('write EPIPE'); }
      f.recebido = Number(m[2]) + 1;
      return Number(m[2]) + 1 >= Number(m[3]) ? { status: 200, headers: {}, data: { id: 'x' } } : { status: 308, headers: { range: 'bytes=0-' + Number(m[2]) } };
    };
    return f;
  }
  const f1 = falso({ falharNaParte: true });
  await enviarArquivoRetomavel({ cliente: f1, caminho: grande, pastaId: 'P', nome: 'banco.json', sessoesArquivo: sessoes, tamanhoParte: 10, espera: async () => {} });
  igual('falha no meio: retoma de onde parou, sem recomeçar', [f1.criou, f1.recebido], [1, 25]);
  igual('sessão apagada ao terminar', fs.existsSync(sessoes) ? JSON.parse(fs.readFileSync(sessoes, 'utf8')) : {}, {});

  // falha total na 2ª parte: lança, guarda a sessão; nova chamada (outro "reinício") continua do byte 10
  const f2 = { chamadas: [], recebido: 0, criou: 0 };
  f2.request = async req => {
    if (req.method === 'POST') { f2.criou++; return { status: 200, headers: { location: 'https://upload/s2' } }; }
    const cr = req.headers['Content-Range'];
    if (cr.startsWith('bytes */')) return f2.recebido ? { status: 308, headers: { range: 'bytes=0-' + (f2.recebido - 1) } } : { status: 308, headers: {} };
    const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(cr);
    if (Number(m[1]) === 10 && f2.cair) throw new Error('rede caiu');
    f2.recebido = Number(m[2]) + 1;
    return f2.recebido >= 25 ? { status: 200, headers: {} } : { status: 308, headers: { range: 'bytes=0-' + Number(m[2]) } };
  };
  f2.cair = true;
  let erro = '';
  try { await enviarArquivoRetomavel({ cliente: f2, caminho: grande, pastaId: 'P', nome: 'banco.json', sessoesArquivo: sessoes, tamanhoParte: 10, tentativasPorParte: 2, espera: async () => {} }); } catch (e) { erro = e.message; }
  igual('rede fora: lança com o ponto onde parou', /parou em 10\/25/.test(erro), true);
  f2.cair = false;
  await enviarArquivoRetomavel({ cliente: f2, caminho: grande, pastaId: 'P', nome: 'banco.json', sessoesArquivo: sessoes, tamanhoParte: 10, espera: async () => {} });
  igual('depois do "reinício": mesma sessão, terminou', [f2.criou, f2.recebido], [1, 25]);

  // o que fica fora do backup (10/11/2026, consumo do banco): só o que o robô refaz ou é passageiro
  const { entraNoBackup } = require('./backup-firestore');
  igual('fora: o registro dos robôs, o mapa do Drive e os zips do SIEG', ['roboAtividade', 'driveIndice', 'siegNotas', 'siegContagens', 'robosRegistros', 'uso'].map(c => entraNoBackup(c)), [false, false, false, false, false, false]);
  igual('dentro: entregas, clientes, rotinas, cadastro, financeiro, cofre', ['entregas', 'clientes', 'rotinas', 'cadastro', 'financeiroCaixa', 'cofre', 'pedidosSieg'].map(c => entraNoBackup(c)), [true, true, true, true, true, true, true]);
  igual('subcoleção: os XMLs subidos ao SIEG ficam fora; os eventos da rotina e os anexos ficam', [entraNoBackup('pedidosSieg', 'xmls'), entraNoBackup('rotinas', 'eventos'), entraNoBackup('entregas', 'anexos')], [false, true, true]);

  // as subcoleções pelo mapa (11/11/2026): a descoberta pergunta a cada documento; com o mapa, só lê as conhecidas
  {
    const { escreverColecao, mapaValido, DESCOBRIR_A_CADA_MS } = require('./backup-firestore');
    // um banco de mentira: rotinas/r1 com eventos, rotinas/r2 sem; cadastro sem subcoleções
    const dados = { 'rotinas/r1': { a: 1 }, 'rotinas/r2': { a: 2 }, 'rotinas/r1/eventos/e1': { t: 'x' }, 'cadastro/c1': { n: 'C' } };
    let perguntas = 0, leituras = 0;
    const colecao = caminho => ({
      id: caminho.split('/').pop(),
      orderBy() { return this; }, limit() { return this; }, startAfter() { return this; },
      async get() {
        leituras++;
        const docs = Object.keys(dados).filter(k => k.startsWith(caminho + '/') && k.slice(caminho.length + 1).indexOf('/') < 0).sort()
          .map(k => ({ id: k.split('/').pop(), data: () => dados[k], ref: documento(k) }));
        return { docs: docs.length ? docs : [] };
      },
    });
    const documento = caminho => ({
      collection: nome => colecao(caminho + '/' + nome),
      async listCollections() { perguntas++; return [...new Set(Object.keys(dados).filter(k => k.startsWith(caminho + '/')).map(k => k.slice(caminho.length + 1).split('/')[0]))].map(n => colecao(caminho + '/' + n)); },
    });
    const rodar = async ctx => { let txt = ''; const w = x => { txt += x; }; for (const c of ['rotinas', 'cadastro']) { w('{'); await escreverColecao(colecao(c), ctx, false, w, ''); w('}'); } return txt; };
    const base = () => ({ contador: { docs: 0 }, destino: tmp, resumoProvas: { novas: 0, jaExistiam: 0, bytesNovos: 0 } });
    const desc = Object.assign(base(), { descobrindo: true, mapa: null, mapaNovo: {} });
    const comDescoberta = await rodar(desc);
    igual('descoberta: pergunta a cada documento e anota o mapa', [perguntas, desc.mapaNovo], [4, { rotinas: ['eventos'], 'rotinas/eventos': [], cadastro: [] }]);
    perguntas = 0;
    const pelo = Object.assign(base(), { descobrindo: false, mapa: desc.mapaNovo, mapaNovo: {} });
    const peloMapa = await rodar(pelo);
    igual('pelo mapa: não pergunta nada e o retrato sai igual', [perguntas, peloMapa], [0, comDescoberta]);
    igual('pelo mapa: os mesmos documentos', pelo.contador.docs, desc.contador.docs);
    igual('a subcoleção vazia (rotinas/r2/eventos) não aparece no retrato', /"r2": {"dados":{"a":2}}/.test(peloMapa), true);
    const agora = Date.parse('2026-11-11T12:00:00Z');
    igual('o mapa vale 7 dias; sem mapa ou com --descobrir, descobre', [
      mapaValido({ descobertoEm: '2026-11-08T12:00:00Z', porColecao: {} }, agora, false),
      mapaValido({ descobertoEm: new Date(agora - DESCOBRIR_A_CADA_MS - 1).toISOString(), porColecao: {} }, agora, false),
      mapaValido(null, agora, false),
      mapaValido({ descobertoEm: '2026-11-10T12:00:00Z', porColecao: {} }, agora, true),
    ], [true, false, false, false]);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
})();
