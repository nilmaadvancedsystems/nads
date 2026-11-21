// A etiqueta da caixa do arquivo físico, IGUAL à planilha "Etiquetas Caixa Box" do escritório (19/11/2026: "ta muito
// diferente do que eu mandei"): as mesmas medidas da aba ETIQUETA, em pontos — a largura das colunas (2 × 215 px = 322,5 pt,
// com 48 pt entre as duas etiquetas), a altura de cada linha, os tamanhos de letra, o cinza (#D9D9D9) das faixas, a borda
// grossa por fora e fina por dentro, e a folha (A4 deitada, margens de 13 mm dos lados e 20 mm em cima e embaixo, duas
// etiquetas por folha). As linhas, de cima para baixo:
//   logo (71,25) · nome (20,25; 11 negrito, cinza) · código (51,75; 48 negrito) · "Tipo" (12; 10 negrito, cinza) ·
//   PJ - F (42; 36) · faixa cinza (12) · linha em branco (35,1) · "Data Arquivamento | ANO" (14,25) · valores (35,1; 14
//   negrito) · "Código da Caixa | Localização" (12) · valores (35,1; 24 negrito) · "Observações" (12) · observações (45)
// O que a planilha não tem é só o QR code, no canto direito da linha do logo (abre a caixa no nads pelo celular). O QR e a
// logo vêm prontos (o SVG) de quem chama.
import { codigoDaCaixa, type Caixa } from './caixas';
import { codigoDoLugar, lerLugar } from './locais';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');

/** 'PJ-F' → 'PJ - F' (como na planilha). */
export const tipoComEspacos = (tipo: string) => tipo.replace(/\s*-\s*/, ' - ');

/**
 * A localização como cabe na etiqueta: a prateleira e a fileira viram o código curto da etiqueta da fileira ('P1-F3', no
 * tamanho grande da planilha); o texto livre sai menor, quebrando a linha.
 */
export function localNaEtiqueta(local: string): { texto: string; curto: boolean } {
  const l = lerLugar(local);
  if (l) return { texto: codigoDoLugar(l), curto: true };
  const t = local.trim();
  return { texto: t, curto: t.length <= 7 };
}

export interface PedidoDeEtiquetasDaCaixa {
  caixas: readonly Caixa[];
  /** o QR de cada caixa (o SVG), pelo id */
  qr: Readonly<Record<string, string>>;
  /** a logo colorida da Nilma: o desenho, uma vez no documento, e o uso em cada etiqueta */
  logo: { definicao: string; uso: string };
}

function etiqueta(c: Caixa, qr: string, logo: string): string {
  const local = localNaEtiqueta(c.local);
  // o nome comprido diminui para caber na faixa (a planilha corta)
  const nomeMenor = c.nome.length > 38;
  return `<table class="cx">
<colgroup><col><col></colgroup>
<tr class="r-logo"><td colspan="2"><div class="cx-topo"><span class="cx-logo">${logo}</span>${qr ? `<span class="cx-qr">${qr}</span>` : ''}</div></td></tr>
<tr class="r-nome"><td colspan="2" class="cinza${nomeMenor ? ' menor' : ''}">${esc(c.nome)}</td></tr>
<tr class="r-cod"><td colspan="2">${c.codigo}</td></tr>
<tr class="r-rot"><td colspan="2" class="cinza">Tipo</td></tr>
<tr class="r-tipo"><td colspan="2">${esc(tipoComEspacos(c.tipo))}</td></tr>
<tr class="r-faixa"><td colspan="2" class="cinza"></td></tr>
<tr class="r-branco"><td colspan="2"></td></tr>
<tr class="r-rot2"><td class="cinza">Data Arquivamento</td><td class="cinza">ANO</td></tr>
<tr class="r-val"><td>${esc(dataBr(c.arquivadaEm))}</td><td>${c.ano}</td></tr>
<tr class="r-rot"><td class="cinza">Código da Caixa</td><td class="cinza">Localização</td></tr>
<tr class="r-val2"><td>${codigoDaCaixa(c.numero)}</td><td class="${local.curto ? '' : 'local-longo'}">${esc(local.texto)}</td></tr>
<tr class="r-rot"><td colspan="2" class="cinza">Observações</td></tr>
<tr class="r-obs"><td colspan="2">${esc(c.observacoes)}</td></tr>
</table>`;
}

/** A folha A4 deitada (o que se vê depois de girar): 297 × 210 mm, a 6 mm da beira e 12 mm entre as duas metades. */
const FOLHA = { largura: 297, altura: 210, beira: 6, entre: 12 };
const MM_POR_PT = 25.4 / 72;
/** A planilha: 322,5 pt de largura e 397,9 pt de altura (a soma das linhas). */
const PLANILHA = { largura: 322.5, altura: 397.85 };
/** Cada etiqueta numa metade da folha (19/11/2026: "pra caber legal tem que ser 2 dessa por folha a4"; "cada uma fica numa
 *  metade"): 136,5 × 198 mm. As letras crescem na proporção da largura e as linhas na da altura. */
const LARGURA_MM = (FOLHA.largura - 2 * FOLHA.beira - FOLHA.entre) / 2;
const ALTURA_MM = FOLHA.altura - 2 * FOLHA.beira;
const KL = LARGURA_MM / (PLANILHA.largura * MM_POR_PT);
const KA = ALTURA_MM / (PLANILHA.altura * MM_POR_PT);
/** Um tamanho da planilha, crescido: na largura (letras) ou na altura (linhas). */
const l = (pt: number) => (pt * KL).toFixed(2) + 'pt';
const a = (pt: number) => (pt * KA).toFixed(2) + 'pt';

/** O documento A4 para imprimir: duas etiquetas por folha, cada uma ocupando uma metade (a folha em pé, a página deitada
 *  desenhada girada nela: a impressora do escritório ignora a folha deitada e encolhe tudo). */
export function htmlDasEtiquetasDaCaixa(p: PedidoDeEtiquetasDaCaixa): string {
  const paginas: string[] = [];
  for (let i = 0; i < p.caixas.length; i += 2) {
    const par = p.caixas.slice(i, i + 2).map(c => etiqueta(c, p.qr[c.id] || '', p.logo.uso));
    paginas.push(`<section class="pagina"><div class="folha">${par.join('')}</div></section>`);
  }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas das caixas</title>
<style>
  @page{size:A4 portrait;margin:0}
  *{box-sizing:border-box}
  :root{color-scheme:light}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pagina{position:relative;width:210mm;height:297mm;overflow:hidden;break-after:page;page-break-after:always}
  .pagina:last-child{break-after:auto;page-break-after:auto}
  .folha{position:absolute;top:0;left:210mm;width:${FOLHA.largura}mm;height:${FOLHA.altura}mm;transform-origin:0 0;transform:rotate(90deg);
    padding:${FOLHA.beira}mm;display:flex;gap:${FOLHA.entre}mm;align-items:stretch}
  /* a linha de corte, tracejada, no meio da folha */
  .folha::after{content:"";position:absolute;top:3mm;bottom:3mm;left:50%;border-left:.3mm dashed #999}
  .cx{width:${LARGURA_MM}mm;height:${ALTURA_MM}mm;border-collapse:collapse;table-layout:fixed;border:${l(1.5)} solid #000;break-inside:avoid}
  .cx col{width:50%}
  .cx td{border:${l(.75)} solid #000;padding:0 ${l(3)};text-align:center;vertical-align:middle;overflow:hidden;line-height:1.1}
  .cx td.cinza{background:#d9d9d9}
  .r-logo td{height:${a(71.25)};padding:0}
  .cx-topo{position:relative;height:${a(71.25)};display:flex;align-items:center;justify-content:center}
  .cx-logo svg{height:${a(52)};width:auto;display:block}
  .cx-qr{position:absolute;right:${l(5)};top:50%;transform:translateY(-50%)}
  .cx-qr svg{width:${a(60)};height:${a(60)};display:block}
  .r-nome td{height:${a(20.25)};font-size:${l(11)};font-weight:700;white-space:nowrap;text-overflow:ellipsis}
  .r-nome td.menor{font-size:${l(9)}}
  .r-cod td{height:${a(51.75)};font-size:${l(48)};font-weight:700}
  .r-rot td{height:${a(12)};font-size:${l(10)};font-weight:700;padding:0}
  .r-rot2 td{height:${a(14.25)};font-size:${l(10)};font-weight:700;padding:0}
  .r-tipo td{height:${a(42)};font-size:${l(36)}}
  .r-faixa td{height:${a(12)};padding:0}
  .r-branco td{height:${a(35.1)}}
  .r-val td{height:${a(35.1)};font-size:${l(14)};font-weight:700}
  .r-val2 td{height:${a(35.1)};font-size:${l(24)};font-weight:700}
  .r-val2 td.local-longo{font-size:${l(11)};font-weight:700;white-space:normal}
  .r-obs td{height:${a(45)};font-size:${l(11)};text-align:left;vertical-align:top;padding:${l(3)} ${l(4)};white-space:pre-wrap}
</style></head><body>${p.logo.definicao}${paginas.join('')}</body></html>`;
}
