// As guias do SCI Report 24h na Área do Cliente (24/11/2026; o dono escolheu a busca na hora, "por ser mantido
// frequentemente", e liberou a exceção na trava de conexões: "Libera a exceção"). O site NÃO fala com a SCI: pergunta à
// função do Firebase (funcoes/index.js), que confere o link e guarda os tokens. Este é o único fetch do site do cliente, e
// só para ENDERECO_DA_FUNCAO (a trava de conexões confere).
//   "banco"    → a função (o token "exemplo" continua com o exemplo, como no repo.ts);
//   "exemplos" → as guias de exemplo, nada sai do navegador.
import { areaCliente as ac } from '@nads/core';
import { idTokenDoCliente } from './areaCliente.firestore';
import { TOKEN_DE_EXEMPLO } from './areaCliente.memoria';

const ENDERECO_DA_FUNCAO = 'https://southamerica-east1-entregas-2e5e2.cloudfunctions.net/guiasDoSciReport';

/** O que a tela recebe: as guias, ou por que não tem. 'sem acesso' = o link pede a senha, foi trocado ou a função recusou. */
export type GuiasDoSci = { estado: 'ok'; guias: ac.GuiaDoSciReport[] } | { estado: 'sem acesso' } | { estado: 'erro'; mensagem: string };

export interface RepoSciReport {
  guias(token: string): Promise<GuiasDoSci>;
  /** a URL temporária do PDF; joga um Error em português quando não dá */
  urlDoPdf(token: string, id: string): Promise<string>;
  /** (26/11/2026) o PDF em si, para abrir na mesma janela das outras guias; null quando não dá */
  pdf(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
}

const SITUACOES = new Set<ac.SituacaoDaGuiaDoSci>(['a vencer', 'vence hoje', 'vencida', 'pagamento informado']);
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{2}\/\d{2}\/\d{4}$/;

/** Uma guia da resposta, campo a campo (a lista branca de novo, deste lado): o que vier torto é descartado. */
export function lerGuiaDoSci(x: unknown): ac.GuiaDoSciReport | null {
  if (!x || typeof x !== 'object') return null;
  const g = x as Record<string, unknown>;
  const id = typeof g.id === 'string' && /^\d{1,12}$/.test(g.id) ? g.id : '';
  const situacao = SITUACOES.has(g.situacao as ac.SituacaoDaGuiaDoSci) ? (g.situacao as ac.SituacaoDaGuiaDoSci) : null;
  if (!id || !situacao || typeof g.competencia !== 'string' || !COMPETENCIA.test(g.competencia) || typeof g.vencimento !== 'string' || !DATA.test(g.vencimento)) return null;
  const valor = typeof g.valor === 'number' && Number.isFinite(g.valor) ? g.valor : 0;
  const nome = typeof g.nome === 'string' && g.nome.trim() ? g.nome.trim().slice(0, 80) : 'Guia';
  const guia: ac.GuiaDoSciReport = { id, nome, competencia: g.competencia, vencimento: g.vencimento, valor, situacao };
  if (typeof g.pagamentoEm === 'string' && DATA.test(g.pagamentoEm)) guia.pagamentoEm = g.pagamentoEm;
  if (typeof g.valorPago === 'number' && Number.isFinite(g.valorPago) && g.valorPago > 0) guia.valorPago = g.valorPago;
  return guia;
}

const ERRO = 'Não deu para buscar as guias do SCI Report agora. Tente de novo em alguns minutos.';

/**
 * A função de verdade. `idToken` dá o login de quem entrou com senha: só é pedido quando a função responde 401 ("precisa
 * entrar", o link tem "Exigir senha"), e aí o pedido vai de novo com ele.
 */
export function criarRepoSciReportFuncao(idToken: () => Promise<string> = async () => ''): RepoSciReport {
  async function uma(corpo: { token: string; guia?: string }, login: string): Promise<{ status: number; dados: Record<string, unknown> }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(login ? { Authorization: 'Bearer ' + login } : {}) };
    const r = await fetch(ENDERECO_DA_FUNCAO, { method: 'POST', headers, body: JSON.stringify(corpo), cache: 'no-store', referrerPolicy: 'no-referrer' });
    let dados: Record<string, unknown> = {};
    try { dados = (await r.json()) as Record<string, unknown>; } catch { /* sem corpo */ }
    return { status: r.status, dados };
  }
  async function pedir(corpo: { token: string; guia?: string }) {
    const r = await uma(corpo, '');
    if (r.status !== 401) return r;
    const login = await idToken();
    return login ? uma(corpo, login) : r;
  }
  return {
    async guias(token) {
      try {
        const { status, dados } = await pedir({ token });
        if (status === 401 || status === 403) return { estado: 'sem acesso' };
        if (status !== 200 || !Array.isArray(dados.guias)) return { estado: 'erro', mensagem: ERRO };
        return { estado: 'ok', guias: dados.guias.map(lerGuiaDoSci).filter((g): g is ac.GuiaDoSciReport => !!g) };
      } catch { return { estado: 'erro', mensagem: 'Sem internet agora. Confira a conexão e tente de novo.' }; }
    },
    async pdf(token, id) {
      // a função busca o PDF na SCI e devolve os bytes (a URL temporária da SCI não abre dentro da página)
      const corpo = JSON.stringify({ token, guia: id, formato: 'pdf' });
      const uma = async (login: string) => fetch(ENDERECO_DA_FUNCAO, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(login ? { Authorization: 'Bearer ' + login } : {}) }, body: corpo, cache: 'no-store', referrerPolicy: 'no-referrer' });
      try {
        let r = await uma('');
        if (r.status === 401) { const login = await idToken(); if (login) r = await uma(login); }
        if (r.status !== 200 || !/pdf/i.test(r.headers.get('Content-Type') ?? '')) return null;
        return { nome: 'Guia ' + id + '.pdf', arquivo: await r.blob() };
      } catch { return null; }
    },
    async urlDoPdf(token, id) {
      const { status, dados } = await pedir({ token, guia: id }).catch(() => ({ status: 0, dados: {} as Record<string, unknown> }));
      const url = typeof dados.url === 'string' && dados.url.startsWith('https://') ? dados.url : '';
      if (status === 200 && url) return url;
      throw new Error(status === 403 ? 'Esta guia não está mais no SCI Report. Fale com o escritório.' : 'Não deu para abrir a guia agora. Tente de novo em alguns minutos.');
    },
  };
}

/** As guias de exemplo (o site de exemplo e o link "exemplo"): nada sai do navegador e o PDF não abre. */
export function criarRepoSciReportExemplo(hoje = new Date()): RepoSciReport {
  const mes = (d: number) => new Date(hoje.getFullYear(), hoje.getMonth(), d);
  const br = (d: Date) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  const anterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const competencia = anterior.getFullYear() + '-' + String(anterior.getMonth() + 1).padStart(2, '0');
  const guias: ac.GuiaDoSciReport[] = [
    { id: '900001', nome: 'DARF PIS', competencia, vencimento: br(mes(25)), valor: 412.88, situacao: ac.situacaoDaGuia(br(mes(25)), hoje) },
    { id: '900002', nome: 'DARF COFINS', competencia, vencimento: br(mes(25)), valor: 1905.6, situacao: ac.situacaoDaGuia(br(mes(25)), hoje) },
    { id: '900003', nome: 'DAM ISS', competencia, vencimento: br(mes(10)), valor: 640, situacao: 'pagamento informado', pagamentoEm: br(mes(9)), valorPago: 640 },
  ];
  return {
    guias: async () => ({ estado: 'ok', guias }),
    urlDoPdf: async () => { throw new Error('No exemplo a guia não abre.'); },
    pdf: async () => null,
  };
}

const exemplo = criarRepoSciReportExemplo();
export const repoSciReport: RepoSciReport = import.meta.env.VITE_FONTE === 'banco'
  ? (() => { const funcao = criarRepoSciReportFuncao(idTokenDoCliente); return { guias: t => (t === TOKEN_DE_EXEMPLO ? exemplo : funcao).guias(t), urlDoPdf: (t, id) => (t === TOKEN_DE_EXEMPLO ? exemplo : funcao).urlDoPdf(t, id), pdf: (t, id) => (t === TOKEN_DE_EXEMPLO ? exemplo : funcao).pdf(t, id) }; })()
  : exemplo;
