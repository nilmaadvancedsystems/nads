'use strict';
// Teste do robo/acesso-cliente.js (18/11/2026, a senha por pessoa na Área do Cliente), sem rede: um banco e um login de
// mentira. Rodar: node robo/teste-acesso-cliente.js
const assert = require('assert');
const { iniciarAcessoCliente } = require('./acesso-cliente');
const core = () => require('./gerado/danfse');

const T1 = 'a'.repeat(40), T2 = 'b'.repeat(40);
const respostas = {};
const usuariosDaEquipe = new Set(['uid-equipe']);
const db = {
  collection: nome => ({
    doc: id => ({
      update: async c => { if (nome === 'areaClientePessoas') respostas[id] = Object.assign({}, respostas[id], c); },
      get: async () => ({ exists: nome === 'usuarios' && usuariosDaEquipe.has(id) }),
    }),
  }),
};
const contas = new Map([['vitor@nilma.com', { uid: 'uid-equipe', email: 'vitor@nilma.com', customClaims: null }]]);
const chamadas = [];
let n = 0;
const auth = {
  getUserByEmail: async e => { const u = contas.get(e); if (!u) { const err = new Error('não achou'); err.code = 'auth/user-not-found'; throw err; } return u; },
  createUser: async ({ email }) => { const u = { uid: 'uid-' + (++n), email, customClaims: null }; contas.set(email, u); chamadas.push('criar ' + email); return u; },
  setCustomUserClaims: async (uid, c) => { for (const u of contas.values()) if (u.uid === uid) u.customClaims = c; chamadas.push('permissoes ' + uid + ' ' + c.a.length); },
  revokeRefreshTokens: async uid => { chamadas.push('derrubar ' + uid); },
};
const ouvintes = {};
const ouvir = (nome, _c, f) => { ouvintes[nome] = f; return () => {}; };
const snap = docs => ({ docs: docs.map(([id, x]) => ({ id, data: () => x, get: k => x[k] })) });

(async () => {
  const r = iniciarAcessoCliente({ db, auth, log: () => {}, ouvir, core });
  try {
    ouvintes['Acesso do cliente: links das empresas'](snap([['462', { token: T1 }], ['515', { token: T2 }]]));
    ouvintes['Acesso do cliente: pessoas'](snap([
      ['462_maria', { codigo: 462, nome: 'Maria', email: 'maria@padaria.com', ativo: true }],
      ['515_maria', { codigo: 515, nome: 'Maria', email: 'maria@padaria.com', ativo: true }],
      ['462_vitor', { codigo: 462, nome: 'Vitor', email: 'vitor@nilma.com', ativo: true }],
      ['999_jose', { codigo: 999, nome: 'José', email: 'jose@x.com', ativo: true }],
    ]));
    await r.rodar();
    // a Maria: um login, as duas empresas, pronta nas duas fichas
    assert.deepStrictEqual(contas.get('maria@padaria.com').customClaims, { cliente: true, a: [T1, T2] });
    assert.strictEqual(respostas['462_maria'].situacao, 'pronto');
    assert.strictEqual(respostas['515_maria'].situacao, 'pronto');
    // a conta da equipe nunca vira cliente
    assert.strictEqual(contas.get('vitor@nilma.com').customClaims, null, 'a conta da equipe não ganha permissão de cliente');
    assert.match(respostas['462_vitor'].erro, /equipe/);
    // a empresa sem link: erro na ficha, sem link no login
    assert.strictEqual(respostas['999_jose'].situacao, 'erro');
    assert.match(respostas['999_jose'].erro, /link/);

    // tirar a Maria da 515: a lista diminui e as sessões caem
    chamadas.length = 0;
    ouvintes['Acesso do cliente: pessoas'](snap([
      ['462_maria', { codigo: 462, nome: 'Maria', email: 'maria@padaria.com', ativo: true, situacao: 'pronto' }],
      ['515_maria', { codigo: 515, nome: 'Maria', email: 'maria@padaria.com', ativo: false, situacao: 'pronto' }],
    ]));
    await r.rodar();
    assert.deepStrictEqual(contas.get('maria@padaria.com').customClaims, { cliente: true, a: [T1] });
    assert.ok(chamadas.some(c => c.startsWith('derrubar')), 'tirar uma empresa derruba as sessões');

    // nada mudou: não chama o login de novo
    chamadas.length = 0;
    await r.rodar();
    assert.deepStrictEqual(chamadas, [], 'sem mudança, sem chamada');
    console.log('teste-acesso-cliente: ok');
  } finally { r.parar(); }
})().catch(e => { console.error(e); process.exit(1); });
