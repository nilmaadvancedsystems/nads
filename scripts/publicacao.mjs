#!/usr/bin/env node
// A fila e a conferência de toda publicação no ar (Vitor, 28/10/2026: "para parar com essas questões de sobreposição,
// conversem entre vocês para entrarem em ordem"). Várias conversas publicam o mesmo site; quem publicava de uma cópia
// antiga apagava o que outra tinha acabado de pôr no ar. Daqui em diante:
//   1. só publica o que está em origin/desenvolvimento, sem nada por gravar: a cópia tem de estar igual ao servidor
//      (o trabalho pela metade de outra conversa não vai para o ar, e o que foi para o ar não some na próxima);
//   2. uma de cada vez: a trava fica na pasta principal do nads (a mesma para todas as cópias); quem chega espera a vez;
//   3. na vez, confere de novo: se alguém enviou coisa nova enquanto esperava, para e pede para atualizar a cópia.
//
//   node scripts/publicacao.mjs conferir     só a conferência (o npm run publicar usa antes de gerar)
//   import { pegarAVez } from './publicacao.mjs' — o sites.mjs pega a vez antes de gerar e publicar
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setInterval, setTimeout } from 'node:timers';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const git = cmd => execSync('git ' + cmd, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** a pasta principal (as cópias de publicar são worktrees): a trava é uma só para todas */
function pastaPrincipal() {
  try {
    const comum = git('rev-parse --path-format=absolute --git-common-dir');
    return path.basename(comum) === '.git' ? path.dirname(comum) : raiz;
  } catch { return raiz; }
}
const TRAVA = path.join(pastaPrincipal(), 'apps', 'web', 'dist-sites', '.publicando.lock');
/** a trava de quem caiu no meio (o PC desligou, a conversa parou) vence sozinha */
const VENCE_EM = 25 * 60 * 1000;
const ESPERA_MAXIMA = 40 * 60 * 1000;

/** A cópia igual ao servidor: tudo gravado e enviado, e nada de novo no servidor. Devolve o motivo de não poder, ou null. */
export function motivoParaNaoPublicar() {
  try { git('fetch -q origin desenvolvimento'); } catch { return 'não consegui falar com o GitHub (git fetch).'; }
  const sujos = git('status --porcelain --untracked-files=no');
  if (sujos) return 'há mudança sem gravar nesta cópia (' + sujos.split('\n').length + ' arquivo(s)). Publique de uma cópia limpa de origin/desenvolvimento (git worktree add --detach ../nads-limpo origin/desenvolvimento).';
  const aqui = git('rev-parse HEAD');
  const la = git('rev-parse origin/desenvolvimento');
  if (aqui === la) return null;
  let atras = false, naFrente = false;
  try { git('merge-base --is-ancestor ' + la + ' ' + aqui); } catch { atras = true; }
  try { git('merge-base --is-ancestor ' + aqui + ' ' + la); } catch { naFrente = true; }
  if (atras && !naFrente) {
    // a cópia limpa só ficou para trás (chegou coisa nova enquanto ela verificava ou esperava a vez): anda até o servidor
    // e publica o mais novo, em vez de apagar o que as outras conversas puseram no ar
    try { git('merge -q --ff-only ' + la); console.log('publicação: a cópia andou até o mais novo do servidor (' + la.slice(0, 8) + ').'); return null; }
    catch { return 'esta cópia está atrás do servidor e não deu para atualizar sozinha: publicar daqui apagaria o que as outras conversas puseram no ar. Atualize (git merge origin/desenvolvimento) e publique de novo.'; }
  }
  if (!atras) return 'esta cópia tem commits que não foram enviados: envie primeiro (git push), senão a próxima publicação apaga.';
  return 'esta cópia e o servidor divergiram: junte (git merge origin/desenvolvimento), envie e publique de novo.';
}

const dorme = ms => new Promise(r => setTimeout(r, ms));

function tentarPegar() {
  fs.mkdirSync(path.dirname(TRAVA), { recursive: true });
  try {
    const fd = fs.openSync(TRAVA, 'wx');
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, em: new Date().toISOString(), pasta: raiz, commit: git('rev-parse --short HEAD') }));
    fs.closeSync(fd);
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    try { if (Date.now() - fs.statSync(TRAVA).mtimeMs > VENCE_EM) { fs.rmSync(TRAVA, { force: true }); return tentarPegar(); } } catch { /* sumiu: tenta de novo na volta */ }
    return false;
  }
}

/**
 * A vez de publicar: confere a cópia, espera a trava e confere de novo. A trava sai sozinha quando o processo termina
 * (bem ou com erro).
 */
export async function pegarAVez() {
  const antes = motivoParaNaoPublicar();
  if (antes) { console.error('publicação: ' + antes); process.exit(1); }
  const inicio = Date.now();
  let avisou = false;
  while (!tentarPegar()) {
    if (!avisou) {
      let quem = '';
      try { const t = JSON.parse(fs.readFileSync(TRAVA, 'utf8')); quem = ' (' + t.pasta + ', desde ' + new Date(t.em).toLocaleTimeString('pt-BR') + ')'; } catch { /* ok */ }
      console.log('publicação: outra conversa está publicando' + quem + '; esperando a vez…');
      avisou = true;
    }
    if (Date.now() - inicio > ESPERA_MAXIMA) { console.error('publicação: esperei 40 minutos e a vez não chegou. Veja quem está publicando (' + TRAVA + ').'); process.exit(1); }
    await dorme(10 * 1000);
  }
  const soltar = () => { try { const t = JSON.parse(fs.readFileSync(TRAVA, 'utf8')); if (t.pid === process.pid) fs.rmSync(TRAVA, { force: true }); } catch { /* já saiu */ } };
  // enquanto publica, a trava fica "viva" (a data dela anda a cada minuto): só a de quem caiu de verdade vence
  const viva = setInterval(() => { try { const t = new Date(); fs.utimesSync(TRAVA, t, t); } catch { /* ok */ } }, 60 * 1000);
  viva.unref();
  process.on('exit', soltar);
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sinal, () => { soltar(); process.exit(1); });
  // na vez: se chegou coisa nova enquanto esperava, esta cópia ficou velha
  const agora = motivoParaNaoPublicar();
  if (agora) { console.error('publicação: ' + agora); process.exit(1); }
  console.log('publicação: é a vez desta cópia (' + git('rev-parse --short HEAD') + ').');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  if (process.argv[2] === 'conferir') {
    const m = motivoParaNaoPublicar();
    if (m) { console.error('publicação: ' + m); process.exit(1); }
  }
}
