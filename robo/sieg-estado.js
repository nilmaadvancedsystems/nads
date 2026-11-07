// Pequenas peças do SIEG que não dependem da rede (07/11/2026, melhorias do robô), separadas para dar para testar:
//  1) clientes que o portal respondeu 404 (guardados em arquivo local do robô, não no Firestore): por alguns dias o robô vai
//     direto pela API para eles (04/11/2026: 11 clientes deram "o portal do SIEG respondeu 404" e cada um gastou uma ida ao portal);
//  2) tentar de novo com espera crescente quando a rede falha (UND_ERR_CONNECT_TIMEOUT, ETIMEDOUT...);
//  3) pular os XMLs de documento que o arquivador já arquivou, pelo índice de chaves (em novembro 79% do trabalho do arquivador
//     era "já arquivado": o SIEG baixa o mês inteiro do cliente e põe tudo na pasta de entrada, de novo, a cada pedido).
'use strict';
const fs = require('fs');
const path = require('path');

const DIA = 24 * 3600 * 1000;

/** Os clientes com 404 no portal: { recente(doc), anotar(doc), limpar(doc) }. Arquivo JSON { "<doc>": "<ISO>" }. */
function criarPortal404(arquivo, opcoes) {
  const dias = (opcoes && opcoes.dias) || 3;
  const agora = (opcoes && opcoes.agora) || (() => Date.now());
  let mapa = null;
  const ler = () => {
    if (mapa) return mapa;
    try { mapa = JSON.parse(fs.readFileSync(arquivo, 'utf8')) || {}; } catch (e) { mapa = {}; }
    return mapa;
  };
  const gravar = () => {
    const m = ler();
    for (const k of Object.keys(m)) if (agora() - Date.parse(m[k]) > dias * DIA) delete m[k];
    try { fs.mkdirSync(path.dirname(arquivo), { recursive: true }); fs.writeFileSync(arquivo, JSON.stringify(m, null, 1)); } catch (e) { /* só deixa de lembrar */ }
  };
  return {
    recente(doc) { const t = Date.parse(ler()[doc]); return Number.isFinite(t) && agora() - t < dias * DIA; },
    anotar(doc) { ler()[doc] = new Date(agora()).toISOString(); gravar(); },
    limpar(doc) { if (ler()[doc]) { delete ler()[doc]; gravar(); } },
  };
}
/** O erro do portal que quer dizer "404" (sieg-portal.js: 'o portal do SIEG respondeu 404'). */
const ehPortal404 = e => /o portal do SIEG respondeu 404\b/.test(String(e && e.message || ''));

/** Falha de rede que vale tentar de novo (e não resposta do servidor). */
const CODIGOS_DE_REDE = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'EPIPE', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT']);
function ehErroDeRede(e) {
  if (!e) return false;
  if (e.tempo) return true;
  const cod = e.code || (e.cause && e.cause.code);
  if (cod && CODIGOS_DE_REDE.has(cod)) return true;
  return e instanceof TypeError && /fetch failed/i.test(e.message || '');
}
/** Roda fn(); se falhar por rede, espera (crescente) e tenta de novo; esgotadas as esperas, o último erro sobe. */
async function comTentativas(fn, opcoes) {
  const esperas = (opcoes && opcoes.esperas) || [5000, 15000, 30000];
  const dorme = (opcoes && opcoes.dormir) || (ms => new Promise(r => setTimeout(r, ms)));
  const quando = (opcoes && opcoes.aoTentar) || null;
  for (let i = 0; ; i++) {
    try { return await fn(i); }
    catch (e) {
      if (i >= esperas.length || !(opcoes && opcoes.qualquer) && !ehErroDeRede(e)) throw e;
      if (quando) quando(e, i + 1, esperas[i]);
      await dorme(esperas[i]);
    }
  }
}

/** Como comTentativas, mas para qualquer erro (a gravação no Firestore que não pode se perder): 3 novas tentativas, 1, 4 e 10 s. */
const tentarDeNovo = (fn, opcoes) => comTentativas(fn, Object.assign({ esperas: [1000, 4000, 10000] }, opcoes, { qualquer: true }));

/**
 * O filtro dos já arquivados. carregar() devolve o Indice de arquivador-chaves (ou lança). Lido uma vez e guardado por
 * `validadeMs` (30 min: uma rodada de pedidos); se não puder ser lido, não pula nada (o comportamento de antes).
 * pular(cliente, nome): true quando o XML é de DOCUMENTO (não evento) e o índice o tem como documento arquivado deste cliente.
 */
function criarFiltroDeArquivados(carregar, opcoes) {
  const validade = (opcoes && opcoes.validadeMs) || 30 * 60000;
  const agora = (opcoes && opcoes.agora) || (() => Date.now());
  const log = (opcoes && opcoes.log) || (() => {});
  const K = (opcoes && opcoes.chaves) || require('./arquivador-chaves');
  let idx = null, ate = 0, falhouEm = 0;
  const indice = () => {
    if (idx && agora() < ate) return idx;
    if (!idx && falhouEm && agora() - falhouEm < 5 * 60000) return null;   // não relê a cada pedido quando não dá
    try { idx = carregar(); ate = agora() + validade; falhouEm = 0; const e = idx && idx.estatistica; log('SIEG: índice de chaves lido para pular o que já foi arquivado' + (e ? ' (' + e.chaves + ' chaves, ' + e.ms + ' ms)' : '')); }
    catch (err) { idx = null; falhouEm = agora(); log('SIEG: não consegui ler o índice de chaves (' + (err && err.message || err) + '): baixa tudo como antes'); }
    return idx;
  };
  return {
    pular(cliente, nome) {
      const i = indice();
      if (!i || !Number.isFinite(+cliente)) return false;
      nome = String(nome || '');
      if (/-evento-/i.test(nome) || !/\.xml$/i.test(nome)) return false;   // o evento é de outro assunto: a chave do original não diz que ele foi arquivado
      for (const ch of K.chavesDoTexto(nome)) {
        if (i.achar(ch).some(x => x.cliente === +cliente && x.de === 'doc')) return true;
      }
      return false;
    },
  };
}

module.exports = { tentarDeNovo, criarPortal404, ehPortal404, ehErroDeRede, comTentativas, criarFiltroDeArquivados };
