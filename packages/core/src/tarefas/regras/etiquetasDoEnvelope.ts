// As etiquetas do envelope do mês (Heverton, 20/10/2026: "Gerador de etiqueta mensal"; o modelo é a planilha
// "ETIQUETA ENVELOPE 2026"): a faixa preta com a logo da Nilma e "MOVIMENTO MM/AAAA", o código do cliente em destaque,
// o nome, a caixa com o regime (ou o texto escolhido) e o departamento embaixo. Sempre uma por folha, a A4 deitada, a
// etiqueta ocupando a folha inteira (22/10/2026: "isso tinha que ficar de lado, pegando a folha inteira"; 26/10/2026:
// "um por folha, todos devem ser assim"). A logo vem pronta (o SVG) de quem chama, desenhada uma vez só no documento.
import { competenciaParaEtiqueta } from './etiquetasDaFolha';

export interface EtiquetaDoEnvelope { codigo: number | null; nome: string; caixa: string }
export const DEPARTAMENTOS_DO_ENVELOPE = ['Fiscal', 'Contábil', 'Pessoal'] as const;
export type DepartamentoDoEnvelope = (typeof DEPARTAMENTOS_DO_ENVELOPE)[number];

export interface PedidoDeEnvelopes {
  competencia: string;
  departamento: DepartamentoDoEnvelope;
  etiquetas: readonly EtiquetaDoEnvelope[];
  /** a logo da Nilma (branca, para a faixa preta): o desenho, uma vez no documento, e o uso em cada etiqueta */
  logo: { definicao: string; uso: string };
}

/**
 * O tipo da empresa na caixa da etiqueta, como na planilha (22/10/2026: "PJ-F é pessoa jurídica fiscal"): PJ (pessoa
 * jurídica) ou PF (os regimes Física e Domésticas), um traço e a inicial do departamento do envelope (F, C ou P).
 */
export function tipoNaEtiqueta(regime: string | null | undefined, departamento: DepartamentoDoEnvelope): string {
  const r = String(regime || '').trim();
  return (r === 'Física' || r === 'Domésticas' ? 'PF' : 'PJ') + '-' + (departamento === 'Contábil' ? 'C' : departamento === 'Pessoal' ? 'P' : 'F');
}

/**
 * O regime abreviado, para a caixa da etiqueta (a opção "Sigla"): Simples → SN, MEI → MEI, Presumido → LP, Real → LR, Isentas → ISENTA,
 * Física → PF, Domésticas → DOM.
 */
export function regimeAbreviado(regime: string | null | undefined): string {
  const r = String(regime || '').trim();
  const SIGLAS: Record<string, string> = { Simples: 'SN', MEI: 'MEI', Presumido: 'LP', Real: 'LR', Isentas: 'ISENTA', 'Física': 'PF', 'Domésticas': 'DOM' };
  return SIGLAS[r] ?? r.toUpperCase();
}

/** O código como na planilha (sem zeros à esquerda) */
const codigoNaEtiqueta = (c: number | null) => (c == null ? '' : String(c));

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** O HTML de uma etiqueta */
function etiqueta(e: EtiquetaDoEnvelope, movimento: string, departamento: string, logo: string): string {
  return `<div class="env"><div class="env-faixa"><span class="env-logo">${logo}</span><span class="env-mov">MOVIMENTO ${esc(movimento)}</span></div>
<div class="env-cod">${esc(codigoNaEtiqueta(e.codigo))}</div>
<div class="env-nome">${esc(e.nome)}</div>
<div class="env-caixa-linha"><span class="env-caixa">${esc(e.caixa) || '&nbsp;'}</span></div>
<div class="env-dep">DEPARTAMENTO ${esc(departamento.toUpperCase())}</div></div>`;
}

/** O documento A4 para imprimir: uma etiqueta por folha, deitada, ocupando a folha inteira */
export function htmlDosEnvelopes(p: PedidoDeEnvelopes): string {
  const movimento = competenciaParaEtiqueta(p.competencia.trim());
  const paginas = p.etiquetas.map(e => `<section class="pagina">${etiqueta(e, movimento, p.departamento, p.logo.uso)}</section>`);
  // a folha deitada: a etiqueta na altura útil inteira (210 − 2 × 8 de margem = 194 mm), nos tamanhos da planilha
  // (MOVIMENTO 45, código 72, nome 40, caixa 48, departamento 36)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas ${esc(movimento)} — ${esc(p.departamento)}</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  *{box-sizing:border-box}
  :root{color-scheme:light}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:Calibri,"Segoe UI",Arial,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pagina{break-after:page;page-break-after:always}
  .pagina:last-child{break-after:auto;page-break-after:auto}
  .env{break-inside:avoid;page-break-inside:avoid;height:194mm;border:.4mm solid #000;display:flex;flex-direction:column;align-items:center;overflow:hidden}
  .env-faixa{width:100%;background:#000;color:#fff;display:flex;align-items:center;gap:8mm;padding:4mm 6.5mm;height:28.6mm}
  .env-logo{height:100%;display:flex;align-items:center}
  .env-logo svg{height:19.5mm;width:auto;display:block}
  .env-mov{flex:1;text-align:center;font-size:45pt;letter-spacing:.5pt;white-space:nowrap}
  .env-cod{font-size:72pt;font-weight:700;margin-top:8mm;line-height:1}
  .env-nome{font-size:40pt;font-weight:700;text-align:center;padding:5mm 8mm 0;line-height:1.15;border-top:.6mm solid #bbb;margin-top:6.5mm;width:100%}
  .env-caixa-linha{flex:1;display:flex;align-items:center;justify-content:center;width:100%}
  .env-caixa{display:inline-block;min-width:91mm;border:.4mm solid #000;padding:4mm 10mm;font-size:48pt;text-align:center}
  .env-dep{font-size:36pt;font-weight:700;padding-bottom:6.5mm}
</style></head><body>${p.logo.definicao}${paginas.join('')}</body></html>`;
}
