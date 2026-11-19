'use strict';
// Teste do robo/insights.js (plano do Acessórias, 18/11/2026, ficha tela-de-insights), sem rede: um banco de mentira que
// responde às consultas e guarda o que foi gravado. Rodar: node robo/teste-insights.js
const assert = require('assert');
const { iniciarInsights } = require('./insights');
const core = () => require('./gerado/danfse');

const gravados = [];
const contagens = [];
let ajusteLigado = false;
const ouvintes = {};

// a consulta de mentira: guarda os filtros e conta pelo que o teste definiu
function consulta(colecao, filtros = []) {
  return {
    where: (campo, op, valor) => consulta(colecao, [...filtros, campo + op + JSON.stringify(valor)]),
    count: () => ({ get: async () => { contagens.push(colecao + ' ' + filtros.join(' ')); return { data: () => ({ count: CONTAS[colecao + ' ' + filtros.join(' ')] || 0 }) }; } }),
  };
}
// a equipe (usuarios): um get por hora
let leiturasDaEquipe = 0;
const USUARIOS = [
  { nome: 'savio', departamento: 'dp' }, { nome: 'Felipe', departamento: 'contabil' }, { nome: 'gustavo', roles: ['staff', 'office_boy'] },
  { nome: 'Heverton', departamento: 'fiscal' }, { nome: 'Gustavo.S', roles: ['admin'] }, { nome: 'Antiga', departamento: 'fiscal', ativo: false },
];
const db = {
  collection: nome => Object.assign(consulta(nome), {
    doc: id => ({ set: async d => { gravados.push({ caminho: nome + '/' + id, d }); } }),
    get: async () => { if (nome === 'usuarios') leiturasDaEquipe++; return { docs: (nome === 'usuarios' ? USUARIOS : []).map(u => ({ data: () => u })) }; },
  }),
};
// o ouvinte de mentira: guarda quem ouve e entrega o que o teste mandar
function ouvir(nome, _consulta, aoChegar) { ouvintes[nome] = aoChegar; return () => { delete ouvintes[nome]; }; }

const hoje = new Date(2026, 10, 18, 10, 0);
const CONTAS = {
  'solicitacoesEmail tipo=="envioFiscal" competencia=="2026-10" status=="enviado"': 300,
  'solicitacoesEmail tipo=="envioDp" competencia=="2026-10" status=="enviado"': 112,
  'areaClienteLeituras competencia=="2026-10"': 287,
  'entregas status=="pendente"': 14,
  'entregas status=="link"': 6,
  'entregas status=="confirmada" competencia=="2026-10"': 132,
  'entregas status=="falha"': 1,
};

const fontes = {
  execucoes: new Map([
    ['1|2026-10|fiscal', { codigo: 1, empresa: 'A', competencia: '2026-10', departamento: 'fiscal', etapas: {} }],
  ]),
  cadastroPorCodigo: new Map([[999001, { nome: 'PADARIA BOA LTDA', regime: 'Simples', responsaveis: { fiscal: 'Heverton' } }], [999003, { nome: 'MERCADO NOVO LTDA', regime: 'Presumido', responsaveis: { fiscal: 'Heverton' } }], [2, { nome: 'OFICINA DO ZÉ', responsaveis: { contabil: 'Fernando' } }]]),
  chamados: new Map([['c1', { situacao: 'aberto' }], ['c2', { situacao: 'concluido', avaliacao: { nota: 5, em: '2026-11-02T10:00:00Z' } }]]),
  ticketsAbertos: new Map(),
  guiasPagas: comp => (comp === '2026-10' ? 154 : 0),
  clientesAtivos: async () => [{ id: 'cli1' }, { id: 'cli2', documentosNaoAplicaveis: ['aplicacao'] }],
};

(async () => {
  const r = iniciarInsights({ db, log: () => {}, ouvir, core, fontes, agora: () => hoje });
  try {
    // desligado: nem os ouvintes da delegadas e do documentosMensal, nem gravação
    ouvintes['Insights: ajuste']({ exists: true, get: () => ajusteLigado });
    await r.talvez();
    assert.strictEqual(gravados.length, 0, 'desligado não grava');
    assert.ok(!ouvintes['Insights: tarefas delegadas'], 'desligado não ouve as delegadas');

    // ligado
    ajusteLigado = true;
    ouvintes['Insights: ajuste']({ exists: true, get: () => ajusteLigado });
    assert.ok(ouvintes['Insights: tarefas delegadas'] && ouvintes['Insights: documentos do mês'], 'ligado ouve as delegadas e os documentos');
    ouvintes['Insights: tarefas delegadas']({ docs: [
      { id: 't1', data: () => ({ status: 'pendente', prazo: '2026-11-10', titulo: 'Conferir o balancete', responsavel: { nome: 'Clara' } }) },
      { id: 't2', data: () => ({ status: 'andamento', prazo: '2026-12-10', responsavel: { nome: 'Felipe' } }) },
    ] });
    assert.ok(ouvintes['Insights: tabelão do Fiscal'], 'ligado ouve o tabelão do Fiscal');
    ouvintes['Insights: tabelão do Fiscal']({ docs: [{ data: () => ({ codigo: 999003, competencia: '2026-10', valores: { das: '10,00' }, marcas: {}, entregue: 'email' }) }] });
    ouvintes['Insights: documentos do mês']({ docs: [
      { get: k => (k === 'clienteId' ? 'cli1' : undefined), data: () => ({ extrato: true }) },
      { get: k => (k === 'clienteId' ? 'cli2' : undefined), data: () => ({ extrato: true, comprovante: true }) },
    ] });
    await r.talvez();
    assert.strictEqual(gravados.length, 1, 'ligado grava uma vez');
    const d = gravados[0].d;
    assert.strictEqual(gravados[0].caminho, 'nadsInsights/atual');
    assert.deepStrictEqual(d.guias, { competencia: '2026-10', enviadas: 412, abertas: 287, pagas: 154 });
    assert.deepStrictEqual(d.entregas, { aEntregar: 14, noLink: 6, confirmadas: 132, falhas: 1 });
    assert.deepStrictEqual(d.clientes, { abertas: 1, respondidas: 0, nota: 5, avaliacoes: 1, documentosFaltando: 1, mandeiAbertos: 0 });
    assert.deepStrictEqual(d.equipe, { atrasadas: 1, pessoas: [{ nome: 'Clara', atrasadas: 1, tarefas: [{ titulo: 'Conferir o balancete', prazo: '2026-11-10' }] }] });
    // o Fiscal pelo tabelão: a entregue conta como feita, a sem linha como não iniciada
    const fiscal = d.rotinas.find(x => x.setor === 'fiscal').pessoas;
    const hev = fiscal.find(p => p.nome === 'Heverton');
    assert.deepStrictEqual([hev.feitas, hev.faltando], [1, 1]);
    assert.deepStrictEqual(hev.empresas.map(e => [e.nome, e.situacao]), [['PADARIA BOA LTDA', 'nao-iniciada'], ['MERCADO NOVO LTDA', 'concluida']], 'a visão da pessoa leva o nome da empresa');
    // a equipe pelos usuários: o desativado e o admin sem departamento ficam de fora
    assert.deepStrictEqual(d.time.map(u => [u.nome, u.setor]), [['Felipe', 'contabil'], ['gustavo', 'office-boy'], ['Heverton', 'fiscal'], ['savio', 'dp']]);
    assert.strictEqual(leiturasDaEquipe, 1);
    assert.deepStrictEqual(d.rotinas.find(x => x.setor === 'contabil').pessoas.map(p => [p.nome, p.feitas, p.faltando]), [['Fernando', 0, 1]]);
    assert.ok(d.dp.atrasadas + d.dp.pendentes + d.dp.feitas + d.dp.sem === core().CLIENTES_DO_DP.length, 'o DP conta todos os clientes da tabela');
    assert.ok(!JSON.stringify(d).match(/cli1|cli2/), 'nenhum id de cliente no resumo');
    assert.strictEqual(contagens.length, 7, 'sete contagens por volta');

    // os mesmos números: não grava de novo (e a equipe não é relida na mesma hora)
    await r.talvez();
    assert.strictEqual(gravados.length, 1, 'sem mudança, sem gravação');
    assert.strictEqual(leiturasDaEquipe, 1, 'a equipe é lida uma vez por hora');

    // desligado de novo: para os ouvintes
    ajusteLigado = false;
    ouvintes['Insights: ajuste']({ exists: true, get: () => ajusteLigado });
    assert.ok(!ouvintes['Insights: tarefas delegadas'], 'desligar para os ouvintes');
    console.log('teste-insights: ok');
  } finally { r.parar(); }
})().catch(e => { console.error(e); process.exit(1); });
