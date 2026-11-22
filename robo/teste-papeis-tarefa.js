'use strict';
// Teste do documento vencendo que vira tarefa (robo/papeis-vencendo.js, criarTarefasDosPapeis; 22/11/2026, ficha M03), sem
// rede: um banco de mentira. Rodar: node robo/teste-papeis-tarefa.js
const assert = require('assert');
const { criarTarefasDosPapeis } = require('./papeis-vencendo');
const core = () => require('./gerado/danfse');

const tarefas = new Map([['velha', { numero: 40 }]]);
const USUARIOS = [{ id: 'u-clara', nome: 'Clara', departamento: 'contabil' }, { id: 'u-dir', nome: 'Gustavo.S', nivel: 'diretor' }, { id: 'u-sai', nome: 'Antiga', departamento: 'contabil', ativo: false }];
const CADASTRO = [{ codigo: 292, responsaveis: { contabil: 'CLARA' } }];
function colecao(nome, filtros = []) {
  return {
    doc: id => ({
      get: async () => ({ exists: nome === 'nadsTarefasDelegadas' && tarefas.has(id) }),
      create: async d => { if (tarefas.has(id)) throw Object.assign(new Error('existe'), { code: 6 }); tarefas.set(id, d); },
    }),
    where: (c, op, v) => colecao(nome, filtros.concat([[c, v]])),
    orderBy: () => colecao(nome, filtros),
    limit: () => colecao(nome, filtros),
    get: async () => {
      let docs = [];
      if (nome === 'usuarios') docs = USUARIOS.map(u => ({ id: u.id, data: () => u }));
      if (nome === 'cadastro') docs = CADASTRO.filter(c => filtros.every(([k, v]) => c[k] === v)).map(c => ({ id: 'x', data: () => c }));
      if (nome === 'nadsTarefasDelegadas') docs = [...tarefas.values()].sort((a, b) => b.numero - a.numero).slice(0, 1).map(t => ({ get: k => t[k] }));
      return { empty: !docs.length, docs };
    },
  };
}
const db = { collection: nome => colecao(nome) };
const clientes = [
  { codigoOrigem: '292', nome: 'PADARIA BOA LTDA', papeis: [{ tipo: 'cnd-federal', vence: '2026-12-22' }, { tipo: 'fgts', vence: '2026-12-10' }] },
  { codigoOrigem: '515', nome: 'OFICINA DO ZÉ', papeis: [{ tipo: 'procuracao', vence: '2026-12-22' }] },
  { codigoOrigem: '600', nome: 'INATIVA', ativo: false, papeis: [{ tipo: 'outro', vence: '2026-12-22' }] },
];

(async () => {
  const n = await criarTarefasDosPapeis({ db, core, log: () => {}, clientes, hoje: '2026-11-22', agora: new Date('2026-11-22T11:00:00Z') });
  assert.strictEqual(n, 2, 'só os papéis a 30 dias, dos clientes ativos');
  const a = tarefas.get('papel-292-cnd-federal-2026-12-22');
  assert.ok(a, 'a tarefa da CND');
  assert.deepStrictEqual([a.responsavel.nome, a.prazo, a.numero, a.titulo], ['Clara', '2026-12-22', 41, 'Renovar CND Federal de PADARIA BOA LTDA']);
  assert.ok(Array.isArray(a.pessoas) && a.pessoas.includes('u-clara'), 'as pessoas da tarefa (a regra de leitura)');
  const b = tarefas.get('papel-515-procuracao-2026-12-22');
  assert.strictEqual(b.responsavel.nome, 'Gustavo.S', 'sem responsável no Cadastro: o Diretor');
  // rodar de novo não cria outra
  assert.strictEqual(await criarTarefasDosPapeis({ db, core, log: () => {}, clientes, hoje: '2026-11-22' }), 0);
  console.log('teste-papeis-tarefa: ok');
})().catch(e => { console.error(e); process.exit(1); });
