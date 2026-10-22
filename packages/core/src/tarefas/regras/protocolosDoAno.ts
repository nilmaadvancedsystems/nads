// Os protocolos do ano do Fiscal (Heverton, 22/10/2026; o modelo é a planilha "RELATORIO EMPRESA 2026"), no padrão do
// protocolo de entrega de tributos: a logo, o título com o ano e uma linha por empresa (o código e a razão social), com
// uma coluna por mês (JAN a DEZ). O que o nads já sabe vem preenchido; o resto fica em branco para preencher à mão.
//   - "Protocolo de Extratos" (a aba "Protocolo Extratos", A4 em pé): OK = o extrato do mês chegou (a marca "extrato"
//     da Pendências, que o robô põe pelo e-mail e pela pasta do Drive); S/M = sem movimento no mês; "-" = a empresa não
//     manda extrato (o extrato "não se aplica" no Entregas), só até a competência de trabalho.
//   - "Protocolo REINF" (as abas "Protocolo - Reinf", A4 deitado): duas casas por mês, a do Fiscal e a do DP. E = a REINF
//     do mês transmitida pelo Fiscal (Fiscal › REINF, ou a marca do Fiscal na REINF do DP); P = feita pelo DP (Painel do
//     DP › REINF); "-" = a empresa não tem a REINF daquele lado, só até a competência de trabalho.
// As linhas não se partem entre páginas e o cabeçalho da tabela se repete em cada página.

export const MESES_DO_PROTOCOLO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'] as const;

/** As 12 competências do ano ('aaaa-mm'). */
export const competenciasDoAno = (ano: number) => MESES_DO_PROTOCOLO.map((_, i) => ano + '-' + String(i + 1).padStart(2, '0'));

/** Uma empresa do protocolo do ano: o código e o nome. */
export interface EmpresaDoAno { codigo: number; nome: string }

/** O documento do mês da Pendências (documentosMensal), já com o código do cliente. */
export interface DocumentoDoMes { codigo: number; competencia: string; extrato: boolean; semMovimento: boolean }

export interface LinhaDoAno { codigo: number; nome: string; /** uma casa por mês */ meses: string[] }

const porCodigo = <T extends EmpresaDoAno>(l: readonly T[]) => [...l].sort((a, b) => a.codigo - b.codigo);

/**
 * As linhas do protocolo de extratos. ate: a competência de trabalho ('aaaa-mm'; o "-" só vai até ela); semExtrato: os
 * códigos com o extrato "não se aplica"; preencher desligado = tudo em branco.
 */
export function linhasDoProtocoloDeExtratos(p: { ano: number; ate: string; empresas: readonly EmpresaDoAno[]; documentos: readonly DocumentoDoMes[]; semExtrato: ReadonlySet<number>; preencher: boolean }): LinhaDoAno[] {
  const comps = competenciasDoAno(p.ano);
  const docs = new Map<string, DocumentoDoMes>();
  if (p.preencher) for (const d of p.documentos) docs.set(d.codigo + '|' + d.competencia, d);
  return porCodigo(p.empresas).map(e => ({
    codigo: e.codigo, nome: e.nome,
    meses: comps.map(c => {
      if (!p.preencher) return '';
      const d = docs.get(e.codigo + '|' + c);
      if (d?.extrato) return 'OK';
      if (d?.semMovimento) return 'S/M';
      return p.semExtrato.has(e.codigo) && c <= p.ate ? '-' : '';
    }),
  }));
}

/** A REINF de uma empresa no ano: se tem a REINF no Fiscal e no DP, até quando o Fiscal transmitiu e quem fez a do DP. */
export interface ReinfDoAno extends EmpresaDoAno {
  noFiscal: boolean;
  noDp: boolean;
  /** 'aaaa-mm': até que competência o Fiscal transmitiu (Fiscal › REINF) */
  transmitidoAte?: string;
  /** as competências com a REINF do DP feita: pelo próprio DP ou marcada pelo Fiscal */
  doDp: Readonly<Record<string, 'dp' | 'fiscal'>>;
}

/** Duas casas por mês: [Fiscal, DP] de JAN a DEZ. */
export interface LinhaDaReinf { codigo: number; nome: string; meses: [string, string][] }

export function linhasDoProtocoloDaReinf(p: { ano: number; ate: string; empresas: readonly ReinfDoAno[]; preencher: boolean }): LinhaDaReinf[] {
  const comps = competenciasDoAno(p.ano);
  return porCodigo(p.empresas).map(e => ({
    codigo: e.codigo, nome: e.nome,
    meses: comps.map((c): [string, string] => {
      if (!p.preencher) return ['', ''];
      const passou = c <= p.ate;
      const fiscal = (e.transmitidoAte && e.transmitidoAte >= c) || e.doDp[c] === 'fiscal' ? 'E' : !e.noFiscal && passou ? '-' : '';
      const dp = e.doDp[c] === 'dp' ? 'P' : !e.noDp && passou ? '-' : '';
      return [fiscal, dp];
    }),
  }));
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const codigo5 = (n: number) => String(n).padStart(5, '0');

/** O que é comum aos dois: a folha, a logo, o título grande à direita e a tabela de linhas finas. */
function documento(p: { titulo: string; ano: number; deitado: boolean; logo: { definicao: string; uso: string }; cabecalho: string; corpo: string; pe: string; css: string }): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.titulo)} ${p.ano}</title>
<style>
  @page{size:A4${p.deitado ? ' landscape' : ''};margin:8mm}
  *{box-sizing:border-box}
  :root{color-scheme:light}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:"Century Gothic","Segoe UI",Arial,sans-serif;color:#000;font-size:8pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .topo{display:flex;align-items:center;gap:8mm;margin-bottom:4mm}
  .topo .logo svg{height:16mm;width:auto;display:block}
  .titulo{flex:1;text-align:right;font-size:22pt;line-height:1.1}
  table{width:100%;border-collapse:separate;border-spacing:1mm .6mm;table-layout:fixed}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th{background:#000;color:#fff;font-size:7pt;font-weight:700;padding:1mm .8mm;text-align:center;vertical-align:middle}
  th.cod{width:12mm}
  td{border-bottom:.3mm solid #000;height:6mm;padding:0 1mm;vertical-align:bottom;white-space:nowrap;text-align:center;font-weight:700}
  td.cod{text-align:left}
  td.nome{text-align:left;font-weight:400;overflow:hidden;text-overflow:ellipsis;font-size:7pt}
  .pe{margin-top:3mm;font-size:6.5pt;color:#555}
${p.css}
</style></head><body>
${p.logo.definicao}<div class="topo"><span class="logo">${p.logo.uso}</span><span class="titulo">${esc(p.titulo)} ${p.ano}</span></div>
<table><thead>${p.cabecalho}</thead><tbody>${p.corpo}</tbody></table>
<p class="pe">${p.pe}</p>
</body></html>`;
}

const empresas = (n: number) => n + (n === 1 ? ' empresa' : ' empresas');

/** O protocolo de extratos, A4 em pé. logo: a da Nilma (colorida, para o fundo branco): o desenho e o uso */
export function htmlDoProtocoloDeExtratos(p: { ano: number; linhas: readonly LinhaDoAno[]; logo: { definicao: string; uso: string } }): string {
  const cabecalho = `<tr><th class="cod">COD.</th><th class="nome">RAZÃO SOCIAL</th>${MESES_DO_PROTOCOLO.map(m => `<th>${m}</th>`).join('')}</tr>`;
  const corpo = p.linhas.map(l => `<tr><td class="cod">${codigo5(l.codigo)}</td><td class="nome">${esc(l.nome)}</td>${l.meses.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
  return documento({ titulo: 'Protocolo de Extratos', ano: p.ano, deitado: false, logo: p.logo, cabecalho, corpo,
    css: '  th.nome{width:66mm}',
    pe: empresas(p.linhas.length) + '. OK = o extrato do mês chegou (marcado na Pendências, pelo e-mail ou pela pasta do Drive); S/M = sem movimento; - = a empresa não manda extrato. Em branco: para preencher à mão.' });
}

/** O protocolo da REINF, A4 deitado: duas casas por mês (Fiscal e DP). */
export function htmlDoProtocoloDaReinf(p: { ano: number; linhas: readonly LinhaDaReinf[]; logo: { definicao: string; uso: string } }): string {
  const cabecalho = `<tr><th class="cod" rowspan="2">COD.</th><th class="nome" rowspan="2">RAZÃO SOCIAL</th>${MESES_DO_PROTOCOLO.map(m => `<th colspan="2">${m}</th>`).join('')}</tr>`
    + `<tr>${MESES_DO_PROTOCOLO.map(() => '<th class="lado">FISCAL</th><th class="lado">DP</th>').join('')}</tr>`;
  const corpo = p.linhas.map(l => `<tr><td class="cod">${codigo5(l.codigo)}</td><td class="nome">${esc(l.nome)}</td>${l.meses.map(([f, d]) => `<td>${esc(f)}</td><td class="dp">${esc(d)}</td>`).join('')}</tr>`).join('');
  return documento({ titulo: 'Protocolo REINF', ano: p.ano, deitado: true, logo: p.logo, cabecalho, corpo,
    css: '  th.nome{width:62mm}\n  th.lado{font-size:5pt;padding:.5mm 0}\n  td.dp{border-right:.3mm solid #000}',
    pe: empresas(p.linhas.length) + '. E = a REINF do mês transmitida pelo Fiscal; P = feita pelo DP; - = a empresa não tem a REINF daquele lado. Em branco: para preencher à mão.' });
}
