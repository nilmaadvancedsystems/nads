// O robô dos relatórios do Alterdata num PC Windows qualquer (16/11/2026, Vitor: "quero que voce puxe a logica robo de
// relatorios do alterdata do servidor, quero instalar no meu pc"). É o mesmo robô do NILMA-SERVER (alterdata.js: o balancete,
// o razão, a importação de lançamentos e as notas do Fiscal), sozinho num processo, usando o Contábil e o Fiscal que alguém
// deixa ABERTOS E LOGADOS neste PC. A fila é a mesma do servidor (pedidosAlterdata): cada pedido é pego numa transação, então
// o PC e o servidor juntos nunca fazem o mesmo; quem estiver com o Contábil pronto pega.
//
// Atualiza sozinho: a cada minuto olha o ramo desenvolvimento no GitHub; se chegou commit que muda o robo/, pede para sair com
// calma (termina o pedido do meio, não pega outro) e o iniciar.cmd puxa o código novo e liga de novo.
//
// Instalação: robo/pc-alterdata/LEIAME.md. Rodar à mão: node alterdata-no-pc.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// o nome deste PC na fila e no estado (robo/alterdata.maquinas.<onde>); a pasta de trabalho dos pedidos no disco local
process.env.ALTERDATA_ONDE = process.env.ALTERDATA_ONDE || ('pc-' + String(process.env.COMPUTERNAME || 'windows').toLowerCase());
// as planilhas saem em Downloads\\robo (17/11/2026, Vitor: "C:\\Users\\Vitor\\Downloads\\robo\\ sao onde vao ficar os arquivos";
// depois: "excluir o arquivo fisico depois de upar"): cada pedido trabalha numa subpasta de lá; com a planilha no nads, a
// subpasta é apagada (a que deu erro fica, para ver o que houve)
process.env.ALTERDATA_PEDIDOS = process.env.ALTERDATA_PEDIDOS || path.join(process.env.USERPROFILE || __dirname, 'Downloads', 'robo');
// só os pedidos do dono deste PC (17/11/2026, Vitor: "se todo mundo for usar meu pc, lascou"): a conta dele está em
// packages/core/src/robos/robosDePc.json, pela máquina (pc-<computador>); o alterdata.js confere. PC fora da lista: não pega nada.
process.env.ALTERDATA_SO_DONO = '1';
// as fotos da tela (o erro de janela) ficam fora do Downloads
process.env.ALTERDATA_TELA = process.env.ALTERDATA_TELA || path.join(process.env.LOCALAPPDATA || __dirname, 'nads-alterdata', 'tela');

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

// ---------- o que foi ensinado (17/11/2026, Vitor: "consegue entrar no diretorio do meu pc C:\\nads\\robo\\ensino e puxar
// sozinho?") ----------
// Cada gravação do modo de ensinar (alterdata_ensinar.py, robo\\ensino\\ensino-*.txt) sobe para o banco em robosEnsino, uma
// vez: quem ensina o robô lê de lá. Só o robô (conta do firebase login) grava e lê: as regras do app não abrem a coleção.
const PASTA_ENSINO = path.join(__dirname, 'ensino');
const ENVIADOS = path.join(PASTA_ENSINO, '.enviados.json');
async function subirEnsino() {
  let feitos = [];
  try { feitos = JSON.parse(fs.readFileSync(ENVIADOS, 'utf8')); } catch (e) { /* nenhum ainda */ }
  let arquivos = [];
  try { arquivos = fs.readdirSync(PASTA_ENSINO).filter(n => /^ensino-.*\.txt$/.test(n) && !feitos.includes(n)); } catch (e) { return; }
  for (const nome of arquivos) {
    try {
      const texto = fs.readFileSync(path.join(PASTA_ENSINO, nome), 'utf8');
      await db.collection('robosEnsino').doc(process.env.ALTERDATA_ONDE + '-' + nome.replace(/\.txt$/, '')).set({
        maquina: process.env.ALTERDATA_ONDE, nome, texto: texto.slice(0, 900000), tamanho: texto.length, em: new Date().toISOString(),
      });
      feitos.push(nome);
      fs.writeFileSync(ENVIADOS, JSON.stringify(feitos));
      log('ensino: subi ' + nome + ' para o banco (robosEnsino)');
    } catch (err) { log('ensino: não subi ' + nome + ':', err.message); }
  }
}
setInterval(() => { void subirEnsino(); }, 30 * 1000).unref();
setTimeout(() => { void subirEnsino(); }, 5 * 1000).unref();

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
// a cada minuto (17/11/2026, Vitor: "corrija o mais rapido possivel esse robo": o git fetch é barato)
if (!process.env.ALTERDATA_SEM_ATUALIZAR) setInterval(() => { void olharAtualizacao(); }, 60 * 1000).unref();
setTimeout(() => { void olharAtualizacao(); }, 20 * 1000).unref();
