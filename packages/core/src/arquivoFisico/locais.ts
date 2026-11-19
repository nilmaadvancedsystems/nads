// Os lugares do arquivo físico (19/11/2026: "vou precisar imprimir identificação das prateleiras: tem 6 prateleiras, cada
// uma tem 6 fileiras"). A localização da caixa passa a ser "Prateleira 3 · Fileira 2" (escolhida no formulário; o texto
// livre continua valendo para o que não está nas prateleiras). Para imprimir: a placa de cada prateleira (uma por folha) e
// a etiqueta de cada fileira (oito por folha), com o QR code que abre no nads as caixas daquela fileira.

/** Como o escritório está hoje (19/11/2026): 6 prateleiras de 6 fileiras. */
export const PRATELEIRAS_PADRAO = 6;
export const FILEIRAS_PADRAO = 6;
/** o teto das contas da tela de impressão */
export const MAXIMO_DE_PRATELEIRAS = 30;
export const MAXIMO_DE_FILEIRAS = 20;

export interface Lugar { prateleira: number; fileira: number }

/** 'Prateleira 3 · Fileira 2' (o texto que vai na caixa). */
export const rotuloDoLugar = (l: Lugar) => 'Prateleira ' + l.prateleira + ' · Fileira ' + l.fileira;
/** 'P3-F2' (o código curto da etiqueta). */
export const codigoDoLugar = (l: Lugar) => 'P' + l.prateleira + '-F' + l.fileira;

/** O lugar escrito na caixa ('Prateleira 3 · Fileira 2', 'prateleira 3, fileira 2' ou 'P3-F2'); null quando é texto livre. */
export function lerLugar(texto: string): Lugar | null {
  const t = texto.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const m = /^prateleira\s*(\d{1,2})\s*[·,;\-–]?\s*fileira\s*(\d{1,2})$/.exec(t) || /^p\s*(\d{1,2})\s*-?\s*f\s*(\d{1,2})$/.exec(t);
  if (!m) return null;
  const l = { prateleira: Number(m[1]), fileira: Number(m[2]) };
  return l.prateleira > 0 && l.fileira > 0 ? l : null;
}

/** Um número inteiro entre 1 e o teto (o que não vale vira o padrão). */
export function quantidadeDeLugares(v: unknown, padrao: number, teto: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, teto) : padrao;
}

/** Todos os lugares: prateleira por prateleira, fileira por fileira. */
export function lugares(prateleiras: number, fileiras: number): Lugar[] {
  const r: Lugar[] = [];
  for (let p = 1; p <= prateleiras; p++) for (let f = 1; f <= fileiras; f++) r.push({ prateleira: p, fileira: f });
  return r;
}

/** O endereço que o QR da fileira abre: a lista das caixas daquele lugar. */
export function linkDoLugar(origem: string, l: Lugar): string {
  return origem.replace(/\/+$/, '') + '/tarefas/arquivo-fisico/caixas?local=' + encodeURIComponent(rotuloDoLugar(l));
}

const ESTILO_BASE = `*{box-sizing:border-box}
  :root{color-scheme:light}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:Calibri,"Segoe UI",Arial,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pagina{break-after:page;page-break-after:always}
  .pagina:last-child{break-after:auto;page-break-after:auto}`;

/** A placa de cada prateleira: uma por folha, a A4 deitada, o número bem grande (para ler de longe). */
export function htmlDasPlacasDasPrateleiras(p: { prateleiras: readonly number[]; fileiras: number; logo: { definicao: string; uso: string } }): string {
  const placas = p.prateleiras.map(n => `<section class="pagina"><div class="pl">
<div class="pl-logo">${p.logo.uso}</div>
<div class="pl-rot">PRATELEIRA</div>
<div class="pl-num">${n}</div>
<div class="pl-fil">Fileiras 1 a ${p.fileiras}</div></div></section>`);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Placas das prateleiras</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  ${ESTILO_BASE}
  .pl{height:194mm;border:.6mm solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4mm}
  .pl-logo svg{height:24mm;width:auto;display:block}
  .pl-rot{font-size:48pt;font-weight:700;letter-spacing:4pt}
  .pl-num{font-size:220pt;font-weight:700;line-height:.95}
  .pl-fil{font-size:22pt}
</style></head><body>${p.logo.definicao}${placas.join('')}</body></html>`;
}

/** As etiquetas das fileiras: oito por folha (a A4 em pé, 2 colunas de 4), cada uma com a prateleira, a fileira e o QR. */
export function htmlDasEtiquetasDasFileiras(p: { lugares: readonly Lugar[]; qr: Readonly<Record<string, string>> }): string {
  const etiqueta = (l: Lugar) => `<div class="fi">
<div class="fi-pra">PRATELEIRA ${l.prateleira}</div>
<div class="fi-meio"><div class="fi-txt"><div class="fi-rot">FILEIRA</div><div class="fi-num">${l.fileira}</div></div><div class="fi-qr">${p.qr[codigoDoLugar(l)] || ''}</div></div>
<div class="fi-cod">${codigoDoLugar(l)}</div></div>`;
  const paginas: string[] = [];
  for (let i = 0; i < p.lugares.length; i += 8) paginas.push(`<section class="pagina"><div class="grade">${p.lugares.slice(i, i + 8).map(etiqueta).join('')}</div></section>`);
  // a folha em pé: 210 − 2 × 8 = 194 mm de largura útil (2 × 94 + 6), 297 − 16 = 281 mm de altura (4 × 66 + 3 × 5)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas das fileiras</title>
<style>
  @page{size:A4 portrait;margin:8mm}
  ${ESTILO_BASE}
  .grade{display:grid;grid-template-columns:94mm 94mm;grid-auto-rows:66mm;gap:5mm 6mm}
  .fi{border:.5mm solid #000;display:flex;flex-direction:column;overflow:hidden;break-inside:avoid}
  .fi-pra{background:#000;color:#fff;font-size:20pt;font-weight:700;text-align:center;padding:1.5mm 0;letter-spacing:1pt}
  .fi-meio{flex:1;display:flex;align-items:center;justify-content:space-around;padding:0 4mm}
  .fi-txt{text-align:center}
  .fi-rot{font-size:16pt;font-weight:700;letter-spacing:2pt}
  .fi-num{font-size:66pt;font-weight:700;line-height:1}
  .fi-qr svg{width:30mm;height:30mm;display:block}
  .fi-cod{text-align:center;font-size:11pt;padding-bottom:1.5mm}
</style></head><body>${paginas.join('')}</body></html>`;
}
