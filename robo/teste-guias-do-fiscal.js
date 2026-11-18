// Testes das guias do Fiscal já arquivadas no Drive (plano do Acessórias, 17/11/2026, ficha E15; frase do dono:
// "Seguir"). Rode antes de publicar:  node teste-guias-do-fiscal.js
// Não acessa o banco nem o Drive. As dependências de fora (firebase-admin…) que faltarem nesta máquina viram um módulo
// vazio só aqui.
const Module = require('module');
const carregar = Module._load;
Module._load = function (pedido, pai, ...resto) {
  try { return carregar.call(this, pedido, pai, ...resto); } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND' && !pedido.startsWith('.')) return new Proxy({}, { get: () => () => ({}) });
    throw e;
  }
};
const G = require('./guias-do-fiscal');
const L = require('./lote-dp');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}
async function joga(f) { try { await f(); return ''; } catch (e) { return e.message; } }

// a mesma chave e os mesmos caminhos do drive-indice.js
const chave = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
function caminhos(itens, raizId) {
  const porId = new Map(itens.map(i => [i.i, i]));
  const memo = new Map([[raizId, []]]);
  const de = id => { if (memo.has(id)) return memo.get(id); const it = porId.get(id); if (!it) return null; const pai = de(it.p); const c = pai ? pai.concat([it.n]) : null; memo.set(id, c); return c; };
  itens.forEach(i => de(i.i));
  return memo;
}

(async () => {
  // ---------- 1. o mês pelo nome ----------
  igual('o DAS: MM-AAAA.pdf', G.competenciaDoNome('10-2026.pdf'), '2026-10');
  igual('a DARF com o nome do arquivador', G.competenciaDoNome('10-2026 - DARF INSS - VALOR 1.234,56 - VENCIMENTO 20-11-2026.pdf'), '2026-10');
  igual('a declaração do PGDAS-D fica de fora', G.competenciaDoNome('10-2026 - PGDAS-D DECLARACAO.pdf'), null);
  igual('sem o mês no começo, fora', G.competenciaDoNome('guia qualquer.pdf'), null);
  igual('não é PDF, fora', G.competenciaDoNome('10-2026.xml'), null);

  // ---------- 2. as guias na pasta do cliente ----------
  const itens = [
    { i: 'f', n: 'FISCAL', t: 'd', p: 'raiz' },
    { i: 'sn', n: 'SIMPLES NACIONAL', t: 'd', p: 'f' },
    { i: 'das', n: '01. DAS', t: 'd', p: 'sn' },
    { i: 'darf', n: '16. DARF', t: 'd', p: 'sn' },
    { i: 'xml', n: '12. XML', t: 'd', p: 'sn' },
    { i: 'g1', n: '10-2026.pdf', t: 'f', p: 'das', s: 50000 },
    { i: 'g2', n: '10-2026 - PGDAS-D DECLARACAO.pdf', t: 'f', p: 'das' },
    { i: 'g3', n: '10-2026 - DARF IRRF - VALOR 10,00 - VENCIMENTO 20-11-2026.pdf', t: 'f', p: 'darf', s: 9000 },
    { i: 'g4', n: '09-2026.pdf', t: 'f', p: 'das', s: 48000 },
    { i: 'g5', n: '10-2026.pdf', t: 'f', p: 'xml' },
    { i: 'dp', n: 'DEPARTAMENTO PESSOAL', t: 'd', p: 'raiz' },
    { i: 'g6', n: '10-2026.pdf', t: 'f', p: 'dp' },
  ];
  const porMes = G.guiasDoFiscalNaPasta(itens, 'raiz', caminhos, chave);
  igual('outubro: o DAS e a DARF (sem o PGDAS-D, o XML e o DP)', porMes.get('2026-10'), [
    { i: 'g1', n: '10-2026.pdf', c: 'FISCAL/SIMPLES NACIONAL/01. DAS', s: 50000 },
    { i: 'g3', n: '10-2026 - DARF IRRF - VALOR 10,00 - VENCIMENTO 20-11-2026.pdf', c: 'FISCAL/SIMPLES NACIONAL/16. DARF', s: 9000 },
  ]);
  igual('setembro: o DAS', porMes.get('2026-09').map(a => a.i), ['g4']);
  igual('as pastas de guia do Presumido (sem DAS)', [...G.pastasDeGuia(chave).get('LUCRO PRESUMIDO')].sort(), ['05. DARF', '06. DAE', '10. DAM']);

  // ---------- 3. a trava: só o id da lista do mês daquele cliente ----------
  const doc = { clientes: { 58: { arquivos: [{ i: 'g1' }, { i: 'g3' }] } } };
  igual('id da lista: pode', G.idNaLista(doc, 58, 'g3'), true);
  igual('id de outro cliente: não', G.idNaLista(doc, 59, 'g3'), false);
  igual('id qualquer: não', G.idNaLista(doc, 58, 'xyz'), false);
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => doc }) }) }) };
  let baixou = '';
  const getDrive = () => ({ files: { get: async ({ fileId }) => { baixou = fileId; return { data: new Uint8Array([37, 80, 68, 70]) }; } } });
  igual('o robô recusa o id de fora da lista', await joga(() => G.bufferDoDrive(db, getDrive, { driveId: 'xyz', origem: { codigo: 58, competencia: '2026-10' } })),
    'a guia não está na lista do Fiscal do cliente 58 em 10/2026');
  igual('sem o cliente ou o mês, recusa', await joga(() => G.bufferDoDrive(db, getDrive, { driveId: 'g3' })), 'a guia da pasta veio sem o cliente, o mês ou o id do Drive');
  igual('o id da lista: baixa pelo Drive', [(await G.bufferDoDrive(db, getDrive, { driveId: 'g3', origem: { codigo: 58, competencia: '2026-10' } })).length, baixou], [4, 'g3']);
  // o lote: o arquivo com driveId não procura os pedaços
  const ref = { firestore: db, collection: () => { throw new Error('procurou os pedaços'); } };
  igual('o bufferDoArquivo do lote vai ao Drive quando o arquivo veio da pasta', (await L.bufferDoArquivo(ref, { driveId: 'g1', origem: { codigo: 58, competencia: '2026-10' } }, { getDrive })).length, 4);

  console.log(falhas ? falhas + ' de ' + total + ' testes FALHARAM' : total + ' testes, todos passaram');
  process.exitCode = falhas ? 1 : 0;
})();
