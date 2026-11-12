// A DANFE pelo relatório do dia da Área do Cliente (12/11/2026: "quero poder clicar e ver a danfe da nota"). O cliente
// não tem login: o pedido vai pela caixa que ele já usa (areaClienteChamados), como um pedido de documento marcado
// (o título "DANFE" e o texto "danfe:<chave>"), sem regra nova no banco. O robô da Área do Cliente reconhece a marca e,
// em vez de abrir um chamado, confere que a chave é de uma empresa do link (o CNPJ do emitente dentro da chave), pega o
// XML da nota no Drive, desenha a DANFE (o mesmo desenho do nads) e grava o PDF em pedaços no espelho
// (documentos/danfe-<chave>), como os documentos do DP. Robô antigo: o pedido vira um chamado "DANFE" para a equipe.

export const TITULO_DO_PEDIDO_DE_DANFE = 'DANFE';
const PREFIXO = 'danfe:';

/** A chave de acesso da NF-e (55) ou da NFC-e (65): 44 números. */
export function chaveDeNota(chave: unknown): string {
  const c = String(chave ?? '').replace(/\D/g, '');
  return c.length === 44 && (c.slice(20, 22) === '55' || c.slice(20, 22) === '65') ? c : '';
}

/** O pedido que o site manda (sem o token e a hora). */
export function pedidoDeDanfe(chave: string): { tipo: 'documento'; titulo: string; texto: string } | null {
  const c = chaveDeNota(chave);
  return c ? { tipo: 'documento', titulo: TITULO_DO_PEDIDO_DE_DANFE, texto: PREFIXO + c } : null;
}

/** A chave do pedido de DANFE que chegou na caixa; '' quando é um chamado comum. */
export function chaveDoPedidoDeDanfe(p: { tipo?: unknown; titulo?: unknown; texto?: unknown } | null | undefined): string {
  if (!p || p.tipo !== 'documento' || p.titulo !== TITULO_DO_PEDIDO_DE_DANFE || typeof p.texto !== 'string') return '';
  const t = p.texto.trim();
  return t.startsWith(PREFIXO) ? chaveDeNota(t.slice(PREFIXO.length)) : '';
}

/** O id do documento da DANFE no espelho (documentos/{id}; os pedaços em {id}~{n}). */
export const idDaDanfe = (chave: string) => 'danfe-' + chave;

/** O CNPJ do emitente (posições 7 a 20 da chave) e o mês da nota (AAMM, posições 3 a 6). */
export function partesDaChave(chave: string): { cnpj: string; competencia: string; modelo: string; numero: string } {
  return { cnpj: chave.slice(6, 20), competencia: '20' + chave.slice(2, 4) + '-' + chave.slice(4, 6), modelo: chave.slice(20, 22), numero: String(Number(chave.slice(25, 34))) };
}
