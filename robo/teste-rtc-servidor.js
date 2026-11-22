// Testes do rtc-servidor.js (21/11/2026): o robô instala ou liga a calculadora da Receita sozinho. Sem rede e sem rodar o
// PowerShell (um spawn falso). Rode:  node teste-rtc-servidor.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const R = require('./rtc-servidor');

let falhas = 0, total = 0;
function igual(nome, obtido, esperado) {
  total++;
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a !== b) { falhas++; console.log('FALHOU  ' + nome + '\n        obtido:   ' + a + '\n        esperado: ' + b); }
}

/** um spawn falso: escreve a saída e sai com o código; anota o que foi chamado */
function spawnFalso(saida, codigo, chamadas, aoRodar = () => {}) {
  return (exe, args) => {
    chamadas.push([exe, args.slice(0, 4)]);
    const p = new EventEmitter();
    p.stdout = new EventEmitter(); p.stderr = new EventEmitter();
    p.kill = () => {};
    setImmediate(() => { aoRodar(); p.stdout.emit('data', Buffer.from(saida, 'utf8')); p.emit('close', codigo); });
    return p;
  };
}
/** uma calculadora falsa: no ar quando `noAr.valor` */
const calcFalsa = noAr => ({ url: 'http://127.0.0.1:18080/api', versao: async () => (noAr.valor ? '1.7.2 · base 2026.11' : null) });
/** um painel falso que anota as chamadas */
function painelFalso() { const v = []; return { v, modulo: (...a) => v.push(['modulo', ...a]), atividade: (...a) => v.push(['atividade', ...a]), erro: (...a) => v.push(['erro', ...a]) }; }

const SAIDA = [
  'openjdk version "25.0.1" 2025-10-21 LTS',
  'regime-regular 1.7.2 já instalada.',
  'simples-nacional 1.0.2 já instalada.',
  'regime-regular: no ar em 127.0.0.1:18080',
  'simples-nacional: no ar em 127.0.0.1:18082',
  'Memória de api-regime-geral.jar: 310 MB (pico 330 MB)',
  'Memória de api-simples-nacional.jar: 280 MB (pico 290 MB)',
  'Memória livre no PC agora: 5.120 MB',
].join('\r\n');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtc-'));

  // ---- já no ar: nada a fazer ----
  {
    const ch = [], painel = painelFalso();
    const g = R.criarGarantia({ calc: calcFalsa({ valor: true }), pasta: tmp, plataforma: 'win32', executar: spawnFalso('', 0, ch), painel });
    igual('no ar: não roda o instalador', [await g.garantir(), ch.length], ['no-ar', 0]);
    igual('no ar: o módulo no painel com a versão', painel.v[0], ['modulo', 'rtc', 'Calculadora da Receita (IBS/CBS)', true, '1.7.2 · base 2026.11']);
  }

  // ---- fora do ar: roda o instalador, que liga ----
  {
    const ch = [], painel = painelFalso(), linhas = [];
    const noAr = { valor: false };
    const g = R.criarGarantia({ calc: calcFalsa(noAr), pasta: tmp, plataforma: 'win32', executar: spawnFalso(SAIDA, 0, ch, () => { noAr.valor = true; }), painel, log: (...m) => linhas.push(m.join(' ')) });
    igual('fora do ar: ligou', await g.garantir(), 'ligada');
    igual('chama o PowerShell com o script', ch[0], ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command']]);
    igual('a memória no painel', painel.v.find(x => x[0] === 'atividade'), ['atividade', 'sieg', 'Calculadora da Receita no ar (1.7.2 · base 2026.11)',
      'Memória de api-regime-geral.jar: 310 MB (pico 330 MB) · Memória de api-simples-nacional.jar: 280 MB (pico 290 MB) · Memória livre no PC agora: 5.120 MB']);
    igual('o registro com as linhas que importam', linhas.filter(l => /no ar em|Memória/.test(l)).length, 5);
    igual('a saída inteira no instalar.log', /pico 290 MB/.test(fs.readFileSync(path.join(tmp, 'instalar.log'), 'utf8')), true);
  }

  // ---- falhou: avisa e só tenta de novo depois de 6 h ----
  {
    const ch = [], painel = painelFalso();
    let t = 1e12;
    const g = R.criarGarantia({ calc: calcFalsa({ valor: false }), pasta: tmp, plataforma: 'win32', executar: spawnFalso('Instalando regime-regular 1.7.2...\r\no banco de regime-regular não foi gerado', 1, ch), painel, agora: () => t });
    igual('falhou', await g.garantir(), 'falhou');
    igual('falhou: o erro no painel', painel.v.find(x => x[0] === 'erro').slice(0, 3), ['erro', 'sieg', 'A calculadora da Receita não ficou no ar']);
    // a porta ocupada (22/11/2026): a linha de quem não ligou vai para o painel, não o fim da saída
    const painel2 = painelFalso();
    const saida = 'regime-regular: NÃO ligou: porta 18080 ocupada por httpd (pid 4)\r\nsimples-nacional: no ar em 127.0.0.1:18082\r\nMemória livre no PC agora: 24.405 MB';
    await R.criarGarantia({ calc: calcFalsa({ valor: false }), pasta: tmp, plataforma: 'win32', executar: spawnFalso(saida, 1, []), painel: painel2 }).garantir();
    igual('porta ocupada: o motivo no painel', painel2.v.find(x => x[0] === 'erro')[3], 'código 1 — regime-regular: NÃO ligou: porta 18080 ocupada por httpd (pid 4)');
    t += 3600e3;
    igual('1 h depois: não tenta de novo', [await g.garantir(), ch.length], ['pulou', 1]);
    t += 6 * 3600e3;
    igual('7 h depois: tenta de novo', [await g.garantir(), ch.length], ['falhou', 2]);
  }

  // ---- fora do Windows (a nuvem) e o instalador que não sai ----
  {
    const ch = [];
    const g = R.criarGarantia({ calc: calcFalsa({ valor: false }), pasta: tmp, plataforma: 'linux', executar: spawnFalso('', 0, ch) });
    igual('linux: pula', [await g.garantir(), ch.length], ['pulou', 0]);
    const travado = () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.kill = () => p.emit('close', null); return p; };
    const r = await R.rodarInstalador({ pasta: tmp, executar: travado, esperaMax: 20 });
    igual('instalador travado: para no tempo', r.codigo, -1);
  }

  // ---- a pasta e o resumo da saída ----
  igual('pasta: D: quando existe', R.pastaPadrao(p => p === 'D:\\'), 'D:\\nads-rtc');
  igual('pasta: C: sem o D:', R.pastaPadrao(() => false), 'C:\\nads-rtc');
  igual('resumo da saída', R.resumoDaSaida(SAIDA).length, 7);

  console.log(falhas ? falhas + ' de ' + total + ' falharam' : 'ok: ' + total + ' testes');
  process.exit(falhas ? 1 : 0);
})();
