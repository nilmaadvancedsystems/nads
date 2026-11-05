// A sessão do robô sempre com tela ativa (05/11/2026). O Alterdata Contábil só aceita o clique de verdade (o mouse do
// Windows) com a área de trabalho ativa; quando alguém fecha o RDP sem sair, a sessão fica "desconectada" e o pywinauto
// para com "There is no active desktop required for moving mouse cursor!". O Vitor ("Sim, pode"): com a sessão do robô
// desconectada, o robô a passa para o console do servidor (tscon <id> /dest:console), que continua ativa sem ninguém
// conectado. Só quando ela já está desconectada: nunca derruba quem está usando o RDP.
'use strict';
const { execFile } = require('child_process');

const rodar = (cmd, args) => new Promise(resolve => execFile(cmd, args, { windowsHide: true, timeout: 30 * 1000 },
  (err, out, errs) => resolve({ err, out: String(out || ''), errs: String(errs || '') })));

/** A sessão deste processo: {id, estado} (estado como o Windows escreve: Ativo/Active, Disco/Disc…) ou null. */
async function minhaSessao() {
  if (process.platform !== 'win32') return null;
  const r = await rodar('query', ['session']);
  // a linha da sessão atual começa com '>'
  const linha = r.out.split(/\r?\n/).find(l => l.startsWith('>'));
  if (!linha) return null;
  // SESSIONNAME (pode faltar) USERNAME (pode ter espaço: "DPTO FISCAL 004") ID STATE [TYPE DEVICE]: o último número
  // seguido de uma palavra é o ID e o estado
  const achados = [...linha.slice(1).matchAll(/\s(\d+)\s+([A-Za-zÀ-ú]+)/g)];
  const m = achados[achados.length - 1];
  return m ? { id: m[1], estado: m[2] } : null;
}

/** Se a sessão está desconectada, passa para o console. Devolve o que fez (para o log) ou '' quando não precisou. */
async function garantirTelaAtiva() {
  const s = await minhaSessao();
  if (!s || !/^disc/i.test(s.estado)) return '';
  const r = await rodar('tscon', [s.id, '/dest:console']);
  if (r.err) return 'a sessão ' + s.id + ' está desconectada e o tscon não deu: ' + (r.errs || r.err.message).trim().slice(0, 200);
  return 'a sessão ' + s.id + ' estava desconectada: passei para o console do servidor (a tela continua ativa)';
}

module.exports = { garantirTelaAtiva, minhaSessao };
