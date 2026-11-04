// Um robô do NILMA-SERVER num processo próprio (Vitor, 04/11/2026: "o fgts puxando, ai vem uma requisição do contabil
// rodando simultaneo, ai vem outra requisição do sieg e quero que todas funcione junto, sem fila"). O arquivador mexe no
// G: (o Drive em "transmitir") com operações que param o processo inteiro enquanto o Drive responde; o SIEG e o FGTS no
// mesmo processo ficavam parados junto. Aqui cada um tem o seu processo, o seu acesso ao banco e o seu ritmo.
//
// Quem liga: o arquivador (satelites.js), com o canal do child_process. O painel vai para o pai (painel.js, modo
// satélite). Se o pai sair (atualização, queda), este sai junto: o pai liga de novo quando voltar, e nunca ficam dois.
//   node robo-modulo.js sieg | fgts | alterdata
'use strict';
const fs = require('fs');
const path = require('path');

const qual = String(process.argv[2] || '');
const MODULOS = {
  sieg: (db, log) => require('./sieg').iniciarSieg({ db, log }),
  fgts: (db, log) => require('./fgts-claude').iniciarFgtsPeloClaude(db, log, { semClaude: true }),
  // o balancete e o razão do Alterdata Contábil aberto e logado neste servidor (04/11/2026: "isso tem que rodar no servidor")
  alterdata: (db, log) => require('./alterdata').iniciarAlterdata(db, log),
  // só para o teste (teste-satelites.js): marca o tempo a cada 200 ms e fala com o painel
  eco: (db, log) => { const p = require('./painel'); p.modulo('eco', 'Eco', true, 'teste'); p.atividade('robo', 'eco ligou'); setInterval(() => log('tique', Date.now()), 200); },
};
if (!MODULOS[qual]) { console.error('robo-modulo: qual módulo? (' + Object.keys(MODULOS).join(', ') + ')'); process.exit(2); }

const log = (...m) => console.log(new Date().toLocaleString('pt-BR'), '[' + qual + ']', ...m);

// ---------- um só por módulo ----------
const TRAVA = path.join(__dirname, 'robo-' + qual + '.lock');
try {
  const pid = parseInt(fs.readFileSync(TRAVA, 'utf8'), 10);
  if (pid && pid !== process.pid) { try { process.kill(pid, 0); log('já existe um robô do ' + qual + ' rodando (processo ' + pid + ')'); process.exit(3); } catch (e) { /* era de um processo morto */ } }
} catch (e) { /* sem trava */ }
fs.writeFileSync(TRAVA, String(process.pid));
process.on('exit', () => { try { if (parseInt(fs.readFileSync(TRAVA, 'utf8'), 10) === process.pid) fs.unlinkSync(TRAVA); } catch (e) { /* segue */ } });

// o pai saiu: este sai também (o próximo arquivador liga outro)
process.on('disconnect', () => { log('o arquivador saiu; saindo junto'); setTimeout(() => process.exit(0), 500); });
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
process.on('unhandledRejection', err => log('erro não tratado (segui rodando):', err && err.message ? err.message : String(err)));

const db = qual === 'eco' ? null : require('./firestore-client').getDb('entregas-2e5e2');
try { MODULOS[qual](db, log); log('ligado num processo próprio (' + process.pid + ')'); }
catch (err) { log(qual + ' não ligou:', err.message); require('./painel').modulo(qual, require('./satelites').NOMES[qual] || qual, false, err.message); }
