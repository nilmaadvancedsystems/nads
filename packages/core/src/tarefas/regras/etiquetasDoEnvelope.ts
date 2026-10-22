// As etiquetas do envelope do mês (Heverton, 20/10/2026: "Gerador de etiqueta mensal"; o modelo é a planilha
// "ETIQUETA ENVELOPE 2026"): a faixa preta com a logo da Nilma e "MOVIMENTO MM/AAAA", o código do cliente em destaque,
// o nome, a caixa com o regime (ou o texto escolhido) e o departamento embaixo. Uma por página: a folha A4 deitada,
// a etiqueta ocupando a folha inteira (22/10/2026: "isso tinha que ficar de lado, pegando a folha inteira"); 2 ou 4 por
// página: a folha em pé, em metades ou quartos. Altura fixa (nenhuma é cortada entre duas páginas). A logo vem pronta (o SVG) de quem chama, desenhada
// uma vez só no documento.
import { competenciaParaEtiqueta } from './etiquetasDaFolha';

export interface EtiquetaDoEnvelope { codigo: number | null; nome: string; caixa: string }
export type EnvelopesPorPagina = 1 | 2 | 4;
export const ENVELOPES_POR_PAGINA: readonly EnvelopesPorPagina[] = [1, 2, 4];
export const DEPARTAMENTOS_DO_ENVELOPE = ['Fiscal', 'Contábil', 'Pessoal'] as const;
export type DepartamentoDoEnvelope = (typeof DEPARTAMENTOS_DO_ENVELOPE)[number];

export interface PedidoDeEnvelopes {
  competencia: string;
  departamento: DepartamentoDoEnvelope;
  porPagina: EnvelopesPorPagina;
  etiquetas: readonly EtiquetaDoEnvelope[];
  /** a logo da Nilma (branca, para a faixa preta): o desenho, uma vez no documento, e o uso em cada etiqueta */
  logo: { definicao: string; uso: string };
}

/**
 * O regime abreviado, para a caixa da etiqueta (o "PJ-F" da planilha não tem regra conhecida: até o Heverton dizer o
 * que é, vai a sigla do regime do Cadastro): Simples → SN, MEI → MEI, Presumido → LP, Real → LR, Isentas → ISENTA,
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

/** quantas páginas o pedido ocupa */
export const paginasDosEnvelopes = (quantas: number, porPagina: EnvelopesPorPagina) => Math.ceil(Math.max(0, quantas) / porPagina);

/** O HTML de uma etiqueta */
function etiqueta(e: EtiquetaDoEnvelope, movimento: string, departamento: string, logo: string): string {
  return `<div class="env"><div class="env-faixa"><span class="env-logo">${logo}</span><span class="env-mov">MOVIMENTO ${esc(movimento)}</span></div>
<div class="env-cod">${esc(codigoNaEtiqueta(e.codigo))}</div>
<div class="env-nome">${esc(e.nome)}</div>
<div class="env-caixa-linha"><span class="env-caixa">${esc(e.caixa) || '&nbsp;'}</span></div>
<div class="env-dep">DEPARTAMENTO ${esc(departamento.toUpperCase())}</div></div>`;
}

/** O documento A4 para imprimir: as etiquetas na grade (1, 2 ou 4 por página), cada página fecha sem cortar nenhuma */
export function htmlDosEnvelopes(p: PedidoDeEnvelopes): string {
  const movimento = competenciaParaEtiqueta(p.competencia.trim());
  const porPagina = ENVELOPES_POR_PAGINA.includes(p.porPagina) ? p.porPagina : 2;
  const paginas: string[] = [];
  for (let i = 0; i < p.etiquetas.length; i += porPagina) {
    paginas.push(`<section class="pagina p${porPagina}">${p.etiquetas.slice(i, i + porPagina).map(e => etiqueta(e, movimento, p.departamento, p.logo.uso)).join('')}</section>`);
  }
  // uma por página: a folha deitada, a etiqueta na altura útil inteira (210 − 2 × 8 de margem = 194 mm), maior;
  // 2 ou 4: a folha em pé, a altura útil (297 − 2 × 8 = 281 mm) em duas linhas, com 6 mm entre elas
  const deitada = porPagina === 1;
  const altura = deitada ? 194 : Math.floor((281 - 6) / 2);
  const escala = deitada ? 1.3 : porPagina === 4 ? 0.62 : 1;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas ${esc(movimento)} — ${esc(p.departamento)}</title>
<style>
  @page{size:A4${deitada ? ' landscape' : ''};margin:8mm}
  *{box-sizing:border-box}
  :root{color-scheme:light}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:Calibri,"Segoe UI",Arial,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pagina{display:grid;gap:6mm;grid-auto-rows:${altura}mm;break-after:page;page-break-after:always;align-content:start}
  .pagina:last-child{break-after:auto;page-break-after:auto}
  .p1,.p2{grid-template-columns:1fr}
  .p4{grid-template-columns:1fr 1fr}
  .env{break-inside:avoid;page-break-inside:avoid;height:${altura}mm;border:.4mm solid #000;display:flex;flex-direction:column;align-items:center;overflow:hidden}
  .env-faixa{width:100%;background:#000;color:#fff;display:flex;align-items:center;gap:${6 * escala}mm;padding:${3 * escala}mm ${5 * escala}mm;height:${22 * escala}mm}
  .env-logo{height:100%;display:flex;align-items:center}
  .env-logo svg{height:${15 * escala}mm;width:auto;display:block}
  .env-mov{flex:1;text-align:center;font-size:${30 * escala}pt;letter-spacing:.5pt;white-space:nowrap}
  .env-cod{font-size:${54 * escala}pt;font-weight:700;margin-top:${6 * escala}mm;line-height:1}
  .env-nome{font-size:${24 * escala}pt;font-weight:700;text-align:center;padding:${4 * escala}mm ${6 * escala}mm 0;line-height:1.15;border-top:.6mm solid #bbb;margin-top:${5 * escala}mm;width:100%}
  .env-caixa-linha{flex:1;display:flex;align-items:center;justify-content:center;width:100%}
  .env-caixa{display:inline-block;min-width:${70 * escala}mm;border:.4mm solid #000;padding:${3 * escala}mm ${8 * escala}mm;font-size:${26 * escala}pt;text-align:center}
  .env-dep{font-size:${22 * escala}pt;font-weight:700;padding-bottom:${5 * escala}mm}
</style></head><body>${p.logo.definicao}${paginas.join('')}</body></html>`;
}
