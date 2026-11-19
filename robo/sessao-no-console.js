// A sessão do robô sempre com tela ativa (05/11/2026). O Alterdata Contábil só aceita o clique de verdade (o mouse do
// Windows) com a área de trabalho ativa; quando alguém fecha o RDP sem sair, a sessão fica "desconectada" e o pywinauto
// para com "There is no active desktop required for moving mouse cursor!". O Vitor ("Sim, pode"): com a sessão do robô
// desconectada, o robô a passa para o console do servidor (tscon <id> /dest:console), que continua ativa sem ninguém
// conectado. Só quando ela já está desconectada: nunca derruba quem está usando o RDP.
//
// 19/11/2026 (o dono entrou no servidor por acesso remoto de um notebook de 2880x1800 a 200% com o robô rodando; o balancete
// e o razão falharam no meio): o garantirTelaAtiva só rodava a cada minuto e antes de pegar o pedido, nunca entre um
// relatório e outro, e nada impedia o robô de clicar com uma pessoa conectada à mesma sessão. Agora:
//   - prepararSessao(): antes de CADA roteiro; desconectada → console e espera ela ficar ativa; conectada por acesso
//     remoto → não roda, com a frase clara (o pedido volta para a fila e espera; alterdata-fila.js, classe 'remoto');
//   - explicarErro(): depois de um roteiro que falhou, compara a sessão do começo (SESSAO: do roteiro) com a do fim
//     (alterdata_sessao.py): se alguém entrou, saiu ou a tela mudou no meio, o erro diz isso em vez do "Handle … is not a
//     vaild window handle" do pywinauto.
'use strict';
const { execFile } = require('child_process');

const REMOTO = 'alguém está usando o servidor por acesso remoto';
const SEM_TELA = 'o servidor está sem sessão de tela ativa';

const rodar = (cmd, args) => new Promise(resolve => execFile(cmd, args, { windowsHide: true, timeout: 30 * 1000 },
  (err, out, errs) => resolve({ err, out: String(out || ''), errs: String(errs || '') })));
const dormir = ms => new Promise(r => setTimeout(r, ms));

/** A linha da sessão atual do `query session` (começa com '>') → {id, estado, nome, remota} ou null. */
function sessaoDaLinha(linha) {
  if (!linha || !linha.startsWith('>')) return null;
  // SESSIONNAME (pode faltar) USERNAME (pode ter espaço: "DPTO FISCAL 004") ID STATE [TYPE DEVICE]: o último número
  // seguido de uma palavra é o ID e o estado
  const achados = [...linha.slice(1).matchAll(/\s(\d+)\s+([A-Za-zÀ-ú]+)/g)];
  const m = achados[achados.length - 1];
  if (!m) return null;
  // o nome da sessão: console, rdp-tcp#N (acesso remoto) ou nada (desconectada); a coluna começa logo depois do '>'
  const nome = (linha.slice(1).match(/^(\S+)/) || [])[1] || '';
  const nomeDeSessao = /^(console|rdp-|ica-|services)/i.test(nome) ? nome : '';
  return { id: m[1], estado: m[2], nome: nomeDeSessao, remota: /^rdp-/i.test(nomeDeSessao) };
}

const desconectada = s => !!s && /^disc/i.test(s.estado);
// "Ativo" (pt), "Active" (en)
const ativa = s => !!s && /^(ativ|activ)/i.test(s.estado);

/** A sessão deste processo: {id, estado, nome, remota} (estado como o Windows escreve: Ativo/Active, Disco/Disc…) ou null. */
async function minhaSessao() {
  if (process.platform !== 'win32') return null;
  const r = await rodar('query', ['session']);
  return sessaoDaLinha(r.out.split(/\r?\n/).find(l => l.startsWith('>')));
}

/** Se a sessão está desconectada, passa para o console. Devolve o que fez (para o log) ou '' quando não precisou. */
async function garantirTelaAtiva(sessao) {
  const s = sessao || await minhaSessao();
  if (!desconectada(s)) return '';
  const r = await rodar('tscon', [s.id, '/dest:console']);
  if (r.err) return 'a sessão ' + s.id + ' está desconectada e o tscon não deu: ' + (r.errs || r.err.message).trim().slice(0, 200);
  return 'a sessão ' + s.id + ' estava desconectada: passei para o console do servidor (a tela continua ativa)';
}

/**
 * Antes de cada roteiro (no servidor): {ok, erro?, remoto?, feito?}. Desconectada → console e espera até `esperaMs` ela
 * ficar ativa no console, mais `assentarMs` para o Contábil se redesenhar na tela do console. Conectada por acesso remoto →
 * não roda. `ler` e `garantir` entram por fora no teste.
 */
async function prepararSessao({ ler = minhaSessao, garantir = garantirTelaAtiva, esperaMs = 20 * 1000, assentarMs = 3000, passoMs = 1000 } = {}) {
  let s = await ler();
  if (!s) return { ok: true };
  if (s.remota && ativa(s)) return { ok: false, remoto: true, erro: fraseRemoto() };
  if (!desconectada(s)) return { ok: true };
  const feito = await garantir(s);
  const limite = Date.now() + esperaMs;
  while (Date.now() < limite) {
    await dormir(passoMs);
    s = await ler();
    if (s && s.remota && ativa(s)) return { ok: false, remoto: true, erro: fraseRemoto(), feito };
    if (s && ativa(s)) { await dormir(assentarMs); return { ok: true, feito }; }
  }
  return { ok: false, erro: SEM_TELA + ' (a sessão ' + (s ? s.id + ' está ' + s.estado : 'não respondeu') + ' depois do tscon: ' + (feito || 'nada feito') + ')', feito };
}

function fraseRemoto(detalhe) {
  return REMOTO + (detalhe ? ' (' + detalhe + ')' : ' (a sessão do robô está conectada pela área de trabalho remota)')
    + '; o robô não clica no Contábil enquanto alguém usa a tela. Para liberar, feche a janela da conexão remota (desconectar, sem sair do Windows)';
}

const tela = s => (s && s.tela ? s.tela + (s.escala && s.escala !== 100 ? ' a ' + s.escala + '%' : '') : '');

/**
 * O erro de um roteiro, explicado pela sessão: `antes` (a SESSAO: do roteiro, ou null) e `depois` (a de agora, de
 * alterdata_sessao.py). Devolve o erro como veio quando nada mudou.
 */
function explicarErro(erro, antes, depois) {
  const e = String(erro || '');
  if (!depois || e.startsWith(REMOTO) || e.startsWith(SEM_TELA)) return e;
  const detalhe = ' Detalhe: ' + e;
  const mudou = antes && antes.tela && depois.tela && tela(antes) !== tela(depois) ? 'a tela mudou de ' + tela(antes) + ' para ' + tela(depois) : '';
  if (depois.remota && depois.ativa) {
    return (fraseRemoto('entrou durante o relatório' + (mudou ? '; ' + mudou : '')) + '.' + detalhe).slice(0, 500);
  }
  if (depois.desconectada || depois.entrada === false) {
    return (SEM_TELA + ' (o acesso remoto foi fechado durante o relatório' + (mudou ? '; ' + mudou : '') + '); o robô passa a sessão para o console e tenta de novo.' + detalhe).slice(0, 500);
  }
  if (mudou || (antes && antes.remota && !depois.remota)) {
    return ('a tela do servidor mudou durante o relatório (' + (mudou || 'o acesso remoto foi fechado') + '): alguém entrou ou saiu do servidor por acesso remoto; o robô tenta de novo.' + detalhe).slice(0, 500);
  }
  return e;
}

module.exports = { garantirTelaAtiva, minhaSessao, sessaoDaLinha, prepararSessao, explicarErro, fraseRemoto, REMOTO, SEM_TELA };
