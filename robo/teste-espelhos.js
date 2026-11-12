// Os espelhos dos clientes e do cadastro (espelhos.js, 12/11/2026). Sem banco. node teste-espelhos.js
const E = require('./espelhos');
let ok = 0, falha = 0;
const igual = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { falha++; console.log('FALHOU', n, JSON.stringify(a), '!=', JSON.stringify(b)); } };

(async () => {
  const gravados = {};
  const apagados = [];
  const db = { collection: c => ({ doc: d => ({ collection: s => ({ doc: x => ({
    set: async v => { gravados[[c, d, s, x].join('/')] = v; },
    delete: async () => { apagados.push([c, d, s, x].join('/')); },
  }) }) }) }) };
  let chegou = null;
  const ouvir = (nome, consulta, aoChegar) => { chegou = aoChegar; return () => {}; };
  let t = 1000;
  let agendado = null;
  const esp = E.criarEspelho('clientes', 'clientes', { db, log: () => {}, ouvir, agora: () => t, agendar: f => { agendado = f; return 1; }, cancelar: () => { agendado = null; } });
  const foto = docs => ({ docs: Object.entries(docs).map(([id, d]) => ({ id, data: () => d })) });

  chegou(foto({ a: { nome: 'A' } }));
  chegou(foto({ a: { nome: 'A' }, b: { nome: 'B' } }));
  igual('a rajada espera: nada gravado ainda', Object.keys(gravados), []);
  await agendado();
  const g = gravados['cadastro/_espelhos/plano/clientes'];
  igual('uma gravação com os dois', [g.n, Object.keys(g.docs), g.em === g.vivoEm], [2, ['a', 'b'], true]);
  delete gravados['cadastro/_espelhos/plano/clientes'];
  chegou(foto({ a: { nome: 'A' }, b: { nome: 'B' } }));
  await agendado();
  igual('sem mudança: não regrava', Object.keys(gravados), []);

  // partes: acima do limite, divide
  const grande = {};
  for (let i = 0; i < 30; i++) grande['c' + i] = { texto: 'x'.repeat(50 * 1024) };
  const partes = E.partir(grande);
  igual('partir: até 800 KB por parte, sem perder ninguém', [partes.length, partes.reduce((s, p) => s + Object.keys(p).length, 0)], [2, 30]);
  chegou(foto(grande));
  await agendado();
  const m = gravados['cadastro/_espelhos/plano/clientes'];
  igual('o principal diz quantas partes; as partes têm os documentos', [m.partes, m.docs, Object.keys(gravados['cadastro/_espelhos/plano/clientes-1'].docs).length + Object.keys(gravados['cadastro/_espelhos/plano/clientes-2'].docs).length], [2, undefined, 30]);
  chegou(foto({ a: { nome: 'A' } }));
  await agendado();
  igual('voltou a caber num só: as partes velhas saem', [gravados['cadastro/_espelhos/plano/clientes'].n, apagados], [1, ['cadastro/_espelhos/plano/clientes-1', 'cadastro/_espelhos/plano/clientes-2']]);
  esp.parar();

  console.log(falha ? '\n' + falha + ' falha(s), ' + ok + ' ok' : 'espelhos: ' + ok + ' ok');
  process.exit(falha ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(1); });
