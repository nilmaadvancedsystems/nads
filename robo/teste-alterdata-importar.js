// Teste da importação de lançamentos na fila do Alterdata (06/11/2026): node robo/teste-alterdata-importar.js
// Sem o Contábil: um banco em memória e um roteiro de mentira. Prova que:
//   1. o pedido 'importar' grava a planilha na pasta do pedido, roda o roteiro com a empresa, o lote e o arquivo, fica
//      pronto com o que o Alterdata respondeu e a pasta é apagada;
//   2. a mesma planilha na mesma empresa não é importada de novo (mesmoQue), mesmo pedida outra vez;
//   3. a recusa do Alterdata (a data de trava) vira erro com o motivo;
//   4. sem lote ou com a planilha vazia, nem roda.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { criarFilaAlterdata } = require('./alterdata-fila');

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-importar-'));
const pedidos = new Map();
const banco = {
  async ler(id) { const p = pedidos.get(id); return p ? { ...p } : null; },
  async pegar(id) { const p = pedidos.get(id); if (!p || p.status !== 'pendente') return null; pedidos.set(id, { ...p, status: 'trabalhando' }); return { ...p }; },
  async atualizar(id, campos) { pedidos.set(id, { ...pedidos.get(id), ...campos }); },
  async importadoIgual(id, codigo, sha256) {
    for (const [oid, o] of pedidos) if (oid !== id && o.tipo === 'importar' && o.codigo === codigo && o.sha256 === sha256 && ['pronto', 'trabalhando'].includes(o.status)) return { id: oid, lote: o.lote };
    return null;
  },
};
const chamadas = [];
async function rodar(rel, a, passo) {
  assert.strictEqual(rel, 'importar');
  await passo('abrindo Lançamentos → Importação financeira');
  const bytes = fs.readFileSync(a.destino);
  chamadas.push({ codigo: a.codigo, lote: a.lote, tamanho: bytes.length, pasta: path.dirname(a.destino) });
  if (a.lote.includes('travado')) return { ok: false, erro: 'o Alterdata não importou: data menor ou igual a data de trava contábil: 5. Não teve importação de lançamentos.', mensagens: ['Não teve importação de lançamentos.'] };
  return { ok: true, empresa: 'EMPRESA TESTE', mensagens: ['Importação concluída.'] };
}
const fila = criarFilaAlterdata({ banco, rodar, limiteMs: 2000, pastaDoPedido: id => path.join(BASE, id) });
const planilha = n => Buffer.alloc(4608, n).toString('base64');
const novo = (id, campos) => { pedidos.set(id, { status: 'pendente', tipo: 'importar', codigo: 292, lote: 'Creditor 11/2025', planilha: planilha(1), criadoEm: new Date().toISOString(), ...campos }); fila.chegou(id); };

(async () => {
  novo('a');
  novo('b');                                   // a mesma planilha de novo
  novo('c', { planilha: planilha(2), lote: 'travado' });
  novo('d', { lote: '' });
  novo('e', { planilha: '' });
  await fila.ocioso();

  const a = pedidos.get('a');
  assert.strictEqual(a.status, 'pronto');
  assert.strictEqual(a.resultado, 'Importação concluída.');
  assert.strictEqual(a.andamento.pct, 100);
  assert.ok(a.sha256 && a.sha256.length === 64);
  assert.ok(!fs.existsSync(chamadas[0].pasta), 'a pasta do pedido devia ter sido apagada');
  assert.deepStrictEqual(chamadas[0], { codigo: 292, lote: 'Creditor 11/2025', tamanho: 4608, pasta: chamadas[0].pasta });

  const b = pedidos.get('b');
  assert.strictEqual(b.status, 'pronto');
  assert.strictEqual(b.mesmoQue, 'a');
  assert.strictEqual(chamadas.filter(c => c.lote === 'Creditor 11/2025').length, 1, 'a mesma planilha rodou duas vezes');

  const c = pedidos.get('c');
  assert.strictEqual(c.status, 'erro');
  assert.match(c.erro, /trava contábil/);

  assert.strictEqual(pedidos.get('d').status, 'erro');
  assert.match(pedidos.get('d').erro, /lote/);
  assert.strictEqual(pedidos.get('e').status, 'erro');
  assert.match(pedidos.get('e').erro, /vazia/);
  assert.strictEqual(chamadas.length, 2);
  fs.rmSync(BASE, { recursive: true, force: true });
  console.log('ok: importou 1, não repetiu a mesma planilha, a trava virou erro, sem lote/planilha nem rodou');
})().catch(e => { console.error(e); process.exit(1); });
