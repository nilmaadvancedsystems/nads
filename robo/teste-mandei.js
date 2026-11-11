// Testes do e-mail do Mandei (mandei.js). Rode antes de publicar:  node teste-mandei.js
// Não acessa o banco nem o Gmail: um banco de mentira em memória e um "enviar" que só anota o que mandaria.
const M = require('./mandei');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + JSON.stringify(obtido) + '\n        esperado: ' + JSON.stringify(esperado)); }
}

const ticket = (extra) => Object.assign({
  numero: 3, para: { nome: '', email: 'NilmaContabilidade@gmail.com' }, resolvidoEm: undefined,
  links: [{ codigo: 'AAAAAAAAAAAAAAAAAAAAAAAA', numero: 1 }, { codigo: 'BBBBBBBBBBBBBBBBBBBBBBBB', numero: 2 }],
}, extra || {});
const pedido = (extra) => Object.assign({ tipo: 'mandei', ticket: 't1', link: 'BBBBBBBBBBBBBBBBBBBBBBBB', numero: '#0003', para: ' nilmacontabilidade@gmail.com ', assunto: 'Saldos', corpo: 'Olá' }, extra || {});
const trava = { liberado: false, internos: ['nilmacontabilidade@gmail.com'] };

// ---------- 1. a conferência ----------
igual('pode: o link atual, o e-mail do ticket (sem diferença de maiúscula), interno', M.motivoParaNaoMandar(pedido(), ticket(), true, trava), '');
igual('sem o ticket', M.motivoParaNaoMandar(pedido(), null, true, trava), 'o ticket #0003 não existe mais');
igual('resolvido', M.motivoParaNaoMandar(pedido(), ticket({ resolvidoEm: '2026-11-11' }), true, trava), 'o ticket #0003 já foi resolvido');
igual('link velho (saiu outro depois)', M.motivoParaNaoMandar(pedido({ link: 'AAAAAAAAAAAAAAAAAAAAAAAA' }), ticket(), true, trava), 'este link não é mais o atual do ticket (saiu outro depois)');
igual('sem o formulário no banco', M.motivoParaNaoMandar(pedido(), ticket(), false, trava), 'o formulário do link não existe no banco');
igual('código ruim', M.motivoParaNaoMandar(pedido({ link: 'x/../y' }), ticket(), true, trava), 'pedido sem o código do link');
igual('e-mail que não é o do ticket', M.motivoParaNaoMandar(pedido({ para: 'outro@x.com' }), ticket(), true, trava), 'o e-mail do pedido (outro@x.com) não é o do ticket (nilmacontabilidade@gmail.com)');
igual('sem texto', M.motivoParaNaoMandar(pedido({ corpo: '  ' }), ticket(), true, trava), 'pedido sem o assunto ou o texto');
const cliente = ticket({ para: { email: 'cliente@empresa.com.br' } });
igual('a trava: cliente não, enquanto não libera', M.motivoParaNaoMandar(pedido({ para: 'cliente@empresa.com.br' }), cliente, true, trava),
  'o envio do Mandei aos clientes ainda não foi liberado (por enquanto só para nilmacontabilidade@gmail.com); não mandei para cliente@empresa.com.br');
igual('liberado: cliente sim', M.motivoParaNaoMandar(pedido({ para: 'cliente@empresa.com.br' }), cliente, true, { liberado: true, internos: [] }), '');
igual('a trava começa ligada', M.LIBERADO_PARA_CLIENTES, false);
igual('marca só o link do pedido', M.linksComEmail([{ codigo: 'A' }, { codigo: 'B', x: 1 }], 'B', { enviadoEm: 'h' }), [{ codigo: 'A' }, { codigo: 'B', x: 1, enviadoEm: 'h' }]);

// ---------- 2. o atendimento, com um banco de mentira ----------
function banco(docs) {
  const get = caminho => ({ exists: caminho in docs, data: () => JSON.parse(JSON.stringify(docs[caminho])) });
  const ref = (col, id) => ({ caminho: col + '/' + id, get: async () => get(col + '/' + id) });
  return {
    docs,
    collection: col => ({ doc: id => ref(col, id) }),
    runTransaction: async f => f({ get: async r => get(r.caminho), update: (r, dados) => { docs[r.caminho] = Object.assign({}, docs[r.caminho], dados); } }),
  };
}
(async () => {
  const mandados = [];
  const deps = (db, enviar) => ({ db, pedidoId: 'p1', log: () => {}, agora: () => '2026-11-11T19:00:00.000Z', visual: async () => ({ html: '<p>Olá</p>' }), enviar: enviar || (async d => { mandados.push(d); return 'g1'; }) });

  const db = banco({ 'tickets/t1': ticket(), 'ticketsLinks/BBBBBBBBBBBBBBBBBBBBBBBB': {} });
  const r = await M.atenderMandei(pedido(), deps(db));
  igual('enviou: o que o vigia grava no pedido', r, { status: 'enviado', enviadoEm: '2026-11-11T19:00:00.000Z', gmailId: 'g1', para: 'nilmacontabilidade@gmail.com' });
  igual('enviou: o e-mail com o html', mandados, [{ para: 'nilmacontabilidade@gmail.com', assunto: 'Saldos', corpo: 'Olá', html: '<p>Olá</p>' }]);
  igual('enviou: marcou no link do ticket', db.docs['tickets/t1'].links[1], { codigo: 'BBBBBBBBBBBBBBBBBBBBBBBB', numero: 2, enviadoEm: '2026-11-11T19:00:00.000Z', emailId: 'p1', erroDoEmail: null });
  igual('enviou: o outro link fica como estava', db.docs['tickets/t1'].links[0], { codigo: 'AAAAAAAAAAAAAAAAAAAAAAAA', numero: 1 });

  const db2 = banco({ 'tickets/t1': ticket({ para: { email: 'cliente@empresa.com.br' } }), 'ticketsLinks/BBBBBBBBBBBBBBBBBBBBBBBB': {} });
  let erro = '';
  try { await M.atenderMandei(pedido({ para: 'cliente@empresa.com.br' }), deps(db2)); } catch (e) { erro = e.message; }
  igual('a trava: não manda e diz por quê', /ainda não foi liberado/.test(erro), true);
  igual('a trava: o erro fica no link do ticket', /ainda não foi liberado/.test(db2.docs['tickets/t1'].links[1].erroDoEmail), true);

  const db3 = banco({ 'tickets/t1': ticket(), 'ticketsLinks/BBBBBBBBBBBBBBBBBBBBBBBB': {} });
  erro = '';
  try { await M.atenderMandei(pedido(), deps(db3, async () => { throw new Error('caixa sem autorização'); })); } catch (e) { erro = e.message; }
  igual('o Gmail falhou: o erro sobe e fica no ticket', [erro, db3.docs['tickets/t1'].links[1].erroDoEmail], ['caixa sem autorização', 'caixa sem autorização']);

  console.log((falhas ? falhas + ' de ' : 'todos os ') + total + ' testes do Mandei' + (falhas ? ' falharam' : ' passaram'));
  process.exit(falhas ? 1 : 0);
})();
