// A etiqueta da caixa do arquivo físico, no modelo da planilha "Etiquetas Caixa Box" do escritório (19/11/2026): a logo
// da Nilma, o nome da empresa, o código em destaque, o Tipo (PJ - F), a data do arquivamento e o ano, o código da caixa e
// a localização, e as observações. Duas por folha (a A4 deitada, uma ao lado da outra, como na planilha), com o QR code
// no alto, que abre a caixa no nads pelo celular. O QR e a logo vêm prontos (o SVG) de quem chama.
import { codigoDaCaixa, type Caixa } from './caixas';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');

/** 'PJ-F' → 'PJ - F' (como na planilha). */
export const tipoComEspacos = (tipo: string) => tipo.replace(/\s*-\s*/, ' - ');

export interface PedidoDeEtiquetasDaCaixa {
  caixas: readonly Caixa[];
  /** o QR de cada caixa (o SVG), pelo id */
  qr: Readonly<Record<string, string>>;
  /** a logo colorida da Nilma: o desenho, uma vez no documento, e o uso em cada etiqueta */
  logo: { definicao: string; uso: string };
}

function etiqueta(c: Caixa, qr: string, logo: string): string {
  return `<div class="cx">
<div class="cx-topo"><span class="cx-logo">${logo}</span><span class="cx-qr">${qr}</span></div>
<div class="cx-nome">${esc(c.nome)}</div>
<div class="cx-cod">${c.codigo}</div>
<div class="cx-rot">Tipo</div>
<div class="cx-tipo">${esc(tipoComEspacos(c.tipo))}</div>
<div class="cx-dep">Departamento ${esc(c.departamento)}</div>
<div class="cx-par"><div class="cx-rot">Data Arquivamento</div><div class="cx-rot">ANO</div></div>
<div class="cx-par cx-val"><div>${esc(dataBr(c.arquivadaEm))}</div><div>${c.ano}</div></div>
<div class="cx-par"><div class="cx-rot">Código da Caixa</div><div class="cx-rot">Localização</div></div>
<div class="cx-par cx-val"><div class="cx-num">${codigoDaCaixa(c.numero)}</div><div class="cx-local">${esc(c.local)}</div></div>
<div class="cx-rot">Observações</div>
<div class="cx-obs">${esc(c.observacoes)}</div>
</div>`;
}

/** O documento A4 para imprimir: duas etiquetas por folha deitada. */
export function htmlDasEtiquetasDaCaixa(p: PedidoDeEtiquetasDaCaixa): string {
  const paginas: string[] = [];
  for (let i = 0; i < p.caixas.length; i += 2) {
    const par = p.caixas.slice(i, i + 2).map(c => etiqueta(c, p.qr[c.id] || '', p.logo.uso));
    paginas.push(`<section class="pagina">${par.join('')}</section>`);
  }
  // a folha deitada: 297 − 2 × 8 = 281 mm de largura útil, duas de 136 mm com 9 mm entre elas; 194 mm de altura
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas das caixas</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  *{box-sizing:border-box}
  :root{color-scheme:light}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:Calibri,"Segoe UI",Arial,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pagina{display:flex;gap:9mm;break-after:page;page-break-after:always}
  .pagina:last-child{break-after:auto;page-break-after:auto}
  .cx{width:136mm;height:194mm;border:.4mm solid #000;display:flex;flex-direction:column;text-align:center;overflow:hidden;break-inside:avoid}
  .cx>div{border-bottom:.3mm solid #000}
  .cx-topo{height:30mm;display:flex;align-items:center;justify-content:space-between;padding:3mm 4mm}
  .cx-logo svg{height:20mm;width:auto;display:block}
  .cx-qr svg{height:25mm;width:25mm;display:block}
  .cx-nome{background:#d9d9d9;font-size:13pt;font-weight:700;padding:1.5mm 3mm;text-transform:uppercase}
  .cx-cod{font-size:44pt;font-weight:700;line-height:1.1;padding:1mm 0}
  .cx-rot{background:#d9d9d9;font-size:11pt;font-weight:700;padding:.6mm 0}
  .cx-tipo{font-size:34pt;line-height:1.15;padding:1mm 0}
  .cx-dep{font-size:12pt;padding:2.5mm 0;text-transform:uppercase}
  .cx-par{display:grid;grid-template-columns:1fr 1fr}
  .cx-par>div:first-child{border-right:.3mm solid #000}
  .cx-val>div{font-size:18pt;font-weight:700;padding:3mm 1mm;display:flex;align-items:center;justify-content:center}
  .cx-num{font-size:24pt!important}
  .cx-local{font-size:14pt!important;font-weight:400!important}
  .cx-obs{flex:1;font-size:12pt;padding:2mm 3mm;text-align:left;white-space:pre-wrap;border-bottom:0!important}
</style></head><body>${p.logo.definicao}${paginas.join('')}</body></html>`;
}
