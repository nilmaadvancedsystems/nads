// O pedido de reprocesso dos NÃO IDENTIFICADOS (05/11/2026). O reprocesso precisa do G:, que só existe na sessão do
// Administrador do servidor (a tarefa remota roda como SYSTEM e não vê o Drive). Então o arquivador, que roda nessa sessão,
// olha a cada minuto o arquivo <CONTROLE>\reprocessar-ni.pedido. Quem pede escreve nele o filtro do caminho (ex.:
// "20261105-NOVO"; vazio = todos). O arquivador renomeia o pedido para .rodando, roda "reprocessar-ni.js --aplicar --apenas <filtro>"
// e, no fim, renomeia para .feito com o código de saída. A saída vai para reprocesso-ni-<AAAA-MM-DD>.log no CONTROLE.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// (26/11/2026, decisão do dono) as levas únicas: o reprocesso automático olha só as pastas-dia dos últimos 3 dias, e o produtor rural (NFA-e, GTA, GCA, ITR e o DAE da
// GTA, regras novas) está nas pastas-dia de 09/11 e de outros dias. Cada leva roda UMA vez (o id fica em reprocesso-auto.json) na próxima mudança de regras e não volta.
const LEVAS_UNICAS = [{ id: 'produtor-rural-2026-11-26', filtro: 'PRODUTOR RURAL' }];
/** Os filtros do reprocesso automático: as pastas-dia dos últimos 3 dias e as levas únicas que ainda não rodaram. → { dias, filtros, levas: [ids] } */
function filtrosDoReprocessoAuto(agoraMs, jaFeitas) {
  const dias = [0, 1, 2].map(n => { const d = new Date(agoraMs - n * 864e5); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-NOVO'; });
  const levas = LEVAS_UNICAS.filter(l => !(jaFeitas || []).includes(l.id));
  return { dias, filtros: dias.concat(levas.map(l => l.filtro)), levas: levas.map(l => l.id) };
}
function iniciar({ controle, log }) {
  const pedido = path.join(controle, 'reprocessar-ni.pedido');
  let rodando = false;
  const olhar = () => {
    // saindo com calma (ocupado.js, 07/11/2026): o pedido fica para o arquivador que ligar depois
    if (rodando || require('./ocupado').parando() || !fs.existsSync(pedido)) return;
    let filtro = '';
    try { filtro = fs.readFileSync(pedido, 'utf8').trim().split(/\r?\n/)[0].trim(); } catch (e) { return; }
    const emCurso = pedido.replace(/\.pedido$/, '.rodando');
    try { fs.renameSync(pedido, emCurso); } catch (e) { return; }
    rodando = true;
    require('./ocupado').marcar('reprocesso', 'Reprocessando os NÃO IDENTIFICADOS' + (filtro ? ' (' + filtro + ')' : ''));
    const dia = new Date().toISOString().slice(0, 10);
    const saida = path.join(controle, 'reprocesso-ni-' + dia + (filtro ? '-' + filtro.replace(/[^A-Za-z0-9-]+/g, '_') : ''));
    const args = [path.join(__dirname, 'reprocessar-ni.js'), '--aplicar', '--saida', saida].concat(filtro ? ['--apenas', filtro] : []);
    const arqLog = fs.openSync(saida + '.log', 'a');
    log('reprocesso dos NÃO IDENTIFICADOS pedido' + (filtro ? ' (só "' + filtro + '")' : ' (todos)') + ': começando');
    const p = spawn(process.execPath, args, { cwd: __dirname, stdio: ['ignore', arqLog, arqLog], windowsHide: true });
    p.on('exit', code => {
      rodando = false;
      require('./ocupado').marcar('reprocesso', null);
      try { fs.closeSync(arqLog); } catch (e) { /* segue */ }
      try { fs.renameSync(emCurso, pedido.replace(/\.pedido$/, '.feito')); fs.appendFileSync(pedido.replace(/\.pedido$/, '.feito'), '\nsaiu com ' + code + ' em ' + new Date().toISOString() + '\n'); } catch (e) { /* segue */ }
      log('reprocesso dos NÃO IDENTIFICADOS: terminou (código ' + code + '); resumo em ' + saida);
    });
    p.on('error', err => { rodando = false; require('./ocupado').marcar('reprocesso', null); log('reprocesso dos NÃO IDENTIFICADOS não rodou: ' + err.message); });
  };
  // (Vitor, 05/11/2026: "quero que isso não aconteça de novo") quando as regras mudam (o robô religa com outro arquivador-regras/arquivador-novo), os
  // NÃO IDENTIFICADOS dos últimos 3 dias são reprocessados sozinhos: o que a regra nova resolve sai de lá sem ninguém pedir
  try {
    const versao = require('./arquivador-novo').versaoDasRegras();   // a mesma versão que o reprocessar-ni.js carimba nos já decididos
    const marca = path.join(controle, 'reprocesso-auto.json');
    let antes = null, feitas = [];
    try { const m = JSON.parse(fs.readFileSync(marca, 'utf8')); antes = m.versao; feitas = m.levas || []; } catch (e) { /* primeira vez */ }
    // dispara quando as regras mudaram OU quando há uma leva única que ainda não rodou (e a marca já existe: a primeira vez só anota a versão)
    const pendentes = filtrosDoReprocessoAuto(Date.now(), feitas).levas.length;
    if ((antes !== versao || (antes && pendentes)) && !fs.existsSync(pedido) && !fs.existsSync(pedido.replace(/\.pedido$/, '.rodando'))) {
      const { dias, filtros, levas } = filtrosDoReprocessoAuto(Date.now(), feitas);
      if (antes) fs.writeFileSync(pedido, filtros.join(',') + '\n');   // a primeira vez só anota a versão
      fs.writeFileSync(marca, JSON.stringify({ versao, em: new Date().toISOString(), dias: antes ? dias : [], levas: antes ? feitas.concat(levas) : feitas }));
      if (antes) log('as regras do arquivador mudaram: os NÃO IDENTIFICADOS de ' + filtros.join(', ') + ' vão ser reprocessados');
    }
  } catch (e) { log('reprocesso automático: ' + e.message); }
  setInterval(olhar, 60 * 1000);
  setTimeout(olhar, 15 * 1000);
}

module.exports = { iniciar, filtrosDoReprocessoAuto, LEVAS_UNICAS };
