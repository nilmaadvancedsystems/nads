// O atualizador dos robôs (07/11/2026): atualizar sem matar o trabalho no meio.
//
// De 03 a 07/11 foram 35 publicações, 59 reinícios do NILMA-SERVER (o atualizar-robo.cmd fazia Stop-Process -Force a cada
// uma) e 12 da máquina da nuvem: o pedido do SIEG recomeçou 5 vezes, o Contábil do Alterdata foi reaberto, o backup da
// nuvem falhou e o arquivador releu os índices (~2 min) a cada vez. Agora:
//
//   1. SÓ REINICIA SE MUDOU ALGO QUE ESTE ROBÔ USA: cada processo do robô grava robo/robo-vivo-<nome>.json (ocupado.js)
//      com os arquivos do robô que carregou. Mudou só o app, um teste, um .md, o código da outra máquina: o código novo
//      entra sem reiniciar. Sem a lista (robô antigo), tudo o que é do robô conta.
//   2. NO MÁXIMO UM REINÍCIO A CADA 30 MIN: o que chegar nesse meio-tempo vai junto no próximo. Commit com [urgente] na
//      mensagem (ou, no servidor, o arquivo D:\nads-dados\atualizar-urgente; na nuvem, "urgente" no robo-versao) passa
//      na frente. Também espera as janelas da madrugada (a releitura do Drive da nuvem, 03:00) e, por até 30 min, o robô
//      ocupado com algo longo (o backup, um lote, a contagem da madrugada do SIEG).
//   3. REINÍCIO EDUCADO: em vez de matar, pede para sair (o arquivo robo/sair.pedido no servidor; o systemctl stop, que
//      manda SIGTERM, na nuvem). O robô para de pegar pedido novo, termina o que está fazendo (até 10 min) e sai sozinho.
//      Só depois de 12 min o atualizador força (taskkill /T /F). O reset do git vem DEPOIS da saída: o processo velho
//      nunca carrega um arquivo novo pela metade, e o novo espera o reset terminar (ocupado.esperarAtualizacao).
//
// Este arquivo NÃO roda de dentro do repositório: quem chama tira a versão do commit novo com "git show" para uma cópia
// e roda a cópia (o reset não troca o código de quem está atualizando). Por isso só usa o que vem com o Node.
//
//   servidor (a tarefa nads-atualizar-robo, SYSTEM, pelo D:\nads-dados\atualizar-robo.cmd = robo/servidor/atualizar-robo.cmd):
//     node atualizar-robo.js servidor --repo D:\nads --git D:\Programas\Git\cmd\git.exe --dados D:\nads-dados
//   nuvem (o robo-interruptor, a cada minuto, como o usuário robo; quem para e liga é o interruptor, como root):
//     node atualizar-robo.js decidir --repo /opt/robo/nads --versao <robo-versao> --estado /opt/robo/atualizar-estado.json
//     node atualizar-robo.js registrar --estado /opt/robo/atualizar-estado.json      (depois de reiniciar)
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAMO = 'desenvolvimento';
const INTERVALO_MS = 30 * 60 * 1000;          // no máximo um reinício a cada 30 min
const ESPERA_OCUPADO_MAX_MS = 30 * 60 * 1000;  // robô ocupado: espera até 30 min antes de pedir para sair
const SAIDA_LIMITE_MS = 12 * 60 * 1000;        // o robô sai sozinho em até 10 min; 12 e o atualizador força
const DURACAO_MAX_MS = 4 * 36e5;               // um atualizador esperando não fica para sempre
const PEDIDO = 'sair.pedido';                  // = ocupado.PEDIDO
const PROTOCOLO = 1;                           // = ocupado.PROTOCOLO

// ---------- o que importa ----------
// nunca reinicia o robô: teste, documentação, o próprio atualizador, os instaladores das máquinas
const NUNCA = [/^robo\/teste-/, /\.md$/i, /^robo\/servidor\//, /^robo\/nuvem\//, /^robo\/atualizar-robo\.js$/, /(^|\/)\.gitignore$/, /\/__pycache__\//];
// sempre: as dependências
const SEMPRE = [/^robo\/package(-lock)?\.json$/];
// arquivos que não são require mas o robô monta na partida (a extensão do FGTS é copiada para o D:\nads-dados ao ligar)
const NA_PARTIDA = [{ re: /^robo\/fgts-extensao\//, quem: 'fgts-extensao.js' }];

/** Este arquivo mudado pede reinício? carregados: Set dos arquivos do robô em uso nesta máquina (relativos a robo/) ou null. */
function importa(arquivo, carregados) {
  const f = String(arquivo || '').replace(/\\/g, '/');
  if (!f.startsWith('robo/')) return false;
  if (NUNCA.some(r => r.test(f))) return false;
  if (SEMPRE.some(r => r.test(f))) return true;
  if (!carregados) return true;   // não se sabe o que o robô usa (robô antigo): tudo do robô conta
  if (carregados.has(f.slice(5))) return true;
  return NA_PARTIDA.some(p => p.re.test(f) && carregados.has(p.quem));
}
const arquivosQueImportam = (arquivos, carregados) => (arquivos || []).filter(f => importa(f, carregados));

/** Pedido urgente na mensagem de algum commit. */
const temUrgente = mensagens => /\[urgente\]/i.test(String(mensagens || ''));

/** Está numa das janelas ('03:00-03:15', pode virar a meia-noite)? Devolve { texto, ateMs } ou null. */
function dentroDaJanela(janelas, data) {
  const m = data.getHours() * 60 + data.getMinutes();
  for (const j of janelas || []) {
    const r = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(String(j).trim());
    if (!r) continue;
    const de = +r[1] * 60 + +r[2], ate = +r[3] * 60 + +r[4];
    const dentro = de <= ate ? m >= de && m < ate : m >= de || m < ate;
    if (!dentro) continue;
    const falta = ((ate - m) + 1440) % 1440 || 1440;
    return { texto: j, ateMs: data.getTime() - data.getSeconds() * 1000 - data.getMilliseconds() + falta * 60000 };
  }
  return null;
}

/**
 * Os robôs vivos nesta máquina (os robo-vivo-*.json de processos que existem). principal: 'arquivador' ou 'vigia'.
 * Devolve { principal: {pid, protocolo, parando} | null, carregados: Set | null, ocupados: [texto], nomes }.
 */
function lerVivos(pastaRobo, principal, dep) {
  const r = { principal: null, carregados: null, ocupados: [], nomes: [] };
  let nomes = [];
  try { nomes = dep.listar(pastaRobo).filter(n => /^robo-vivo-[\w-]+\.json$/.test(n)); } catch (e) { return r; }
  const modulos = new Set();
  for (const n of nomes) {
    let v = null;
    try { v = JSON.parse(dep.ler(path.join(pastaRobo, n))); } catch (e) { continue; }
    if (!v || !v.pid || !dep.vivo(v.pid)) continue;   // sobra de um processo que caiu
    r.nomes.push(v.nome);
    for (const m of v.modulos || []) modulos.add(m);
    for (const o of v.ocupado || []) if (o && o.texto && !r.ocupados.includes(o.texto)) r.ocupados.push(o.texto);
    if (v.nome === principal) r.principal = { pid: v.pid, protocolo: Number(v.protocolo) || 0, parando: !!v.parando };
  }
  if (r.principal) r.carregados = modulos;
  return r;
}

/**
 * A decisão. e: { arquivos, carregados, urgente, agoraMs, ultimoReinicioMs, janelas, ocupados, esperandoOcupadoDesdeMs,
 * intervaloMs, esperaOcupadoMaxMs }. Devolve { acao: 'nada' | 'codigo' | 'esperar' | 'reiniciar', motivo, ateMs?, ocupado? }.
 */
function decidir(e) {
  const agora = e.agoraMs;
  if (!e.arquivos || !e.arquivos.length) return { acao: 'nada', motivo: 'nada novo' };
  const imp = arquivosQueImportam(e.arquivos, e.carregados);
  if (!imp.length) return { acao: 'codigo', motivo: e.arquivos.length + ' arquivo(s) mudaram, nenhum que o robô desta máquina usa' };
  const lista = imp.slice(0, 6).join(', ') + (imp.length > 6 ? ' e mais ' + (imp.length - 6) : '');
  if (e.urgente) return { acao: 'reiniciar', motivo: 'urgente: ' + lista };
  const intervalo = e.intervaloMs != null ? e.intervaloMs : INTERVALO_MS;
  if (e.ultimoReinicioMs && agora - e.ultimoReinicioMs < intervalo) {
    return { acao: 'esperar', ateMs: e.ultimoReinicioMs + intervalo, motivo: 'o último reinício foi há ' + Math.floor((agora - e.ultimoReinicioMs) / 60000) + ' min (no máximo 1 a cada ' + Math.round(intervalo / 60000) + ' min): junto o que chegar até lá' };
  }
  const j = dentroDaJanela(e.janelas, new Date(agora));
  if (j) return { acao: 'esperar', ateMs: j.ateMs, motivo: 'na janela ' + j.texto + ' (o trabalho da madrugada)' };
  if (e.ocupados && e.ocupados.length) {
    const max = e.esperaOcupadoMaxMs != null ? e.esperaOcupadoMaxMs : ESPERA_OCUPADO_MAX_MS;
    const desde = e.esperandoOcupadoDesdeMs || agora;
    if (agora - desde < max) {
      return { acao: 'esperar', ocupado: true, ateMs: Math.min(agora + 60000, desde + max), motivo: 'o robô está ocupado (' + e.ocupados.join(' · ') + '): espero terminar, até ' + Math.round(max / 60000) + ' min' };
    }
  }
  return { acao: 'reiniciar', motivo: lista };
}

// ---------- o servidor ----------
const curto = h => String(h || '').slice(0, 8);

/** A atualização do NILMA-SERVER. o: { repo, dados, janelas }; dep: o mundo (git, processos, disco, relógio). */
async function servidor(o, dep) {
  const log = dep.log;
  const pastaRobo = path.join(o.repo, 'robo');
  const arqEstado = path.join(o.dados, 'atualizar-estado.json');
  const arqUrgente = path.join(o.dados, 'atualizar-urgente');
  const arqTrava = path.join(o.dados, 'atualizar.trava');
  const pedido = path.join(pastaRobo, PEDIDO);
  // um atualizador só: o que já está rodando busca de novo antes de terminar
  try { const pid = parseInt(dep.ler(arqTrava), 10); if (pid && pid !== dep.pid && dep.vivo(pid)) { log('outro atualizador já está rodando (processo ' + pid + '): ele pega esta publicação também'); return 0; } } catch (e) { /* sem trava */ }
  dep.escrever(arqTrava, String(dep.pid));
  try {
    const inicio = dep.agora();
    let falhasDoFetch = 0;
    let motivoAnterior = '';
    for (;;) {
      if (dep.agora() - inicio > DURACAO_MAX_MS) { log('esperando há 4 h: paro aqui; a próxima publicação chama de novo'); return 0; }
      if (!dep.git(['fetch', '-q', 'origin', RAMO]).ok) {
        if (++falhasDoFetch >= 3) { log('FALHOU: não busquei o ' + RAMO + ' (sem rede?)'); return 1; }
        await dep.dormir(60 * 1000);
        continue;
      }
      falhasDoFetch = 0;
      const de = dep.git(['rev-parse', 'HEAD']).saida.trim();
      const para = dep.git(['rev-parse', 'origin/' + RAMO]).saida.trim();
      if (!para) { log('FALHOU: sem origin/' + RAMO); return 1; }
      if (de === para) { log('em dia (' + curto(para) + ')'); return 0; }
      const arquivos = dep.git(['diff', '--name-only', '--no-renames', de, para]).saida.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const mensagens = dep.git(['log', '--format=%B', de + '..' + para]).saida;
      const vivos = lerVivos(pastaRobo, 'arquivador', dep);
      let estado = {};
      try { estado = JSON.parse(dep.ler(arqEstado)) || {}; } catch (e) { estado = {}; }
      const d = decidir({
        arquivos, carregados: vivos.carregados, urgente: temUrgente(mensagens) || dep.existe(arqUrgente), agoraMs: dep.agora(),
        ultimoReinicioMs: Date.parse(estado.ultimoReinicioEm) || 0, janelas: o.janelas, ocupados: vivos.ocupados,
        esperandoOcupadoDesdeMs: Date.parse(estado.esperandoOcupadoDesde) || 0,
      });
      if (d.acao === 'esperar') {
        if (d.motivo.replace(/\d+ min/g, '') !== motivoAnterior) log(curto(de) + ' → ' + curto(para) + ': espero; ' + d.motivo);
        motivoAnterior = d.motivo.replace(/\d+ min/g, '');
        if (d.ocupado && !estado.esperandoOcupadoDesde) { estado.esperandoOcupadoDesde = new Date(dep.agora()).toISOString(); dep.escrever(arqEstado, JSON.stringify(estado)); }
        await dep.dormir(Math.max(30 * 1000, Math.min(5 * 60 * 1000, d.ateMs - dep.agora())));
        continue;
      }
      if (d.acao === 'codigo' || d.acao === 'nada') {
        log(curto(de) + ' → ' + curto(para) + ': sem reiniciar (' + d.motivo + ')');
        if (!resetar(para, dep)) return 1;
        continue;   // busca de novo: chegou mais alguma coisa enquanto isso?
      }
      log(curto(de) + ' → ' + curto(para) + ': reiniciando (' + d.motivo + ')');
      const ok = await reiniciar(para, vivos, pedido, dep);
      estado.ultimoReinicioEm = new Date(dep.agora()).toISOString();
      estado.versao = para;
      delete estado.esperandoOcupadoDesde;
      dep.escrever(arqEstado, JSON.stringify(estado));
      dep.apagar(arqUrgente);
      motivoAnterior = '';
      if (!ok) return 1;
    }
  } finally { dep.apagar(arqTrava); }
}

function resetar(para, dep) {
  for (let i = 0; i < 2; i++) {
    const r = dep.git(['reset', '-q', '--hard', para]);
    if (r.ok) return true;
    dep.log('o reset falhou' + (i ? '' : ', tento de novo') + ': ' + String(r.erro || '').trim().slice(0, 300));
  }
  dep.log('FALHOU: o código ficou como estava');
  return false;
}

/** Pede para sair, espera (até 12 min), força se preciso, troca o código e tira o sinal. */
async function reiniciar(para, vivos, pedido, dep) {
  const log = dep.log;
  dep.escrever(pedido, JSON.stringify({ motivo: 'atualização para ' + curto(para), pedidoEm: new Date(dep.agora()).toISOString(), por: 'atualizar-robo.js' }));
  try {
    const p = vivos.principal;
    if (p && p.protocolo >= PROTOCOLO) {
      log('pedi ao arquivador (processo ' + p.pid + ') para sair com calma');
      const t0 = dep.agora();
      let tocadoEm = t0;
      while (dep.vivo(p.pid) && dep.agora() - t0 < SAIDA_LIMITE_MS) {
        await dep.dormir(5000);
        // o sinal fica "recente" enquanto espero (o arquivador que o laço ligar no meio espera o reset)
        if (dep.agora() - tocadoEm >= 60 * 1000) { dep.tocar(pedido); tocadoEm = dep.agora(); }
      }
      if (dep.vivo(p.pid)) { log('não saiu em ' + Math.round(SAIDA_LIMITE_MS / 60000) + ' min: forçando o processo ' + p.pid + ' e os filhos'); dep.matarArvore(p.pid); }
      else log('o arquivador saiu sozinho em ' + Math.round((dep.agora() - t0) / 1000) + ' s');
      // algum outro arquivador.js (não devia haver): também sai
      for (const outro of dep.processosArquivador()) if (outro !== p.pid) { log('outro arquivador.js rodando (processo ' + outro + '): forçando'); dep.matarArvore(outro); }
      dep.tocar(pedido);
      return resetar(para, dep);
    }
    // o robô rodando não conhece a saída com calma (o código de antes de 07/11/2026) ou não há robô: como era antes, o
    // código novo e o processo reiniciado na hora (o laço religa em 30 s)
    if (!resetar(para, dep)) return false;
    const pids = dep.processosArquivador();
    if (!pids.length) log('nenhum arquivador rodando: só troquei o código');
    for (const pid of pids) { dep.matarArvore(pid); log('reiniciado o processo ' + pid + ' (forçado: o robô que rodava não conhecia a saída com calma)'); }
    return true;
  } finally { dep.apagar(pedido); }
}

// ---------- a nuvem ----------
/** Decide pela máquina da nuvem (o interruptor já fez o fetch). Devolve a linha "acao motivo". */
function nuvemDecidir(o, dep) {
  const de = dep.git(['rev-parse', 'HEAD']).saida.trim();
  const para = dep.git(['rev-parse', 'origin/' + RAMO]).saida.trim();
  if (!para) return 'reiniciar sem origin/' + RAMO + ' (como antes)';
  if (de === para) return 'nada já em ' + curto(para);
  const arquivos = dep.git(['diff', '--name-only', '--no-renames', de, para]).saida.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const mensagens = dep.git(['log', '--format=%B', de + '..' + para]).saida;
  const vivos = lerVivos(path.join(o.repo, 'robo'), 'vigia', dep);
  let estado = {};
  try { estado = JSON.parse(dep.ler(o.estado)) || {}; } catch (e) { estado = {}; }
  const d = decidir({
    arquivos, carregados: vivos.carregados, urgente: temUrgente(mensagens) || /urgente/i.test(o.versao || ''), agoraMs: dep.agora(),
    ultimoReinicioMs: Date.parse(estado.ultimoReinicioEm) || 0, janelas: o.janelas, ocupados: vivos.ocupados,
    esperandoOcupadoDesdeMs: Date.parse(estado.esperandoOcupadoDesde) || 0,
  });
  if (d.acao === 'esperar' && d.ocupado && !estado.esperandoOcupadoDesde) { estado.esperandoOcupadoDesde = new Date(dep.agora()).toISOString(); try { dep.escrever(o.estado, JSON.stringify(estado)); } catch (e) { /* segue */ } }
  return d.acao + ' ' + curto(de) + ' → ' + curto(para) + ': ' + d.motivo;
}

function registrar(arqEstado, dep) {
  let estado = {};
  try { estado = JSON.parse(dep.ler(arqEstado)) || {}; } catch (e) { estado = {}; }
  estado.ultimoReinicioEm = new Date(dep.agora()).toISOString();
  delete estado.esperandoOcupadoDesde;
  dep.escrever(arqEstado, JSON.stringify(estado));
}

// ---------- o mundo de verdade ----------
function mundo(o) {
  const git = o.git || 'git';
  return {
    pid: process.pid,
    agora: () => Date.now(),
    dormir: ms => new Promise(r => setTimeout(r, ms)),
    log: (...m) => console.log(new Date().toLocaleString('pt-BR'), '[atualizar]', ...m),
    git: args => {
      const r = spawnSync(git, ['-c', 'safe.directory=*', '-C', o.repo].concat(args), { encoding: 'utf8', windowsHide: true, timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
      return { ok: r.status === 0, saida: r.stdout || '', erro: (r.stderr || '') + (r.error ? ' ' + r.error.message : '') };
    },
    ler: f => fs.readFileSync(f, 'utf8'),
    escrever: (f, t) => fs.writeFileSync(f, t),
    tocar: f => { try { const t = new Date(); fs.utimesSync(f, t, t); } catch (e) { /* segue */ } },
    existe: f => fs.existsSync(f),
    apagar: f => { try { fs.unlinkSync(f); } catch (e) { /* não havia */ } },
    listar: d => fs.readdirSync(d),
    vivo: pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } },
    matarArvore: pid => {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else { try { process.kill(pid, 'SIGKILL'); } catch (e) { /* já saiu */ } }
    },
    processosArquivador: () => {
      if (process.platform !== 'win32') return [];
      const r = spawnSync('powershell', ['-NoProfile', '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'arquivador\\.js' } | ForEach-Object { $_.ProcessId }"],
      { encoding: 'utf8', windowsHide: true, timeout: 60 * 1000 });
      return String(r.stdout || '').split(/\s+/).map(Number).filter(n => n > 0);
    },
  };
}

function argumentos(argv) {
  const o = { cmd: argv[0] || '' };
  for (let i = 1; i < argv.length; i++) if (argv[i].startsWith('--')) { o[argv[i].slice(2)] = argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
  o.janelas = typeof o.janelas === 'string' ? o.janelas.split(',').map(s => s.trim()).filter(Boolean) : null;
  return o;
}

if (require.main === module) {
  const o = argumentos(process.argv.slice(2));
  if (o.cmd === 'servidor') {
    if (!o.repo || !o.dados) { console.error('uso: node atualizar-robo.js servidor --repo D:\\nads --git <git.exe> --dados D:\\nads-dados'); process.exit(2); }
    const dep = mundo(o);
    dep.log('começando (' + (o.repo) + ')');
    servidor({ repo: o.repo, dados: o.dados, janelas: o.janelas || [] }, dep)
      .then(c => { dep.log(c ? 'FALHOU' : 'ok'); process.exit(c); })
      .catch(err => { dep.log('FALHOU:', err && err.stack || err); process.exit(1); });
  } else if (o.cmd === 'decidir') {
    if (!o.repo || !o.estado) { console.error('uso: node atualizar-robo.js decidir --repo <pasta> --estado <arquivo> [--versao X] [--janelas 03:00-03:15]'); process.exit(2); }
    const janelas = o.janelas || ['03:00-03:15'];   // a releitura completa do mapa do Drive (drive-indice.js, às 3h)
    try { console.log(nuvemDecidir({ repo: o.repo, estado: o.estado, versao: o.versao === true ? '' : o.versao, janelas }, mundo(o))); }
    catch (err) { console.log('reiniciar (o atualizar-robo.js falhou: ' + String(err && err.message || err).slice(0, 200) + ')'); }
  } else if (o.cmd === 'registrar') {
    if (!o.estado) { console.error('uso: node atualizar-robo.js registrar --estado <arquivo>'); process.exit(2); }
    registrar(o.estado, mundo(o));
  } else {
    console.error('uso: node atualizar-robo.js servidor | decidir | registrar ...'); process.exit(2);
  }
}

module.exports = {
  importa, arquivosQueImportam, temUrgente, dentroDaJanela, lerVivos, decidir, servidor, reiniciar, nuvemDecidir, registrar, argumentos,
  INTERVALO_MS, ESPERA_OCUPADO_MAX_MS, SAIDA_LIMITE_MS, PEDIDO, PROTOCOLO,
};
