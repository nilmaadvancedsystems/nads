// Teste do alterdata_sessao.py (19/11/2026: o acesso remoto no meio dos pedidos do Alterdata). Roda o Python de verdade
// nesta máquina (só ctypes; não precisa do pywin32 nem do Contábil) e troca a sessão por uma de mentira onde precisa. Prova:
//   1. situacao() mede esta sessão (id, estado, console, tela, escala, área de trabalho) e o SESSAO: sai em JSON;
//   2. garantir(): no console devolve na hora; com alguém conectado por acesso remoto (no servidor) para com a frase clara,
//      sem tscon; no PC, a sessão remota não para; desconectada, passa para o console e espera a tela parar de mudar;
//      sem área de trabalho, para com "sem sessão de tela ativa".
// Rodar: node robo/teste-alterdata-sessao.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const { execFileSync } = require('child_process');

if (process.platform !== 'win32') { console.log('pulado: só no Windows'); process.exit(0); }
const PYTHON = process.env.PYTHON_EXE || ['D:\\Programas\\Python313\\python.exe'].find(p => fs.existsSync(p)) || 'python';
const py = codigo => execFileSync(PYTHON, ['-I', '-c', 'import sys, json, time; sys.stdout.reconfigure(encoding="utf-8"); sys.path.insert(0, ' + JSON.stringify(__dirname) + '); import alterdata_sessao as s\n' + codigo],
  { encoding: 'utf8', windowsHide: true }).trim();

// 1
const agora = JSON.parse(py('print(json.dumps(s.situacao()))'));
assert.match(agora.tela, /^\d+x\d+$/);
assert.ok(Number.isInteger(agora.sessao) && agora.escala >= 100);
for (const k of ['ativa', 'desconectada', 'remota', 'console', 'entrada']) assert.strictEqual(typeof agora[k], 'boolean', k);
const cli = execFileSync(PYTHON, ['-I', require('path').join(__dirname, 'alterdata_sessao.py')], { encoding: 'utf8', windowsHide: true });
assert.match(cli, /^SESSAO: \{.*"tela": "\d+x\d+"/m);
console.log('1. situacao: ok (sessão ' + agora.sessao + ' ' + agora.estado + (agora.console ? ', console' : '') + (agora.remota ? ', remota' : '') + ', tela ' + agora.tela + ' a ' + agora.escala + '%)');

// 2: a sessão de mentira (uma lista de situações, uma por leitura) e o tscon contado
const mentira = lista => `
seq = ${JSON.stringify(lista).replace(/true/g, 'True').replace(/false/g, 'False')}
ultima = [seq[0]]
def sit():
    if seq: ultima[0] = seq.pop(0)
    return dict(ultima[0])
s.situacao = sit
tscon = []
s._tscon = lambda sid: tscon.append(sid) or ''
avisos = []
def rodar(servidor, segundos=5, parada=0.6):
    try:
        r = s.garantir(servidor, segundos=segundos, parada=parada, avisar=avisos.append)
        return {'ok': True, 'tela': r['tela'], 'tscon': len(tscon), 'avisos': avisos}
    except (s.Ocupada, s.SemTela) as e:
        return {'ok': False, 'tipo': type(e).__name__, 'erro': str(e), 'tscon': len(tscon), 'avisos': avisos}
`;
const base = { sessao: 2, estado: 'ativa', ativa: true, desconectada: false, remota: false, console: true, tela: '1024x768', escala: 100, entrada: true };
const rdp = { ...base, remota: true, console: false, tela: '2880x1800', escala: 200 };
const disc = { ...base, estado: 'desconectada', ativa: false, desconectada: true, console: false, entrada: false };
const caso = (lista, chamada) => JSON.parse(py(mentira(lista) + 'print(json.dumps(' + chamada + '))'));

let r = caso([base], 'rodar(True)');
assert.deepStrictEqual([r.ok, r.tscon], [true, 0]);

r = caso([rdp], 'rodar(True)');
assert.strictEqual(r.tipo, 'Ocupada'); assert.strictEqual(r.tscon, 0, 'nunca tira quem está conectado');
assert.match(r.erro, /^alguém está usando o servidor por acesso remoto \(.*2880x1800 a 200%\).*desconectar, sem sair/);

r = caso([rdp], 'rodar(False)');
assert.strictEqual(r.ok, true, 'no PC de uma pessoa, a sessão remota não para o robô');

// desconectada: tscon, a tela ainda mudando (o Contábil se redesenha), depois parada no console
r = caso([disc, disc, { ...base, tela: '2880x1800' }, base, base, base, base, base], 'rodar(True)');
assert.deepStrictEqual([r.ok, r.tela, r.tscon], [true, '1024x768', 1]);
assert.match(r.avisos[0], /estava desconectada: passei para o console/);
assert.match(r.avisos[1], /a tela voltou \(1024x768, 100%\)/);

// desconectada e alguém entra de novo enquanto espera
r = caso([disc, disc, rdp], 'rodar(True)');
assert.strictEqual(r.tipo, 'Ocupada');

// sem área de trabalho que volte
r = caso([disc], 'rodar(True, segundos=1.5)');
assert.strictEqual(r.tipo, 'SemTela'); assert.match(r.erro, /^o servidor está sem sessão de tela ativa/);
console.log('2. garantir (console, remoto no servidor e no PC, desconectada, alguém volta, sem tela): ok');
