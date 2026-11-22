'use strict';
// Teste do robo/aviso-de-acesso.js (22/11/2026, ficha E21), sem rede. Rodar: node robo/teste-aviso-de-acesso.js
const assert = require('assert');
const { iniciarAvisoDeAcesso } = require('./aviso-de-acesso');
const core = () => require('./gerado/danfse');

const agora = Date.parse('2026-11-22T15:00:00Z');
const enviados = [];
const avisos = { enviarPara: async (uids, t, c) => { enviados.push({ para: uids.join(','), t, c }); }, enviar: async (papel, _m, t, c) => { enviados.push({ para: papel, t, c }); } };
const atualizados = [];
const doc = (id, x) => ({ id, data: () => x, ref: { update: async d => { atualizados.push([id, d]); } } });
const db = { collection: () => ({ where: () => ({ limit: () => ({}) }) }) };
const ouvintes = [];

(async () => {
  const r = iniciarAvisoDeAcesso({ db, log: () => {}, avisos, core, agora: () => agora, ouvir: (nome, q, f) => { ouvintes.push(f); return () => {}; } });
  // a sessão nova avisa a própria pessoa, uma vez
  assert.strictEqual(await r.sessaoNova(doc('u1_1', { uid: 'u1', nome: 'Clara', computador: 'Windows · Chrome', liberadoEm: '2026-11-22T14:30:00.000Z' })), true);
  assert.strictEqual(enviados[0].para, 'u1');
  assert.ok(enviados[0].c.includes('Windows · Chrome') && enviados[0].c.includes('Não fui eu'));
  assert.strictEqual(await r.sessaoNova(doc('u1_1', { uid: 'u1', liberadoEm: '2026-11-22T14:30:00.000Z' })), false, 'a mesma não avisa de novo');
  assert.strictEqual(await r.sessaoNova(doc('u1_2', { uid: 'u1', liberadoEm: '2026-11-22T14:30:00.000Z', avisadoEm: 'x' })), false, 'já avisada');
  assert.strictEqual(await r.sessaoNova(doc('u1_3', { uid: 'u1', liberadoEm: '2026-11-20T14:30:00.000Z' })), false, 'velha (mais de 24 h)');
  // o "Não fui eu" avisa os admins
  assert.strictEqual(await r.alertaNovo(doc('a1', { tipo: 'nao-fui-eu', uid: 'u1', nome: 'Clara', computador: 'Celular', em: '2026-11-22T14:50:00.000Z' })), true);
  assert.deepStrictEqual([enviados[1].para, enviados[1].t], ['admin', 'Acesso suspeito no nads']);
  assert.strictEqual(atualizados.length, 2, 'cada um marca avisadoEm');
  console.log('teste-aviso-de-acesso: ok');
})().catch(e => { console.error(e); process.exit(1); });
