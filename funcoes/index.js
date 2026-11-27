// As guias do SCI Report 24h na Área do Cliente (24/11/2026; o dono escolheu a busca na hora "por ser mantido
// frequentemente" e liberou a exceção na trava de conexões: "Libera a exceção"). Uma função HTTP no projeto do Entregas:
//
//   POST { token }           → { acesso: 'liberado', guias: [...], semEmpresaNoSci } — os impostos publicados no SCI Report
//                              das empresas do link, dos últimos 3 meses (lista branca: core GuiaDoSciReport);
//   POST { token, guia }     → { acesso: 'liberado', url } — a URL temporária do PDF daquela guia;
//   com "Exigir senha" no link, o Authorization: Bearer <idToken> do login do cliente (o mesmo que a regra do banco confere).
//   Fora disso: 401 { acesso: 'precisa entrar' }, 403 { acesso: 'link invalido' | 'guia de outra empresa' }, 502 se a SCI falhar.
//
// A regra toda (a porta do link, a SCI, a lista branca, o PDF só de guia do link) é do core, empacotada em gerado/ por
// scripts/funcoes-sci.mjs e testada lá. Aqui só o Firebase: o Admin SDK, os segredos e o HTTP.
// Os tokens da SCI ficam no Secret Manager (SCI_TOKEN_PARCEIRO e SCI_TOKEN_CLIENTE): nunca no repositório, no banco, no
// navegador ou no log. Publicar e pôr os segredos: funcoes/LEIAME.md.
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { criarAtendimentoDaArea, criarClienteSciReport, ErroDoSci } from './gerado/sciReport.js';

const PARCEIRO = defineSecret('SCI_TOKEN_PARCEIRO');
const CLIENTE = defineSecret('SCI_TOKEN_CLIENTE');
// a trava de conexões confere: o fetch só sai para estes endereços
const ENDERECOS_DA_SCI = ['https://api-auth.sci.com.br/', 'https://api-relatorio.sci.com.br/'];
// quem pode chamar do navegador (o site do cliente)
const ORIGENS = ['https://cliente.nilmacontabilidade.com', 'https://nilma-cliente.web.app'];
// o resumo do link (os CNPJs) muda pouco: guardado na memória da instância por 10 minutos; o link é lido a cada pedido
// (revogado, para na hora)
const RESUMO_MS = 10 * 60 * 1000;
const CONFIG_MS = 5 * 60 * 1000;
let configGuardada = null;

initializeApp();
const db = getFirestore();

const sci = criarClienteSciReport({
  buscar: (url, init) => {
    if (!ENDERECOS_DA_SCI.some(e => url.startsWith(e))) throw new Error('endereço fora da SCI');
    return fetch(url, init);
  },
  segredos: () => ({ parceiro: PARCEIRO.value(), cliente: CLIENTE.value() }),
});

/** O PDF da guia, na URL temporária que a própria SCI devolveu: só da SCI ou do armazenamento da AWS que ela usa. */
const PDF_DA_SCI = /^https:\/\/([a-z0-9-]+\.)*(sci\.com\.br|amazonaws\.com)\//;
function buscarPdfDaSci(url) {
  if (!PDF_DA_SCI.test(url)) return Promise.reject(new Error('o PDF não veio de um endereço da SCI'));
  const init = { method: 'GET', signal: globalThis.AbortSignal.timeout(20000) };
  return fetch(url, init);
}

// config/sci (a chave da Área e as empresas ligadas), na memória da instância por 5 minutos: desligar vale em até 5 min
async function configDaArea() {
  if (configGuardada && Date.now() - configGuardada.em < CONFIG_MS) return configGuardada.valor;
  const d = (await db.collection('config').doc('sci').get()).data() || {};
  const valor = { ligado: d.areaCliente === true, empresas: Array.isArray(d.empresas) ? d.empresas.map(Number).filter(n => n > 0) : [],
    // (27/11/2026) as publicações escondidas da Área (a guia de teste; a API do SCI não apaga publicação)
    ocultas: Array.isArray(d.ocultas) ? d.ocultas.map(String).filter(x => /^\d{1,12}$/.test(x)) : [] };
  configGuardada = { em: Date.now(), valor };
  return valor;
}

const resumos = new Map();
const area = criarAtendimentoDaArea({
  sci,
  async lerLink(token) {
    const d = await db.collection('areasCliente').doc(token).get();
    if (!d.exists) return null;
    const x = d.data() || {};
    return { existe: true, exigeSenha: x.exigeSenha === true, codigos: Array.isArray(x.codigos) ? x.codigos : [] };
  },
  async lerEmpresas(token) {
    const guardado = resumos.get(token);
    if (guardado && Date.now() - guardado.em < RESUMO_MS) return guardado.empresas;
    const d = await db.collection('areasCliente').doc(token).collection('resumo').doc('atual').get();
    const lista = d.exists && Array.isArray(d.get('empresas')) ? d.get('empresas') : [];
    const empresas = lista.map(e => ({ codigo: Number(e && e.codigo) || 0, cnpj: String((e && e.cnpj) || '') })).filter(e => e.cnpj);
    resumos.set(token, { em: Date.now(), empresas });
    return empresas;
  },
  config: configDaArea,
  async lerLogin(idToken) {
    try {
      const c = await getAuth().verifyIdToken(idToken, true);
      return { cliente: c.cliente === true, a: Array.isArray(c.a) ? c.a : [] };
    } catch { return null; }
  },
});

/** O dia de hoje em Brasília (a função roda em UTC; a situação "vence hoje" é pela data daqui). */
function hojeEmBrasilia() {
  const [a, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

export const guiasDoSciReport = onRequest(
  { region: 'southamerica-east1', secrets: [PARCEIRO, CLIENTE], cors: ORIGENS, maxInstances: 3, concurrency: 20, memory: '256MiB', timeoutSeconds: 30, invoker: 'public' },
  async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.status(405).json({ acesso: 'erro', erro: 'use POST' }); return; }
    const corpo = req.body && typeof req.body === 'object' ? req.body : {};
    const token = typeof corpo.token === 'string' ? corpo.token : '';
    const guia = typeof corpo.guia === 'string' || typeof corpo.guia === 'number' ? String(corpo.guia) : '';
    const idToken = String(req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    try {
      const hoje = hojeEmBrasilia();
      const ocultas = (await configDaArea()).ocultas;
      if (guia && ocultas.includes(String(guia))) { res.status(403).json({ acesso: 'guia de outra empresa' }); return; }
      const r = guia ? await area.pdf(token, idToken, guia, hoje) : await area.guias(token, idToken, hoje);
      if (!guia && Array.isArray(r.guias) && ocultas.length) r.guias = r.guias.filter(g => !ocultas.includes(String(g.id)));
      // (26/11/2026: "tem que parecer que sci report nem existe para o usuario") com formato 'pdf', a função busca o PDF na
      // URL temporária da SCI e devolve os bytes: a guia abre na mesma janela das outras guias da Área
      if (guia && corpo.formato === 'pdf' && r.acesso === 'liberado' && typeof r.url === 'string' && r.url.startsWith('https://')) {
        const p = await buscarPdfDaSci(r.url);
        const bytes = p.ok ? new Uint8Array(await p.arrayBuffer()) : null;
        if (!bytes || bytes.length > 15 * 1024 * 1024 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new Error('o PDF da SCI não veio (' + p.status + ')');
        res.set('Content-Type', 'application/pdf'); res.status(200).end(bytes);
        return;
      }
      res.status(r.acesso === 'liberado' ? 200 : r.acesso === 'precisa entrar' ? 401 : 403).json(r);
    } catch (e) {
      // só o status e a mensagem da SCI (nunca os tokens nem o link do cliente)
      logger.error('SCI Report: ' + (e instanceof ErroDoSci ? e.status + ' ' + e.message : String((e && e.message) || e)).slice(0, 300));
      res.status(502).json({ acesso: 'erro', erro: 'O SCI Report não respondeu agora. Tente de novo em alguns minutos.' });
    }
  },
);
