// Teste da sessão do robô do Alterdata no servidor (19/11/2026: o dono entrou por acesso remoto de um notebook de
// 2880x1800 a 200% com o robô rodando, e o balancete e o razão falharam no meio). Sem o Windows de verdade: a sessão entra
// por fora. Prova que:
//   1. a linha do `query session` vira {id, estado, nome, remota} (português e inglês, console, rdp e desconectada);
//   2. prepararSessao: no console roda; com alguém conectado por acesso remoto não roda (frase clara); desconectada passa
//      para o console e espera ela ficar ativa; se não voltar, diz que está sem sessão de tela;
//   3. explicarErro: o erro do pywinauto vira a frase de quem entrou, saiu ou mudou a tela no meio; sem mudança, fica igual;
//   4. as frases caem nas classes da fila (remoto / semTela).
// Rodar: node robo/teste-sessao-no-console.js
'use strict';
const assert = require('assert');
const { sessaoDaLinha, prepararSessao, explicarErro, REMOTO, SEM_TELA } = require('./sessao-no-console');
const { classeDoErro } = require('./alterdata-fila');

// 1
assert.deepStrictEqual(sessaoDaLinha('>console                   Pao90                     7  Ativo'), { id: '7', estado: 'Ativo', nome: 'console', remota: false });
assert.deepStrictEqual(sessaoDaLinha('>rdp-tcp#12                Administrador             2  Ativo'), { id: '2', estado: 'Ativo', nome: 'rdp-tcp#12', remota: true });
assert.deepStrictEqual(sessaoDaLinha('>rdp-tcp#3                 robo                      4  Active      rdpwd'), { id: '4', estado: 'Active', nome: 'rdp-tcp#3', remota: true });
assert.deepStrictEqual(sessaoDaLinha('>                          DPTO FISCAL 004           3  Disco'), { id: '3', estado: 'Disco', nome: '', remota: false });
assert.strictEqual(sessaoDaLinha(' services                                   0  Disco'), null);
assert.strictEqual(sessaoDaLinha(''), null);
console.log('1. linha do query session: ok');

(async () => {
  // 2
  const console7 = { id: '7', estado: 'Ativo', nome: 'console', remota: false };
  const rdp7 = { id: '7', estado: 'Ativo', nome: 'rdp-tcp#5', remota: true };
  const disc7 = { id: '7', estado: 'Disco', nome: '', remota: false };
  const rapido = { esperaMs: 300, assentarMs: 1, passoMs: 10 };
  {
    let tscon = 0;
    const r = await prepararSessao({ ...rapido, ler: async () => console7, garantir: async () => { tscon++; return 'x'; } });
    assert.deepStrictEqual(r, { ok: true }); assert.strictEqual(tscon, 0);
  }
  {
    let tscon = 0;
    const r = await prepararSessao({ ...rapido, ler: async () => rdp7, garantir: async () => { tscon++; return 'x'; } });
    assert.strictEqual(r.ok, false); assert.strictEqual(r.remoto, true); assert.strictEqual(tscon, 0, 'nunca derruba quem está conectado');
    assert.ok(r.erro.startsWith(REMOTO), r.erro);
  }
  {
    // desconectada: tscon, duas leituras ainda desconectada, depois ativa no console
    const seq = [disc7, disc7, disc7, console7];
    let tscon = 0;
    const r = await prepararSessao({ ...rapido, ler: async () => seq.shift() || console7, garantir: async () => { tscon++; return 'passei para o console'; } });
    assert.deepStrictEqual(r, { ok: true, feito: 'passei para o console' }); assert.strictEqual(tscon, 1);
  }
  {
    // desconectada e alguém conecta de novo enquanto espera: não roda
    const seq = [disc7, rdp7];
    const r = await prepararSessao({ ...rapido, ler: async () => seq.shift() || rdp7, garantir: async () => 'passei' });
    assert.strictEqual(r.remoto, true);
  }
  {
    const r = await prepararSessao({ ...rapido, ler: async () => disc7, garantir: async () => 'o tscon não deu: acesso negado' });
    assert.strictEqual(r.ok, false); assert.ok(r.erro.startsWith(SEM_TELA), r.erro); assert.match(r.erro, /acesso negado/);
  }
  {
    const r = await prepararSessao({ ...rapido, ler: async () => null });
    assert.deepStrictEqual(r, { ok: true });
  }
  console.log('2. prepararSessao (console, remoto, desconectada, não voltou): ok');

  // 3: os dois pedidos de 19/11/2026
  const consoleT = { tela: '1024x768', escala: 100, remota: false, ativa: true, desconectada: false, entrada: true };
  const notebook = { tela: '2880x1800', escala: 200, remota: true, ativa: true, desconectada: false, entrada: true };
  const solta = { tela: '1024x768', escala: 100, remota: false, ativa: false, desconectada: true, entrada: false };
  const handle = 'o roteiro parou: Handle 1312 is not a vaild window handle';
  const e1 = explicarErro(handle, consoleT, notebook);
  assert.ok(e1.startsWith(REMOTO), e1);
  assert.match(e1, /a tela mudou de 1024x768 para 2880x1800 a 200%/);
  assert.match(e1, /Detalhe: o roteiro parou: Handle 1312/);
  const e2 = explicarErro('o roteiro parou: There is no active desktop required for moving mouse cursor!', consoleT, solta);
  assert.ok(e2.startsWith(SEM_TELA), e2);
  // entrou e saiu no meio: voltou ao console, mas a tela não é a do começo
  const e3 = explicarErro('Window (hwnd=99) is not responding!', notebook, { ...consoleT });
  assert.match(e3, /^a tela do servidor mudou durante o relatório \(a tela mudou de 2880x1800 a 200% para 1024x768\)/);
  // nada mudou: o erro fica como veio
  assert.strictEqual(explicarErro('a empresa 183 não entrou na seleção do Razão', consoleT, { ...consoleT }), 'a empresa 183 não entrou na seleção do Razão');
  assert.strictEqual(explicarErro('x', null, null), 'x');
  // a frase já clara (o roteiro parou antes do primeiro clique) não é explicada de novo
  const jaClara = REMOTO + ' (a sessão do robô está conectada…)';
  assert.strictEqual(explicarErro(jaClara, null, notebook), jaClara);
  console.log('3. explicarErro: ok');

  // 4
  assert.strictEqual(classeDoErro([e1]), 'remoto');
  assert.strictEqual(classeDoErro([e3]), 'remoto');
  assert.strictEqual(classeDoErro([e2]), 'semTela');
  assert.strictEqual(classeDoErro([e1, e2]), 'remoto');
  console.log('4. classes da fila: ok');
})().catch(err => { console.error('FALHOU:', err.stack || err.message); process.exit(1); });
