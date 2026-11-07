// O que precisa DESTE PC (03/11/2026). O arquivador e o SIEG foram para o NILMA-SERVER (Windows Server 2019: sem o
// Claude Code e sem o Contábil logado), e lá rodam com ARQ_SO_SERVIDOR=1. Aqui ficam só o FGTS pelo Claude, o balancete
// do Alterdata, o atendente de IA e o suporte. Não bate ponto no painel (o painel conhece o robô do PC e o da nuvem; o
// do PC agora é o servidor).
'use strict';
const fs = require('fs');
const path = require('path');
const { getDb } = require('./firestore-client');

const log = (...m) => console.log(new Date().toLocaleString('pt-BR'), '[pc]', ...m);

// ---------- um só ----------
const TRAVA = path.join(__dirname, 'claude-do-pc.lock');
try {
  const pid = parseInt(fs.readFileSync(TRAVA, 'utf8'), 10);
  if (pid && pid !== process.pid) { try { process.kill(pid, 0); log('já existe um claude-do-pc rodando (processo ' + pid + ')'); process.exit(3); } catch (e) {} }
} catch (e) {}
fs.writeFileSync(TRAVA, String(process.pid));
process.on('exit', () => { try { if (parseInt(fs.readFileSync(TRAVA, 'utf8'), 10) === process.pid) fs.unlinkSync(TRAVA); } catch (e) {} });

const db = getDb('entregas-2e5e2');
// o freio de consumo do banco (07/11/2026, consumo.js): soma as leituras e gravações deste processo por tarefa; acima do
// teto (20 mil leituras ou 5 mil gravações em 10 min) pausa 15 min a tarefa que mais gastou e avisa os admins (1 por hora)
require('./consumo').instalar(db, { log });
let pararIA = null;

try { require('./fgts-claude').iniciarFgtsPeloClaude(db, log); }
catch (err) { log('FGTS não ligou:', err.message); }
// o Alterdata foi para o NILMA-SERVER (04/11/2026: "isso tem que rodar no servidor"); aqui só com ALTERDATA_NO_PC=1 (o
// robô pega o pedido numa transação: o PC e o servidor juntos nunca fazem o mesmo)
if (process.env.ALTERDATA_NO_PC === '1') {
  try { require('./alterdata').iniciarAlterdata(db, log); }
  catch (err) { log('Alterdata não ligou:', err.message); }
}
try { pararIA = require('./atendente-claude').iniciarAtendenteClaude({ db, log }); }
catch (err) { log('atendente de IA desligado:', err.message); }
try { require('./suporte-claude').iniciarSuporteClaude({ db, log }); }
catch (err) { log('suporte desligado:', err.message); }
// a Central dos robôs (07/11/2026, central.js): os comandos do site robos-nilma para este PC (lista fechada), o espelho do
// log e o estado da máquina. O atendente de IA sabe pausar (para de atender; retomar liga de novo).
try {
  const central = require('./central');
  central.registrarPausa('ia', {
    pausar: async () => { const p = pararIA; pararIA = null; if (p) await p(); },
    retomar: async () => { if (!pararIA) pararIA = require('./atendente-claude').iniciarAtendenteClaude({ db, log }); },
  });
  central.iniciarCentral({ db, maquina: 'escritorio', log });
} catch (err) { log('central dos robôs não ligou:', err.message); }
log('ligado: FGTS' + (process.env.ALTERDATA_NO_PC === '1' ? ', Alterdata' : '') + ', atendente de IA e suporte');

function desligar() {
  Promise.resolve(pararIA ? pararIA() : null).catch(() => {}).finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}
process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);
process.on('unhandledRejection', err => log('erro não tratado (segui rodando):', err && err.message ? err.message : String(err)));
