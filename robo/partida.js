// Ligar sem rede (07/11/2026). Em 06/11, das 7:42 às 8:15, a internet do escritório caiu e o arquivador do NILMA-SERVER
// religou a cada ~1,5 min ("ERRO ao iniciar: 14 UNAVAILABLE ... ETIMEDOUT"): a primeira leitura do banco esperava ~1 min,
// falhava, o processo saía e o laço religava em 30 s, relendo tudo do zero. Aqui:
//   - esperarOBanco: antes de ligar o robô, uma leitura pequena; sem resposta, espera e tenta de novo, cada vez mais
//     devagar (30 s, 1, 2, 4, 8 e depois de 10 em 10 min), sem sair do processo;
//   - esperaDaFalha: se a partida falha mesmo assim, quantas falhas seguidas já houve (num arquivo, porque o processo sai)
//     e quanto esperar antes de sair, para o laço não religar a cada 30 s.
'use strict';
const fs = require('fs');

const PRIMEIRA_MS = 30 * 1000;
const MAXIMA_MS = 10 * 60 * 1000;
const SONDA_LIMITE_MS = 90 * 1000;
const SEGUIDAS_MS = 15 * 60 * 1000;   // falha mais de 15 min depois da anterior começa a contar do zero

/** A espera da tentativa n (0 = a primeira falha): 30 s, 1, 2, 4, 8, 10, 10... min. */
function esperaDaTentativa(n) { return Math.min(MAXIMA_MS, PRIMEIRA_MS * Math.pow(2, Math.max(0, n))); }

/**
 * Tenta sondar() até dar certo. o: { log, dormir(ms), limiteMs (de cada sonda) }. Devolve quantas falhas houve.
 * Nunca desiste: sem banco o robô não tem o que fazer, e esperar aqui não gasta nada.
 */
async function esperarOBanco(sondar, o = {}) {
  const dormir = o.dormir || (ms => new Promise(r => setTimeout(r, ms)));
  const limite = o.limiteMs || SONDA_LIMITE_MS;
  const log = o.log || console.log;
  for (let n = 0; ; n++) {
    try {
      let relogio = null;
      await Promise.race([
        Promise.resolve().then(sondar),
        new Promise((_, nao) => { relogio = setTimeout(() => nao(new Error('sem resposta em ' + Math.round(limite / 1000) + ' s')), limite); }),
      ]).finally(() => clearTimeout(relogio));
      if (n) log('o banco respondeu depois de ' + n + ' tentativa(s): ligando');
      return n;
    } catch (err) {
      const espera = esperaDaTentativa(n);
      log('o banco não respondeu (' + String(err && err.message || err).slice(0, 160) + '); tento de novo em ' + (espera < 60000 ? Math.round(espera / 1000) + ' s' : Math.round(espera / 60000) + ' min'));
      await dormir(espera);
    }
  }
}

/** Uma partida falhou: registra no arquivo e devolve quanto esperar antes de sair (0 na primeira). */
function esperaDaFalha(arquivo, agoraMs = Date.now()) {
  let p = { ultima: 0, seguidas: 0 };
  try { p = Object.assign(p, JSON.parse(fs.readFileSync(arquivo, 'utf8'))); } catch (e) { /* primeira */ }
  const seguidas = agoraMs - p.ultima < SEGUIDAS_MS ? p.seguidas + 1 : 0;
  try { fs.writeFileSync(arquivo, JSON.stringify({ ultima: agoraMs, seguidas })); } catch (e) { /* segue */ }
  return seguidas ? esperaDaTentativa(seguidas - 1) : 0;
}

/** A partida deu certo: a próxima falha começa do zero. */
function partidaBoa(arquivo) { try { fs.unlinkSync(arquivo); } catch (e) { /* não havia */ } }

module.exports = { esperarOBanco, esperaDaFalha, partidaBoa, esperaDaTentativa, PRIMEIRA_MS, MAXIMA_MS };
