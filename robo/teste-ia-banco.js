'use strict';
// Teste da trava da IA (robo/ia-banco.js; auditoria de segurança, 24/11/2026), sem rede: um banco de mentira.
// Rodar: node robo/teste-ia-banco.js
const assert = require('assert');
const { executarBanco, caminhoLiberado, semSegredos } = require('./ia-banco');

// o que a IA pode e o que não pode
assert.strictEqual(caminhoLiberado('clientes', 'colecao'), true);
assert.strictEqual(caminhoLiberado('clientes/123', 'documento'), true);
for (const c of ['convites', 'config', 'segredos', 'cofre', 'auditoria', 'nadsPedidos', 'financeiroCaixa', 'carteiraComissoes', 'conversasIA', 'areasCliente', 'ticketsLinks', 'rotaLinks', 'portais', 'painelMaquinas']) {
  assert.strictEqual(caminhoLiberado(c, 'colecao'), false, c);
  assert.strictEqual(caminhoLiberado(c + '/x', 'documento'), false, c);
}
// nenhuma subcoleção, nem de coleção liberada (as anotações, as partes de arquivo)
assert.strictEqual(caminhoLiberado('usuarios/uid/notas', 'colecao'), false);
assert.strictEqual(caminhoLiberado('usuarios/uid/notas/1', 'documento'), false);
assert.strictEqual(caminhoLiberado('clientes/../convites', 'colecao'), false);
assert.strictEqual(caminhoLiberado('', 'colecao'), false);

// os campos de segredo somem, em qualquer profundidade
assert.deepStrictEqual(semSegredos({ nome: 'Ana', fcmToken: 'x', codigoConvite: 'y', perfil: { senhaHash: 'z', cor: 'azul' }, lista: [{ token: 1, ok: 2 }] }),
  { nome: 'Ana', perfil: { cor: 'azul' }, lista: [{ ok: 2 }] });

// o banco de mentira: só conta quem foi lido
const lidos = [];
const doc = caminho => ({ path: caminho, get: async () => { lidos.push(caminho); return { exists: true, data: () => ({ codigo: 'SEGREDO', nome: 'n', token: 't' }) }; } });
const db = {
  listCollections: async () => ['clientes', 'convites', 'config', 'entregas'].map(id => ({ id })),
  doc,
  collection: caminho => { const q = { where: () => q, orderBy: () => q, limit: () => q, get: async () => { lidos.push(caminho); return { docs: [] }; }, count: () => ({ get: async () => { lidos.push(caminho); return { data: () => ({ count: 0 }) }; } }) }; return q; },
};

(async () => {
  assert.deepStrictEqual((await executarBanco(db, 'listar_colecoes', {})).colecoes, ['clientes', 'entregas']);
  const conv = await executarBanco(db, 'ler_documento', { caminho: 'convites/ABC' });
  assert.ok(conv.erro && /fora do alcance/.test(conv.erro));
  assert.ok((await executarBanco(db, 'consultar_colecao', { colecao: 'convites', filtros: [{ campo: 'tipo', op: '==', valor: 'reset' }] })).erro);
  assert.ok((await executarBanco(db, 'contar', { colecao: 'financeiroCaixa' })).erro);
  assert.ok((await executarBanco(db, 'consultar_colecao', { colecao: 'usuarios/u1/notas' })).erro);
  assert.deepStrictEqual(lidos, [], 'nada fora da lista foi lido');
  const cli = await executarBanco(db, 'ler_documento', { caminho: 'clientes/1' });
  assert.deepStrictEqual(cli.dados, { codigo: 'SEGREDO', nome: 'n' }, 'o código do cliente (do ERP) fica; o token sai');
  assert.deepStrictEqual(lidos, ['clientes/1']);
  console.log('ia-banco: a trava da IA ok');
})().catch(e => { console.error(e); process.exit(1); });
