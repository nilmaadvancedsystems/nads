// Testes do resumo diário da saúde do banco (saude-banco.js): as funções puras e o caminho inteiro num banco e num Google
// de mentira (nada vai para o Firestore nem para o Cloud Monitoring de verdade). Rode antes de publicar:  node teste-saude-banco.js
const sb = require('./saude-banco');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

// ---------- os dias da cota ----------
igual('dia da cota na Califórnia', sb.diaDaCota(new Date('2026-10-21T05:00:00Z')), '2026-10-20');
const dias = sb.diasCompletos(new Date('2026-10-21T15:00:00Z'), 3);
igual('os dias completos, do mais novo ao mais antigo', dias.map(d => d.dia), ['2026-10-20', '2026-10-19', '2026-10-18']);
igual('cada dia tem 24 h (verão)', dias.map(d => (d.ate - d.desde) / 36e5), [24, 24, 24]);
igual('a meia-noite no dia em que o relógio muda', [sb.inicioDoDia(new Date('2026-11-02T07:30:00Z')).toISOString(), sb.inicioDoDia(new Date('2026-03-08T12:00:00Z')).toISOString()], ['2026-11-01T07:00:00.000Z', '2026-03-08T08:00:00.000Z']);
igual('o dia em que começa o horário de verão tem 23 h', sb.diasCompletos(new Date('2026-03-09T20:00:00Z'), 1).map(d => [d.dia, (d.ate - d.desde) / 36e5]), [['2026-03-08', 23]]);
igual('o dia em que acaba o horário de verão na Califórnia tem 25 h', sb.diasCompletos(new Date('2026-11-02T20:00:00Z'), 1).map(d => [d.dia, (d.ate - d.desde) / 36e5]), [['2026-11-01', 25]]);

// ---------- as respostas do Google ----------
igual('o último valor de cada série, com os rótulos', sb.ultimosDaResposta({ timeSeries: [
  { resource: { labels: { site_name: 'tarefas-nilma' } }, points: [{ value: { int64Value: '300' } }, { value: { int64Value: '100' } }] },
  { resource: { labels: { site_name: 'extratudo-nilma' } }, points: [{ value: { int64Value: '50' } }] },
  { points: [] },
] }), [{ valor: 300, rotulos: { site_name: 'tarefas-nilma' } }, { valor: 50, rotulos: { site_name: 'extratudo-nilma' } }]);
igual('sem série, nada', sb.ultimosDaResposta({}), []);

// ---------- o histórico das coleções ----------
const hist = { '2026-10-13': { a: 1 }, '2026-10-14': { a: 5 }, '2026-10-20': { a: 9 } };
igual('7 dias atrás: o dia exato', sb.haSeteDias(hist, '2026-10-21'), { a: 5 });
igual('7 dias atrás: sem o dia exato, até 2 dias antes', sb.haSeteDias({ '2026-10-13': { a: 1 } }, '2026-10-21'), { a: 1 });
igual('7 dias atrás: nada perto', sb.haSeteDias({ '2026-10-01': { a: 1 } }, '2026-10-21'), null);
const novo = sb.historicoNovo({ '2026-10-10': {}, '2026-10-11': {}, '2026-10-12': {}, '2026-10-13': {}, '2026-10-14': {}, '2026-10-15': {}, '2026-10-16': {}, '2026-10-17': {} }, '2026-10-21', { a: 2 });
igual('o histórico guarda só os últimos 8 dias, com o de hoje', Object.keys(novo), ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-21']);
igual('o uso por dia junta, sem o dia de hoje e sem repetir', sb.juntarUsoPorDia(
  [{ dia: '2026-10-19', leituras: 1 }, { dia: '2026-10-21', leituras: 9 }], [{ dia: '2026-10-20', leituras: 2 }, { dia: '2026-10-19', leituras: 3 }], '2026-10-21'),
[{ dia: '2026-10-19', leituras: 3 }, { dia: '2026-10-20', leituras: 2 }]);

// ---------- o caminho inteiro, de mentira ----------
function bancoDeMentira(colecoes, fantasmas, anterior) {
  const gravados = [];
  const col = nome => ({
    id: nome,
    count: () => ({ get: async () => ({ data: () => ({ count: colecoes[nome] }) }) }),
    listDocuments: async () => [...Array(colecoes[nome]).keys()].map(i => ({ id: nome + i })).concat((fantasmas[nome] || []).map(id => ({ id }))),
    select: () => ({ get: async () => ({ docs: [...Array(colecoes[nome]).keys()].map(i => ({ id: nome + i })) }) }),
    doc: () => ({
      get: async () => ({ exists: !!anterior, data: () => anterior }),
      set: async d => { gravados.push(d); },
    }),
  });
  return { gravados, listCollections: async () => Object.keys(colecoes).map(col), collection: col };
}
const respostas = url => {
  const u = new URL(url);
  const filtro = u.searchParams.get('filter');
  if (u.pathname.includes('/projects/conferencia-nilma/')) throw Object.assign(new Error('x'), { response: { data: { error: { message: 'Permission monitoring.timeSeries.list denied' } } } });
  if (filtro.includes('read_ops')) return { timeSeries: [{ points: [{ value: { int64Value: '1000' } }] }] };
  if (filtro.includes('_ops')) return { timeSeries: [{ points: [{ value: { int64Value: '10' } }] }] };
  if (filtro.includes('storage_bytes')) return { timeSeries: [{ points: [{ value: { int64Value: '123456' } }] }] };
  if (filtro.includes('hosting.googleapis.com/storage/total_bytes')) return { timeSeries: [{ resource: { labels: { site_name: 'entregas-2e5e2' } }, points: [{ value: { int64Value: '500' } }] }] };
  if (filtro.includes('hosting.googleapis.com/storage/limit')) return { timeSeries: [{ points: [{ value: { int64Value: '10000' } }] }] };
  return {};
};
const authDeMentira = { getClient: async () => ({ request: async ({ url }) => ({ data: respostas(url) }) }) };

(async () => {
  const anterior = { em: '2026-10-20T10:00:00Z', historico: { '2026-10-14': { feedbacks: 2, areasCliente: 1 } }, usoPorDia: [{ dia: '2026-10-19', leituras: 7, gravacoes: 1, exclusoes: 0 }] };
  const db = bancoDeMentira({ feedbacks: 3, areasCliente: 2, rotinas: 5000 }, { areasCliente: ['tokenfantasma123'] }, anterior);
  const s = sb.criarSaudeDoBanco(db, () => {}, { auth: authDeMentira });
  const r = await s.resumir(new Date('2026-10-21T15:00:00Z'));
  igual('as coleções, da maior para a menor, com o de 7 dias atrás', r.colecoes, [
    { nome: 'rotinas', total: 5000, ha7dias: null }, { nome: 'feedbacks', total: 3, ha7dias: 2 }, { nome: 'areasCliente', total: 2, ha7dias: 1 }]);
  igual('o espelho sem link aparece como órfão; o feedback não', r.orfaos.map(o => [o.colecao, o.quantos, o.exemplos]), [['areasCliente', 1, ['tokenfan']], ['feedbacks', 0, []]]);
  igual('o uso por dia: o que já tinha e os 29 que faltavam', [r.usoPorDia.length, r.usoPorDia[r.usoPorDia.length - 1]], [30, { dia: '2026-10-20', leituras: 1000, gravacoes: 10, exclusoes: 10 }]);
  igual('o dia que já estava não é perguntado de novo', r.usoPorDia.find(u => u.dia === '2026-10-19'), { dia: '2026-10-19', leituras: 7, gravacoes: 1, exclusoes: 0 });
  igual('o armazenamento', r.armazenamento, { bytes: 123456, erro: '' });
  igual('a hospedagem sem permissão fica com o erro, sem número', [r.hospedagem[0].projeto, r.hospedagem[0].bytes, r.hospedagem[0].erro], ['conferencia-nilma', null, 'Permission monitoring.timeSeries.list denied']);
  igual('a hospedagem com permissão', [r.hospedagem[1].bytes, r.hospedagem[1].limite, r.hospedagem[1].sites], [500, 10000, [{ site: 'entregas-2e5e2', bytes: 500 }]]);
  igual('gravou uma vez, com o histórico de hoje', [db.gravados.length, Object.keys(db.gravados[0].historico).length], [1, 2]);
  igual('leituras gastas: os counts, o listDocuments, o select e o documento', r.leiturasGastas, (5 + 1 + 1) /* counts: 1 a cada 1.000 */ + (3 + 3) /* listDocuments */ + 2 /* select do areasCliente */ + 1);

  // o Google fora do ar: o resumo sai assim mesmo, com o erro
  const db2 = bancoDeMentira({ feedbacks: 1 }, {}, null);
  const s2 = sb.criarSaudeDoBanco(db2, () => {}, { auth: { getClient: async () => { throw new Error('sem credencial'); } } });
  const r2 = await s2.resumir(new Date('2026-10-21T15:00:00Z'));
  igual('sem o Google: as coleções saem, as métricas não', [r2.colecoes.length, r2.usoPorDia.length, r2.armazenamento.bytes, r2.erros], [1, 0, null, ['Cloud Monitoring: sem credencial']]);

  console.log(falhas ? falhas + ' FALHA(S) de ' + total : 'TODOS OS ' + total + ' OK');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
