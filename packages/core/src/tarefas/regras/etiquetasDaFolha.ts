// As etiquetas da folha de pagamento (Savio, 15/10/2026: "preciso de um gerador de etiquetas para folhas de pagamento,
// com várias na mesma página, respeitando o limite da página"; a competência e a data de pagamento são impressas nelas).
// O texto é o do modelo do Savio (art. 459, § 1º, da CLT). A folha é A4 e a grade é de 2 colunas; cada etiqueta tem
// altura fixa, então a conta de quantas cabem por página é exata e nenhuma é cortada entre duas páginas.

/** A folha A4 e a grade, em milímetros */
export const FOLHA_A4 = { largura: 210, altura: 297, margem: 10, colunas: 2, espaco: 4, alturaDaEtiqueta: 66 } as const;

/** Quantas linhas de etiquetas cabem na altura útil da folha */
export const LINHAS_POR_PAGINA = Math.floor((FOLHA_A4.altura - 2 * FOLHA_A4.margem + FOLHA_A4.espaco) / (FOLHA_A4.alturaDaEtiqueta + FOLHA_A4.espaco));
/** Quantas etiquetas cabem numa página (uma página cheia) */
export const ETIQUETAS_POR_PAGINA = LINHAS_POR_PAGINA * FOLHA_A4.colunas;
/** O teto do pedido, para não travar o navegador */
export const MAXIMO_DE_ETIQUETAS = 1000;

export interface PedidoDeEtiquetas { competencia: string; dataDePagamento: string; quantidade: number }

/** "2026-10" → "10/2026" (a competência como se escreve na etiqueta) */
export function competenciaParaEtiqueta(c: string): string {
  return /^\d{4}-\d{2}$/.test(c) ? c.slice(5, 7) + '/' + c.slice(0, 4) : c;
}

/** A quantidade pedida, inteira, de 1 ao teto (vazio ou inválido = uma página cheia) */
export function quantidadeValida(q: unknown): number {
  const n = Math.floor(Number(q));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAXIMO_DE_ETIQUETAS) : ETIQUETAS_POR_PAGINA;
}

/** Quantas páginas a quantidade ocupa */
export const paginasDe = (quantidade: number) => Math.ceil(quantidadeValida(quantidade) / ETIQUETAS_POR_PAGINA);

// --- a data de pagamento sugerida -----------------------------------------------------------------------------------

const dois = (n: number) => String(n).padStart(2, '0');

/** A Páscoa do ano (algoritmo de Meeus/Jones/Butcher), para a Sexta-feira Santa */
function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

/** Feriado nacional (os fixos e a Sexta-feira Santa); também usado nos prazos do DP (prazosDoDp.ts) */
export function feriadoNacional(d: Date): boolean {
  const md = dois(d.getMonth() + 1) + '-' + dois(d.getDate());
  if (['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].includes(md)) return true;
  const sexta = pascoa(d.getFullYear());
  sexta.setDate(sexta.getDate() - 2);
  return sexta.getMonth() === d.getMonth() && sexta.getDate() === d.getDate();
}

/**
 * O 5º dia útil do mês seguinte à competência ('aaaa-mm'), "dd/mm/aaaa". Para o pagamento de salário o sábado conta
 * como dia útil (Súmula 381 do TST); o domingo e o feriado nacional não. É só a sugestão: o campo é editável.
 */
export function quintoDiaUtilDoMesSeguinte(competencia: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]), 1); // o mês seguinte (o mês do Date é base 0, então "mm" já é o próximo)
  let uteis = 0;
  for (;;) {
    if (d.getDay() !== 0 && !feriadoNacional(d)) uteis++;
    if (uteis === 5) break;
    d.setDate(d.getDate() + 1);
  }
  return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear();
}

// --- o documento de impressão ---------------------------------------------------------------------------------------

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** O HTML de uma etiqueta; a competência e a data (os dois textos variáveis) saem em negrito */
function etiqueta(competencia: string, data: string): string {
  return `<div class="etq"><div class="etq-in">
<p class="etq-titulo">ATENÇÃO</p>
<p class="etq-lei">De acordo com o § 1º do art. 459 da CLT, o prazo para pagamento de salários vai até o 5º dia útil subsequente ao mês de competência.</p>
<p class="etq-texto">Assim sendo, datar os recibos de pagamento ref. competência <b>${esc(competencia)}</b> até <b>${esc(data)}</b> e em seguida devolver a 1ª via para o arquivamento na contabilidade.</p>
<p class="etq-nota">NOTA: O próprio funcionário deve colocar a data e assinar o recibo sem rubricas, sob pena de o empregador ser autuado por falsificação.</p>
</div></div>`;
}

/**
 * O documento A4 para imprimir: uma página por grupo de ETIQUETAS_POR_PAGINA, na grade de 2 colunas; a etiqueta tem
 * altura fixa e não parte (break-inside: avoid), então cada página fecha cheia e nada é cortado.
 */
export function htmlDasEtiquetas(p: PedidoDeEtiquetas): string {
  const total = quantidadeValida(p.quantidade);
  const competencia = competenciaParaEtiqueta(p.competencia.trim());
  const data = p.dataDePagamento.trim();
  const paginas: string[] = [];
  for (let feitas = 0; feitas < total; feitas += ETIQUETAS_POR_PAGINA) {
    const nestaPagina = Math.min(ETIQUETAS_POR_PAGINA, total - feitas);
    paginas.push(`<section class="pagina">${Array.from({ length: nestaPagina }, () => etiqueta(competencia, data)).join('')}</section>`);
  }
  const { margem, colunas, espaco, alturaDaEtiqueta } = FOLHA_A4;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas da folha ${esc(competencia)}</title>
<style>
  @page{size:A4;margin:${margem}mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:"Times New Roman",Times,serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pagina{display:grid;grid-template-columns:repeat(${colunas},1fr);grid-auto-rows:${alturaDaEtiqueta}mm;gap:${espaco}mm;break-after:page;page-break-after:always;align-content:start}
  .pagina:last-child{break-after:auto;page-break-after:auto}
  .etq{break-inside:avoid;page-break-inside:avoid;height:${alturaDaEtiqueta}mm;border:.5mm solid #000;padding:.7mm;overflow:hidden}
  .etq-in{height:100%;border:.25mm solid #000;padding:3mm 3.5mm;display:flex;flex-direction:column;justify-content:space-between;font-size:9.5pt;line-height:1.3}
  .etq p{margin:0}
  .etq-titulo{text-align:center;font-weight:700;text-decoration:underline}
  .etq-lei{font-style:italic;text-decoration:underline}
  .etq-texto{text-align:justify}
  .etq-nota{font-weight:700}
</style></head><body>${paginas.join('')}</body></html>`;
}
