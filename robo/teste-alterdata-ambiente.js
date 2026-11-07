// Teste da fila do Alterdata quando o ambiente falha (07/11/2026: 38 pedidos da 571 seguidos, todos "a janela não abriu").
// Sem o Contábil: banco em memória e roteiro de mentira. Prova que:
//   1. pedidos mensais iguais na fila rodam uma vez só; os outros recebem o mesmo resultado (mesmoQue);
//   2. três falhas "janela não abriu" seguidas reabrem o Contábil uma vez;
//   3. se continuar falhando, a fila pausa, os pedidos ficam pendentes "esperando o Contábil" (não viram erro) e o admin é avisado 1x;
//   4. passada a pausa, a fila volta a tentar e, com o Contábil bom, os pedidos saem;
//   5. SendInput sem eventos (servidor sem tela ativa) pausa sem queimar a fila e avisa;
//   6. a mensagem final é clara; erro que não é de ambiente segue como era.
// Rodar: node robo/teste-alterdata-ambiente.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { criarFilaAlterdata, classeDoErro, mensagemClara } = require('./alterdata-fila');

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-alterdata-amb-'));
const espera = ms => new Promise(r => setTimeout(r, ms));

assert.strictEqual(classeDoErro(['o Balancete Dinâmico não abriu', 'a janela do Razão não abriu']), 'janela');
assert.strictEqual(classeDoErro(['Window (hwnd=12) is not responding!']), 'janela');
assert.strictEqual(classeDoErro(['SendInput() inserted only 0 out of 2 keyboard events']), 'semTela');
assert.strictEqual(classeDoErro(['o Balancete Dinâmico não abriu', 'empresa 571 não encontrada']), '');
assert.strictEqual(classeDoErro([]), '');
assert.match(mensagemClara('janela', ['x não abriu']), /^O Contábil não respondeu ao robô.*Detalhe: x não abriu$/);

function montar() {
  const pedidos = new Map();
  const banco = {
    async ler(id) { await espera(1); const p = pedidos.get(id); return p ? { ...p } : null; },
    async pegar(id) { const p = pedidos.get(id); if (!p || p.status !== 'pendente') return null; pedidos.set(id, { ...p, status: 'trabalhando' }); return { ...p }; },
    async atualizar(id, campos) { await espera(1); pedidos.set(id, { ...pedidos.get(id), ...campos }); },
    async gravarArquivo() { return { partes: 1 }; },
    async prontoIgual() { return null; },
  };
  const novo = (id, codigo, comp, tipo = 'mensal') => pedidos.set(id, { status: 'pendente', tipo, codigo, competencia: comp, criadoEm: new Date().toISOString(), criadoPor: 'teste' });
  return { pedidos, banco, novo };
}

(async () => {
  const mk = (bom, extra = {}) => {
    const ctx = montar();
    ctx.estado = { bom, roteiros: 0, reabriu: 0, erroAmb: 'o Balancete Dinâmico não abriu', avisos: [] };
    ctx.painel = { fazendo() {}, atividade() {}, erro: (t, texto) => ctx.estado.avisos.push(texto) };
    const rodar = async (rel, a) => {
      ctx.estado.roteiros++;
      if (!ctx.estado.bom) return { ok: false, erro: rel === 'razao' ? ctx.estado.erroAmb.replace('o Balancete Dinâmico', 'a janela do Razão') : ctx.estado.erroAmb };
      fs.writeFileSync(a.destino, 'x'); return { ok: true };
    };
    ctx.fila = criarFilaAlterdata({ banco: ctx.banco, rodar, painel: ctx.painel, limiteMs: 300, apagarPasta: false, pausaMs: 1500, pausaSemTelaMs: 1000,
      pastaDoPedido: id => path.join(BASE, String(Math.random()), id), reabrirContabil: async () => { ctx.estado.reabriu++; }, ...extra });
    return ctx;
  };
  const st = (c, id) => c.pedidos.get(id).status;

  // 1. pedidos iguais na fila: um só roda, os outros recebem o mesmo resultado
  {
    const c = mk(true);
    for (let i = 0; i < 6; i++) c.novo('p' + i, 571, '2026-0' + (1 + i % 3));   // jan, fev, mar, jan, fev, mar
    for (let i = 0; i < 6; i++) c.fila.chegou('p' + i);
    await espera(5); await c.fila.ocioso();
    assert.strictEqual(c.estado.roteiros, 6, 'rodou repetido: ' + c.estado.roteiros);   // 3 meses × (balancete + razão)
    for (const [d, o] of [['p3', 'p0'], ['p4', 'p1'], ['p5', 'p2']]) {
      assert.strictEqual(st(c, d), 'pronto'); assert.strictEqual(c.pedidos.get(d).mesmoQue, o);
      assert.deepStrictEqual(c.pedidos.get(d).arquivos, c.pedidos.get(o).arquivos);
    }
    console.log('1. iguais na fila: ok');
  }
  // 1b. o igual também recebe a falha (e não roda de novo)
  {
    const c = mk(false);
    c.novo('x', 571, '2026-01'); c.novo('y', 571, '2026-01');
    c.fila.chegou('x'); c.fila.chegou('y');
    await espera(5); await c.fila.ocioso();
    assert.strictEqual(c.estado.roteiros, 2, 'o igual rodou: ' + c.estado.roteiros);
    assert.strictEqual(st(c, 'y'), 'erro'); assert.strictEqual(c.pedidos.get('y').mesmoQue, 'x');
    console.log('1b. igual recebe o mesmo erro: ok');
  }

  // 2 a 4. Contábil mudo: 3 falhas reabrem; mais 3 pausam; passada a pausa, com o Contábil bom, tudo sai
  {
    const c = mk(false);
    const ids = []; for (let i = 0; i < 12; i++) { ids.push('q' + i); c.novo('q' + i, 571, '2026-' + String(i + 1).padStart(2, '0')); }
    for (const id of ids) c.fila.chegou(id);
    await espera(5); await c.fila.ocioso();
    assert.strictEqual(c.estado.reabriu, 1, 'reabriu ' + c.estado.reabriu + ' vez(es)');
    assert.strictEqual(c.estado.roteiros, 12, 'depois da pausa não deve rodar mais: ' + c.estado.roteiros);   // 6 pedidos × 2
    for (const id of ids.slice(0, 5)) assert.strictEqual(st(c, id), 'erro', id);
    assert.match(c.pedidos.get('q0').erro, /^O Contábil não respondeu ao robô/);
    assert.match(c.pedidos.get('q2').erro, /fechar e abrir o Contábil/);
    assert.strictEqual(c.fila.pausada(), true, "pausada? " + [...c.pedidos].map(([k, v]) => k + ":" + v.status).join(" "));
    for (const id of ids.slice(5)) {
      assert.strictEqual(st(c, id), 'pendente', id + ' devia esperar, não virar erro');
      assert.match(c.pedidos.get(id).esperandoContabil, /esperando o Contábil/);
    }
    assert.strictEqual(c.estado.avisos.filter(a => /não está respondendo/.test(a)).length, 1, 'avisou mais de uma vez');
    console.log('2/3. reabriu 1x, pausou, ' + (ids.length - 5) + ' pedidos esperando, 1 aviso: ok');
    // passada a pausa, o Contábil volta
    c.estado.bom = true;
    await espera(1700); await c.fila.ocioso();
    for (const id of ids.slice(5)) { assert.strictEqual(st(c, id), 'pronto', id); assert.strictEqual(c.pedidos.get(id).esperandoContabil, ''); }
    assert.strictEqual(c.estado.avisos.filter(a => /não está respondendo/.test(a)).length, 1);
    console.log('4. depois da pausa os pedidos saem: ok');
  }

  // 5. sem sessão de tela: pausa sem queimar a fila, avisa uma vez
  {
    const c = mk(false);
    c.estado.erroAmb = 'SendInput() inserted only 0 out of 2 keyboard events';
    const ids = []; for (let i = 0; i < 5; i++) { ids.push('s' + i); c.novo('s' + i, 600 + i, '2026-09'); }
    for (const id of ids) c.fila.chegou(id);
    await espera(5); await c.fila.ocioso();
    assert.strictEqual(c.estado.roteiros, 2, 'queimou a fila: ' + c.estado.roteiros);
    for (const id of ids) assert.strictEqual(st(c, id), 'pendente', id);
    assert.match(c.pedidos.get('s0').esperandoContabil, /sem sessão de tela ativa/);
    assert.match(c.pedidos.get('s3').esperandoContabil, /sem sessão de tela ativa/);
    assert.strictEqual(c.estado.avisos.filter(a => /sem sessão de tela/.test(a)).length, 1);
    assert.strictEqual(c.estado.reabriu, 0, 'não reabre o Contábil por falta de tela');
    c.estado.bom = true;
    await espera(1200); await c.fila.ocioso();
    for (const id of ids) assert.strictEqual(st(c, id), 'pronto', id);
    console.log('5. sem tela ativa: pausou, avisou 1x, nada queimado, depois saiu: ok');
  }

  // 6. erro que não é de ambiente segue como era (e não conta falha)
  {
    const c = mk(false);
    c.estado.erroAmb = 'empresa 571 não encontrada na lista';
    c.novo('z', 571, '2026-01'); c.fila.chegou('z');
    await espera(5); await c.fila.ocioso();
    assert.strictEqual(st(c, 'z'), 'erro');
    assert.match(c.pedidos.get('z').erro, /^balancete: empresa 571 não encontrada/);
    console.log('6. erro comum segue igual: ok');
  }
  fs.rmSync(BASE, { recursive: true, force: true });
})().catch(err => { console.error('FALHOU:', err.stack || err.message); process.exit(1); });
