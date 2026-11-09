// Teste da tela do robô do Alterdata (09/11/2026: no console do servidor, 1024x768, os cliques medidos em 1366x768 erravam
// e nenhum relatório abria). Roda o alterdata_tela.py de verdade nesta máquina (Windows com o pywin32), sem o Contábil e
// SEM trocar o modo de vídeo. Prova que:
//   1. as medidas saem (tela, modo, modos aceitos, área de trabalho);
//   2. a foto é um PNG válido do tamanho da tela virtual;
//   3. preparar_tela só acende a tela: não troca o modo de vídeo e o cursor volta ao lugar;
//   5. o erro de janela que não abriu leva a tela e a foto junto.
// Rodar: node robo/teste-alterdata-tela.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.platform !== 'win32') { console.log('pulado: só no Windows'); process.exit(0); }
const PYTHON = process.env.PYTHON_EXE || ['D:\\Programas\\Python313\\python.exe'].find(p => fs.existsSync(p)) || 'python';
const PASTA = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-alterdata-tela-'));
const py = codigo => execFileSync(PYTHON, ['-I', '-c', 'import sys, json; sys.stdout.reconfigure(encoding="utf-8"); sys.path.insert(0, ' + JSON.stringify(__dirname) + '); import alterdata_tela as t\n' + codigo],
  { encoding: 'utf8', env: { ...process.env, ALTERDATA_TELA: PASTA }, windowsHide: true }).trim();

// 1
const m = JSON.parse(py('print(json.dumps(t.medidas()))'));
assert.match(m.tela, /^\d+x\d+$/);
assert.ok(Array.isArray(m.modos) && m.modos.length, 'sem os modos de vídeo');
assert.ok(Array.isArray(m.janelas));
console.log('1. medidas: ok (tela ' + m.tela + ', ' + m.modos.length + ' modos, área de trabalho ' + m.entrada + ')');

// 2
const [caminho, porque] = JSON.parse(py('print(json.dumps(t.foto(' + JSON.stringify(PASTA) + ', "teste")))'));
assert.ok(caminho, 'a foto não saiu: ' + porque);
const png = fs.readFileSync(caminho);
assert.strictEqual(png.slice(0, 8).toString('hex'), '89504e470d0a1a0a');
const [lv, av] = JSON.parse(py('import win32api, win32con; print(json.dumps([win32api.GetSystemMetrics(win32con.SM_CXVIRTUALSCREEN), win32api.GetSystemMetrics(win32con.SM_CYVIRTUALSCREEN)]))'));
assert.strictEqual(png.readUInt32BE(16), lv);
assert.strictEqual(png.readUInt32BE(20), av);
console.log('2. foto: ok (' + lv + 'x' + av + ', ' + Math.round(png.length / 1024) + ' KB)');

// 3 e 4: preparar_tela só acende a tela (nada de trocar o modo de vídeo) e o cursor volta ao lugar
const antes = JSON.parse(py('import win32api; print(json.dumps(win32api.GetCursorPos()))'));
assert.strictEqual(py('print(repr(t.preparar_tela()))'), "''");
assert.strictEqual(JSON.parse(py('print(json.dumps(t.medidas()))')).tela, m.tela);
assert.ok(!fs.readFileSync(path.join(__dirname, 'alterdata_tela.py'), 'utf8').includes('ChangeDisplaySettings('), 'a troca de resolução voltou');
const depois = JSON.parse(py('import win32api; print(json.dumps(win32api.GetCursorPos()))'));
assert.deepStrictEqual(depois, antes);
console.log('3. preparar_tela acende a tela sem trocar o modo e o cursor volta: ok');

// 5
const r = py('print(t.resumo_do_erro("a janela do Razão não abriu", "teste-erro"))');
assert.match(r, /^a janela do Razão não abriu \(tela \d+x\d+;.*foto .+teste-erro\.png\)$/);
console.log('5. erro com a tela: ok');
fs.rmSync(PASTA, { recursive: true, force: true });
console.log('ok');
