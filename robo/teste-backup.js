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

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log((falhas ? falhas + ' FALHA(S) em ' : 'ok: ') + total + ' testes');
  process.exit(falhas ? 1 : 0);
})();
