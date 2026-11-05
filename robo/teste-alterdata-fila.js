// Teste da fila do robô do Alterdata (04/11/2026: "tambem preciso que ele aguente requisições simultaneas, um não pode
// atrapalhar o outro"). Sem o Contábil: um banco em memória e um roteiro de mentira que escreve no arquivo de quem pediu.
// Prova que, com vários pedidos chegando juntos:
//   1. nunca roda mais de um roteiro ao mesmo tempo (o Contábil é uma tela só);
//   2. cada pedido recebe só os próprios arquivos (o conteúdo diz de quem é), em pastas diferentes;
//   3. o pedido repetido (mesma empresa e mês) não roda de novo: aponta para o primeiro (mesmoQue);
//   4. o pedido que trava estoura o prazo, vira erro com o motivo e não segura a fila;
//   5. o cancelado antes da vez não roda; o mesmo id avisado duas vezes roda uma vez só;
//   6. o balancete da Conferência (tipo 'balancete') segue funcionando na mesma fila.
// Rodar: node robo/teste-alterdata-fila.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { criarFilaAlterdata, periodo } = require('./alterdata-fila');

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-alterdata-'));
const espera = ms => new Promise(r => setTimeout(r, ms));

// ── o banco em memória (o mesmo contrato do Firestore no alterdata.js)
const pedidos = new Map();
const partes = new Map();   // id → { relatorio: buffer }
const banco = {
  async ler(id) { await espera(1); const p = pedidos.get(id); return p ? { ...p } : null; },
  // a transação do Firestore: só um pega (o que já saiu de pendente não volta)
  async pegar(id) { const p = pedidos.get(id); if (!p || p.status !== 'pendente') return null; pedidos.set(id, { ...p, status: 'trabalhando' }); await espera(1); return { ...p }; },
  async atualizar(id, campos) { await espera(1); pedidos.set(id, { ...pedidos.get(id), ...campos }); },
  async gravarArquivo(id, rel, buf) { await espera(2); partes.set(id, { ...(partes.get(id) || {}), [rel]: Buffer.from(buf) }); return { partes: 1 }; },
  async prontoIgual(id, p) {
    for (const [oid, o] of pedidos) {
      if (oid !== id && o.tipo === 'mensal' && o.codigo === p.codigo && o.competencia === p.competencia && o.status === 'pronto' && !o.mesmoQue && o.fimEm >= p.criadoEm) return { id: oid, arquivos: o.arquivos };
    }
    return null;
  },
};

// ── o roteiro de mentira: conta quantos rodam juntos; escreve quem pediu no arquivo; a empresa 999 trava até o sinal
let rodando = 0, maximo = 0;
const chamadas = [];
async function rodar(rel, a, passo, sinal) {
  rodando++; maximo = Math.max(maximo, rodando);
  chamadas.push(rel + ' ' + a.codigo + ' ' + a.inicio);
  try {
    await passo('abrindo ' + rel);
    if (a.codigo === 999) {
      await new Promise(resolve => sinal.addEventListener('abort', resolve));
      return { ok: false, erro: 'parado' };
    }
    await espera(10 + Math.floor(Math.random() * 30));
    if (fs.readdirSync(a.pasta).length) return { ok: false, erro: 'a pasta não estava vazia' };
    fs.writeFileSync(a.destino, rel + '|' + a.codigo + '|' + a.inicio + '|' + a.fim);
    return { ok: true };
  } finally { rodando--; }
}

const fila = criarFilaAlterdata({ banco, rodar, limiteMs: 300, apagarPasta: false, pastaDoPedido: id => path.join(BASE, id) });

function novo(id, tipo, codigo, competencia) {
  pedidos.set(id, { status: 'pendente', tipo, codigo, competencia, criadoEm: new Date().toISOString(), criadoPor: 'teste' });
}

(async () => {
  // dez pedidos chegando ao mesmo tempo, de empresas e pessoas diferentes
  novo('a', 'mensal', 101, '2026-09');
  novo('b', 'mensal', 102, '2026-09');
  novo('trava', 'mensal', 999, '2026-09');
  novo('c', 'mensal', 101, '2026-08');
  novo('dup1', 'mensal', 103, '2026-09');
  novo('dup2', 'mensal', 103, '2026-09');      // o mesmo mês da 103, por outra pessoa
  novo('cancela', 'mensal', 104, '2026-09');
  novo('conf', 'balancete', 105, '2026-09');   // o da Conferência
  novo('d', 'mensal', 106, '2026-02');
  novo('ruim', 'mensal', 107, '2026-13');      // competência inválida
  for (const id of ['a', 'b', 'trava', 'c', 'dup1', 'dup2', 'cancela', 'conf', 'd', 'ruim']) fila.chegou(id);
  fila.chegou('a'); fila.chegou('b');           // avisado de novo (o ouvinte do banco repete): não entra duas vezes
  pedidos.set('cancela', { ...pedidos.get('cancela'), status: 'cancelado' });   // cancelado antes da vez
  await espera(5);
  await fila.ocioso();

  const st = id => pedidos.get(id).status;
  // 1. um por vez
  assert.strictEqual(maximo, 1, 'rodou mais de um roteiro ao mesmo tempo: ' + maximo);
  // 2. cada um com os próprios arquivos, cada um na sua pasta
  for (const [id, cod, comp] of [['a', 101, '2026-09'], ['b', 102, '2026-09'], ['c', 101, '2026-08'], ['dup1', 103, '2026-09'], ['d', 106, '2026-02']]) {
    assert.strictEqual(st(id), 'pronto', id + ' não ficou pronto: ' + JSON.stringify(pedidos.get(id)));
    const [ini, fim] = periodo(comp);
    for (const rel of ['balancete', 'razao']) {
      assert.strictEqual(partes.get(id)[rel].toString(), rel + '|' + cod + '|' + ini + '|' + fim, id + ' recebeu o ' + rel + ' de outro');
      assert.strictEqual(pedidos.get(id).arquivos[rel].status, 'pronto');
    }
  }
  assert.strictEqual(new Set(['a', 'b', 'c', 'dup1', 'd'].map(id => pedidos.get(id).arquivadoEm)).size, 5, 'dois pedidos na mesma pasta');
  // 3. o repetido aponta para o primeiro e não rodou
  assert.strictEqual(st('dup2'), 'pronto');
  assert.strictEqual(pedidos.get('dup2').mesmoQue, 'dup1');
  assert.strictEqual(chamadas.filter(c => c.startsWith('balancete 103 ')).length, 1, 'o mês repetido rodou duas vezes');
  // 4. o travado virou erro com o motivo, e a fila seguiu (os de depois dele ficaram prontos, acima)
  assert.strictEqual(st('trava'), 'erro');
  assert.match(pedidos.get('trava').erro, /passou de .* min sem terminar/);
  // 5. o cancelado não rodou; o avisado duas vezes rodou uma vez; a competência inválida virou erro
  assert.strictEqual(st('cancela'), 'cancelado');
  assert.ok(!chamadas.some(c => c.includes(' 104 ')), 'o cancelado rodou');
  assert.strictEqual(chamadas.filter(c => c.startsWith('balancete 101 01/09')).length, 1, 'o pedido avisado duas vezes rodou duas');
  assert.strictEqual(st('ruim'), 'erro');
  // 6. o balancete da Conferência: só o balancete
  assert.strictEqual(st('conf'), 'pronto');
  assert.ok(partes.get('conf').balancete && !partes.get('conf').razao);
  assert.ok(pedidos.get('conf').arquivoNome.startsWith('Balancete 105 2026-09'));

  // ── uma segunda leva chegando enquanto a fila trabalha
  novo('e', 'mensal', 108, '2026-09');
  fila.chegou('e');
  await espera(15);
  novo('f', 'mensal', 109, '2026-09');
  novo('g', 'mensal', 108, '2026-09');   // o mesmo da 'e', pedido quando a 'e' já estava com o robô
  fila.chegou('f'); fila.chegou('g');
  await espera(5);
  await fila.ocioso();
  assert.strictEqual(maximo, 1);
  for (const id of ['e', 'f', 'g']) assert.strictEqual(st(id), 'pronto', id);
  assert.strictEqual(pedidos.get('g').mesmoQue, 'e');
  assert.strictEqual(partes.get('f').razao.toString().split('|')[1], '109');

  // ── duas máquinas (o servidor e o PC) ouvindo a mesma fila do banco: cada pedido roda numa só
  const porMaquina = { s: [], p: [] };
  const filaDe = m => criarFilaAlterdata({ banco, limiteMs: 300, pastaDoPedido: id => path.join(BASE, m, id),
    rodar: async (rel, a2, passo2) => { porMaquina[m].push(rel + ' ' + a2.codigo); await espera(5 + Math.floor(Math.random() * 10)); fs.writeFileSync(a2.destino, m); return { ok: true }; } });
  const servidor = filaDe('s'), pc = filaDe('p');
  const ids = [];
  for (let i = 0; i < 12; i++) { const id = 'm' + i; ids.push(id); novo(id, 'mensal', 200 + i, '2026-09'); }
  for (const id of ids) { servidor.chegou(id); pc.chegou(id); }
  await espera(5);
  await Promise.all([servidor.ocioso(), pc.ocioso()]);
  const rodados = [...porMaquina.s, ...porMaquina.p].filter(c => c.startsWith('balancete'));
  assert.strictEqual(rodados.length, 12, 'algum pedido rodou nas duas máquinas: ' + rodados.length);
  assert.strictEqual(new Set(rodados).size, 12);
  for (const id of ids) assert.strictEqual(st(id), 'pronto', id);

  fs.rmSync(BASE, { recursive: true, force: true });
  console.log('ok: ' + pedidos.size + ' pedidos, ' + chamadas.length + ' roteiros, no máximo ' + maximo + ' ao mesmo tempo; o travado virou erro e a fila seguiu; duas máquinas: ' + porMaquina.s.length / 2 + ' no servidor + ' + porMaquina.p.length / 2 + ' no PC, nenhum repetido');
})().catch(err => { console.error('FALHOU:', err.message); process.exit(1); });
