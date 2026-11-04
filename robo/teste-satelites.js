// Teste dos robôs em processos próprios (04/11/2026): o filho fala com o painel do pai, segue trabalhando com o pai
// travado e sai quando o pai sai. node teste-satelites.js
'use strict';
const { fork } = require('child_process');
const path = require('path');
if (process.argv[2] === 'pai') {
  const painel = require('./painel');
  const recebidas = [];
  const original = painel.deSatelite;
  painel.deSatelite = m => { recebidas.push(m.painel); return original(m); };
  const sat = require('./satelites');
  sat.NOMES.eco = 'Eco';
  const tiques = [];
  const escrever = process.stdout.write.bind(process.stdout);
  process.stdout.write = (s) => { const m = /tique (\d+)/.exec(String(s)); if (m) tiques.push(+m[1]); return true; };
  sat.ligar(['eco'], () => {});
  setTimeout(() => {
    // o pai travado 3 s (como no G: lento)
    const ate = Date.now() + 3000; while (Date.now() < ate) { /* travado */ }
    setTimeout(() => {
      const lacunaMax = tiques.slice(1).reduce((m, t, i) => Math.max(m, t - tiques[i]), 0);
      let filho = 0; try { filho = parseInt(require('fs').readFileSync(path.join(__dirname, 'robo-eco.lock'), 'utf8'), 10); } catch (e) { /* sem trava */ }
      escrever(JSON.stringify({ filho, recebidas: [...new Set(recebidas)].sort(), tiques: tiques.length, lacunaMax }) + '\n');
      process.exit(0);
    }, 800);
  }, 2500);
} else {
  const pai = fork(__filename, ['pai'], { stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
  let saida = '';
  pai.stdout.on('data', b => { saida += b; });
  pai.on('exit', () => {
    const r = JSON.parse(saida.trim().split('\n').pop());
    const ok = (n, c) => { console.log((c ? 'ok   ' : 'FALHA') + ' ' + n); if (!c) process.exitCode = 1; };
    ok('o painel do pai recebeu o módulo e a atividade do filho (' + r.recebidas.join(', ') + ')', r.recebidas.includes('modulo') && r.recebidas.includes('atividade'));
    ok('o filho seguiu marcando o tempo com o pai travado 3 s (maior intervalo ' + r.lacunaMax + ' ms, ' + r.tiques + ' marcas)', r.lacunaMax < 1000 && r.tiques > 15);
    // o filho sai junto com o pai: a trava dele some
    const vivo = () => { try { process.kill(r.filho, 0); return true; } catch (e) { return false; } };
    const ate = Date.now() + 8000;
    const olhar = () => {
      if (!vivo()) return ok('o filho saiu junto com o pai', true);
      if (Date.now() > ate) { try { process.kill(r.filho); } catch (e) { /* já saiu */ } return ok('o filho saiu junto com o pai (vivo após 8 s)', false); }
      setTimeout(olhar, 250);
    };
    ok('o pai sabia qual era o processo do filho (' + r.filho + ')', !!r.filho);
    if (r.filho) olhar();
  });
}
