// O robô dos relatórios do Alterdata num PC Windows qualquer (16/11/2026, Vitor: "quero que voce puxe a logica robo de
// relatorios do alterdata do servidor, quero instalar no meu pc"). É o mesmo robô do NILMA-SERVER (alterdata.js: o balancete,
// o razão, a importação de lançamentos e as notas do Fiscal), sozinho num processo, usando o Contábil e o Fiscal que alguém
// deixa ABERTOS E LOGADOS neste PC. A fila é a mesma do servidor (pedidosAlterdata): cada pedido é pego numa transação, então
// o PC e o servidor juntos nunca fazem o mesmo; quem estiver com o Contábil pronto pega.
//
// Atualiza sozinho: a cada 5 min olha o ramo desenvolvimento no GitHub; se chegou commit que muda o robo/, pede para sair com
// calma (termina o pedido do meio, não pega outro) e o iniciar.cmd puxa o código novo e liga de novo.
//
// Instalação: robo/pc-alterdata/LEIAME.md. Rodar à mão: node alterdata-no-pc.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// o nome deste PC na fila e no estado (robo/alterdata.maquinas.<onde>); a pasta de trabalho dos pedidos no disco local
process.env.ALTERDATA_ONDE = process.env.ALTERDATA_ONDE || ('pc-' + String(process.env.COMPUTERNAME || 'windows').toLowerCase());
process.env.ALTERDATA_PEDIDOS = process.env.ALTERDATA_PEDIDOS || path.join(process.env.LOCALAPPDATA || __dirname, 'nads-alterdata', 'pedidos');

const log = (...m) => console.log(new Date().toLocaleString('pt-BR'), '[alterdata-pc]', ...m);

// ---------- um só ----------
const TRAVA = path.join(__dirname, 'alterdata-no-pc.lock');
try {
  const pid = parseInt(fs.readFileSync(TRAVA, 'utf8'), 10);
  if (pid && pid !== process.pid) { try { process.kill(pid, 0); log('já existe um robô do Alterdata rodando neste PC (processo ' + pid + ')'); process.exit(3); } catch (e) { /* era de um processo morto */ } }
} catch (e) { /* sem trava */ }
fs.writeFileSync(TRAVA, String(process.pid));
process.on('exit', () => { try { if (parseInt(fs.readFileSync(TRAVA, 'utf8'), 10) === process.pid) fs.unlinkSync(TRAVA); } catch (e) { /* segue */ } });

const ocupado = require('./ocupado');
ocupado.iniciar({ nome: 'alterdata-pc', log, sair: () => setTimeout(() => process.exit(0), 300) });
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
process.on('unhandledRejection', err => log('erro não tratado (segui rodando):', err && err.message ? err.message : String(err)));

const { getDb, credencialUsada } = require('./firestore-client');
const db = getDb('entregas-2e5e2');
log('banco: credencial ' + credencialUsada());
require('./consumo').instalar(db, { log, tarefa: 'alterdata' });
try { require('./alterdata').iniciarAlterdata(db, log); log('ligado neste PC como "' + process.env.ALTERDATA_ONDE + '"'); }
catch (err) { log('Alterdata não ligou:', err.message); }

// ---------- o código novo do GitHub ----------
const RAIZ = path.dirname(__dirname);
const GIT = process.env.GIT_EXE || 'git';
const git = args => new Promise(resolve => execFile(GIT, ['-C', RAIZ, ...args], { windowsHide: true, timeout: 120 * 1000 }, (err, out) => resolve(err ? null : String(out || '').trim())));
async function olharAtualizacao() {
  if (ocupado.parando()) return;
  if (await git(['fetch', '-q', 'origin', 'desenvolvimento']) === null) return;
  const mudou = await git(['diff', '--name-only', 'HEAD', 'origin/desenvolvimento', '--', 'robo', 'packages/core/src/robos']);
  if (!mudou) return;
  log('chegou código novo do robô (' + mudou.split('\n').slice(0, 6).join(', ') + '): saio com calma para o iniciar.cmd atualizar');
  void ocupado.pedirParada('atualização do GitHub');
}
if (!process.env.ALTERDATA_SEM_ATUALIZAR) setInterval(() => { void olharAtualizacao(); }, 5 * 60 * 1000).unref();
setTimeout(() => { void olharAtualizacao(); }, 60 * 1000).unref();
