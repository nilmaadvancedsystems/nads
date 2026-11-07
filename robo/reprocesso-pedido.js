// O pedido de reprocesso dos NÃO IDENTIFICADOS (05/11/2026). O reprocesso precisa do G:, que só existe na sessão do
// Administrador do servidor (a tarefa remota roda como SYSTEM e não vê o Drive). Então o arquivador, que roda nessa sessão,
// olha a cada minuto o arquivo <CONTROLE>\reprocessar-ni.pedido. Quem pede escreve nele o filtro do caminho (ex.:
// "20261105-NOVO"; vazio = todos). O arquivador renomeia o pedido para .rodando, roda "reprocessar-ni.js --aplicar --apenas <filtro>"
// e, no fim, renomeia para .feito com o código de saída. A saída vai para reprocesso-ni-<AAAA-MM-DD>.log no CONTROLE.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function iniciar({ controle, log }) {
  const pedido = path.join(controle, 'reprocessar-ni.pedido');
  let rodando = false;
  const olhar = () => {
    if (rodando || !fs.existsSync(pedido)) return;
    let filtro = '';
    try { filtro = fs.readFileSync(pedido, 'utf8').trim().split(/\r?\n/)[0].trim(); } catch (e) { return; }
    const emCurso = pedido.replace(/\.pedido$/, '.rodando');
    try { fs.renameSync(pedido, emCurso); } catch (e) { return; }
    rodando = true;
    const dia = new Date().toISOString().slice(0, 10);
    const saida = path.join(controle, 'reprocesso-ni-' + dia + (filtro ? '-' + filtro.replace(/[^A-Za-z0-9-]+/g, '_') : ''));
    const args = [path.join(__dirname, 'reprocessar-ni.js'), '--aplicar', '--saida', saida].concat(filtro ? ['--apenas', filtro] : []);
    const arqLog = fs.openSync(saida + '.log', 'a');
    log('reprocesso dos NÃO IDENTIFICADOS pedido' + (filtro ? ' (só "' + filtro + '")' : ' (todos)') + ': começando');
    const p = spawn(process.execPath, args, { cwd: __dirname, stdio: ['ignore', arqLog, arqLog], windowsHide: true });
    p.on('exit', code => {
      rodando = false;
      try { fs.closeSync(arqLog); } catch (e) { /* segue */ }
      try { fs.renameSync(emCurso, pedido.replace(/\.pedido$/, '.feito')); fs.appendFileSync(pedido.replace(/\.pedido$/, '.feito'), '\nsaiu com ' + code + ' em ' + new Date().toISOString() + '\n'); } catch (e) { /* segue */ }
      log('reprocesso dos NÃO IDENTIFICADOS: terminou (código ' + code + '); resumo em ' + saida);
    });
    p.on('error', err => { rodando = false; log('reprocesso dos NÃO IDENTIFICADOS não rodou: ' + err.message); });
  };
  // (Vitor, 05/11/2026: "quero que isso não aconteça de novo") quando as regras mudam (o robô religa com outro arquivador-regras/arquivador-novo), os
  // NÃO IDENTIFICADOS dos últimos 3 dias são reprocessados sozinhos: o que a regra nova resolve sai de lá sem ninguém pedir
  try {
    const versao = require('./arquivador-novo').versaoDasRegras();   // a mesma versão que o reprocessar-ni.js carimba nos já decididos
    const marca = path.join(controle, 'reprocesso-auto.json');
    let antes = null;
    try { antes = JSON.parse(fs.readFileSync(marca, 'utf8')).versao; } catch (e) { /* primeira vez */ }
    if (antes !== versao && !fs.existsSync(pedido) && !fs.existsSync(pedido.replace(/\.pedido$/, '.rodando'))) {
      const dias = [0, 1, 2].map(n => { const d = new Date(Date.now() - n * 864e5); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-NOVO'; });
      if (antes) fs.writeFileSync(pedido, dias.join(',') + '\n');   // a primeira vez só anota a versão
      fs.writeFileSync(marca, JSON.stringify({ versao, em: new Date().toISOString(), dias: antes ? dias : [] }));
      if (antes) log('as regras do arquivador mudaram: os NÃO IDENTIFICADOS de ' + dias.join(', ') + ' vão ser reprocessados');
    }
  } catch (e) { log('reprocesso automático: ' + e.message); }
  setInterval(olhar, 60 * 1000);
  setTimeout(olhar, 15 * 1000);
}

module.exports = { iniciar };
