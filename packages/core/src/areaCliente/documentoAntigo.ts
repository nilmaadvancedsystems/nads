// Os documentos antigos do RH sob pedido (plano do Acessórias, ficha 37 informe-e-folha-antiga; o dono, 24/11/2026: "pode
// ir fazendo"). O espelho guarda o PDF dos últimos 3 meses; os meses mais antigos (até 12) aparecem na lista só com o
// nome (sobPedido, partes 0). Ao baixar um antigo, o site pede pela caixa que o cliente já usa (areaClienteChamados), como
// a DANFE: um pedido de documento marcado (o título "DOCUMENTO DO DP" e o texto "docdp:<id>"), sem regra nova no banco. O
// robô do PC reconhece a marca, confere que o documento é deste link e é sob pedido, lê o arquivo da pasta do cliente e
// grava os pedaços (documentos/{id}~{n}); o site espera os pedaços e baixa. Robô antigo: vira um chamado para a equipe.

export const TITULO_DO_PEDIDO_DE_DOCUMENTO_DP = 'DOCUMENTO DO DP';
const PREFIXO = 'docdp:';
const ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Quantos meses o espelho guarda com o PDF (os outros, só na lista). */
export const MESES_COM_ARQUIVO_DP = 3;
/** Quantos meses aparecem na lista do RH. */
export const MESES_NA_LISTA_DP = 12;

/** O pedido que o site manda (sem o token e a hora). */
export function pedidoDeDocumentoDp(id: string): { tipo: 'documento'; titulo: string; texto: string } | null {
  return ID.test(String(id ?? '')) ? { tipo: 'documento', titulo: TITULO_DO_PEDIDO_DE_DOCUMENTO_DP, texto: PREFIXO + id } : null;
}

/** O id do documento pedido que chegou na caixa; '' quando é um chamado comum. */
export function idDoPedidoDeDocumentoDp(p: { tipo?: unknown; titulo?: unknown; texto?: unknown } | null | undefined): string {
  if (!p || p.tipo !== 'documento' || p.titulo !== TITULO_DO_PEDIDO_DE_DOCUMENTO_DP || typeof p.texto !== 'string') return '';
  const t = p.texto.trim();
  const id = t.startsWith(PREFIXO) ? t.slice(PREFIXO.length) : '';
  return ID.test(id) ? id : '';
}

/** Este mês ainda tem o PDF no espelho (os outros vêm sob pedido)? competencia e hoje: 'aaaa-mm'. */
export function mesComArquivoDp(competencia: string, hoje: string, meses = MESES_COM_ARQUIVO_DP): boolean {
  const n = (c: string) => Number(c.slice(0, 4)) * 12 + Number(c.slice(5, 7)) - 1;
  if (!/^\d{4}-\d{2}$/.test(competencia) || !/^\d{4}-\d{2}$/.test(hoje)) return false;
  const d = n(hoje) - n(competencia);
  return d >= 0 && d < meses;
}

// ---------- o informe de rendimentos (ficha 37; o dono, 24/11/2026: "Sim, pelo CNPJ") ----------
// Na pasta CONTÁBIL/INFORME DE RENDIMENTOS/<ano-base> ficam juntos os informes que a empresa EMITE aos funcionários e os
// que ela RECEBE dos bancos. O cliente vê só os dela: o CNPJ da fonte pagadora escrito no PDF é o CNPJ da empresa.

/** O texto das páginas do PDF, linha a linha (os itens do pdf.js: { texto, x, y }). */
export function textoDoPdf(paginas: readonly (readonly { texto: string; x: number; y: number }[])[]): string {
  return paginas.map(p => [...p].sort((a, b) => b.y - a.y || a.x - b.x).map(i => i.texto).join(' ')).join(String.fromCharCode(10));
}

/** O CNPJ (só os números) que vem logo depois de "Fonte pagadora" no texto; '' quando não tem. */
export function cnpjDaFontePagadora(texto: string): string {
  const t = String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const i = t.search(/FONTE\s+PAGADORA/i);
  if (i < 0) return '';
  // só o trecho da fonte: até onde começa o beneficiário (no informe do banco, o CNPJ da empresa é o do beneficiário)
  let trecho = t.slice(i, i + 400);
  const b = trecho.search(/BENEFICI[AÁ]RI/i);
  if (b > 0) trecho = trecho.slice(0, b);
  const m = /(\d{2}\s?\.?\s?\d{3}\s?\.?\s?\d{3}\s?\/?\s?\d{4}\s?-?\s?\d{2})/.exec(trecho);
  return m ? m[1].replace(/\D/g, '') : '';
}

/** O informe é da empresa (ela é a fonte pagadora)? cnpj: o da empresa, com ou sem pontos. */
export function informeDaEmpresa(texto: string, cnpj: string): boolean {
  const c = String(cnpj ?? '').replace(/\D/g, '');
  return c.length === 14 && cnpjDaFontePagadora(texto) === c;
}

/** O ano-base do informe pelo nome do arquivo do arquivador ("2025 - INFORME DE RENDIMENTOS X.pdf"); null sem ele. */
export function anoDoInforme(nome: string): number | null {
  const m = /^(?:\dº TRIMESTRE )?((?:19|20)\d{2}) - INFORME DE RENDIMENTOS .+\.pdf$/i.exec(String(nome ?? '').trim());
  return m ? Number(m[1]) : null;
}

