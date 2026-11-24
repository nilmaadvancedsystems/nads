'use strict';
// Teste do robo/senha-cliente.js (19/11/2026, o e-mail de senha pelo robô), sem rede. Rodar: node robo/teste-senha-cliente.js
const assert = require('assert');
const { iniciarSenhaDoCliente } = require('./senha-cliente');
const core = () => require('./gerado/danfse');

const T = 'a'.repeat(40), OUTRO = 'b'.repeat(40);
const apagados = [];
const enviados = [];
const db = {
  collection: nome => ({
    doc: id => ({
      get: async () => (nome === 'usuarios' ? { exists: id === 'uid-equipe' } : { exists: true, get: k => (k === 'nome' ? 'PERSONALY COMPANY' : undefined) }),
    }),
  }),
};
const contas = {
  'maria@padaria.com': { uid: 'uid-maria', customClaims: { cliente: true, a: [T] } },
  'ana@padaria.com': { uid: 'uid-ana', customClaims: { cliente: true, a: [T] } },
  'vitor@nilma.com': { uid: 'uid-equipe', customClaims: { cliente: true, a: [T] } },
};
const auth = {
  getUserByEmail: async e => { if (!contas[e]) throw Object.assign(new Error('não'), { code: 'auth/user-not-found' }); return contas[e]; },
  generatePasswordResetLink: async () => 'https://entregas-2e5e2.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=CODIGO_de_teste_123&apiKey=K',
};
const correio = { enviar: async d => { enviados.push(d); }, podeEnviar: () => true, contar: () => {} };
const pedido = (id, x) => ({ id, data: () => x, ref: { delete: async () => { apagados.push(id); } } });

(async () => {
  const r = iniciarSenhaDoCliente({ db, auth, log: () => {}, ouvir: () => () => {}, core, correio, agora: () => new Date(2026, 10, 19, 10) });
  // quem tem o link: o e-mail sai, com o link da página própria e o nome da empresa
  assert.strictEqual(await r.tratar(pedido('p1', { token: T, email: ' Maria@Padaria.com ' })), 'enviado');
  assert.strictEqual(enviados.length, 1);
  assert.strictEqual(enviados[0].para, 'maria@padaria.com');
  assert.ok(enviados[0].corpo.includes('https://cliente.nilmacontabilidade.com/cliente/senha?mode=resetPassword&oobCode=CODIGO_de_teste_123'));
  assert.ok(enviados[0].corpo.includes('PERSONALY COMPANY'));
  // a versão bonita: o botão com o link e a empresa
  assert.ok(enviados[0].html.includes('Criar a minha senha') && enviados[0].html.includes('oobCode=CODIGO_de_teste_123') && enviados[0].html.includes('PERSONALY COMPANY'), 'o e-mail em HTML');
  assert.ok(apagados.includes('p1'), 'o pedido sai da caixa');
  // sem acesso a este link, sem conta, da equipe ou torto: nada sai
  assert.strictEqual(await r.tratar(pedido('p2', { token: OUTRO, email: 'maria@padaria.com' })), 'sem acesso');
  assert.strictEqual(await r.tratar(pedido('p3', { token: T, email: 'ninguem@x.com' })), 'sem acesso');
  assert.strictEqual(await r.tratar(pedido('p4', { token: T, email: 'vitor@nilma.com' })), 'equipe');
  assert.strictEqual(await r.tratar(pedido('p5', { token: 'torto', email: 'maria@padaria.com' })), 'torto');
  assert.strictEqual(enviados.length, 1, 'só o primeiro saiu');
  // o limite de 3 por e-mail por dia (o p2 já contou um)
  assert.strictEqual(await r.tratar(pedido('p6', { token: T, email: 'maria@padaria.com' })), 'enviado');
  assert.strictEqual(await r.tratar(pedido('p7', { token: T, email: 'maria@padaria.com' })), 'limite');
  // e-mails inventados não gastam o total do dia (auditoria de segurança, 24/11/2026): 150 pedidos sem acesso e a Ana ainda recebe
  for (let i = 0; i < 150; i++) assert.strictEqual(await r.tratar(pedido('x' + i, { token: T, email: 'inventado' + i + '@x.com' })), 'sem acesso');
  assert.strictEqual(await r.tratar(pedido('p8', { token: T, email: 'ana@padaria.com' })), 'enviado');
  console.log('teste-senha-cliente: ok');
})().catch(e => { console.error(e); process.exit(1); });
