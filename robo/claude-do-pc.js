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
let pararIA = null;

try { require('./fgts-claude').iniciarFgtsPeloClaude(db, log); }
catch (err) { log('FGTS não ligou:', err.message); }
try { require('./alterdata').iniciarAlterdata(db, log); }
catch (err) { log('Alterdata não ligou:', err.message); }
try { pararIA = require('./atendente-claude').iniciarAtendenteClaude({ db, log }); }
catch (err) { log('atendente de IA desligado:', err.message); }
try { require('./suporte-claude').iniciarSuporteClaude({ db, log }); }
catch (err) { log('suporte desligado:', err.message); }
log('ligado: FGTS, balancete do Alterdata, atendente de IA e suporte');

function desligar() {
  Promise.resolve(pararIA ? pararIA() : null).catch(() => {}).finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}
process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);
process.on('unhandledRejection', err => log('erro não tratado (segui rodando):', err && err.message ? err.message : String(err)));
