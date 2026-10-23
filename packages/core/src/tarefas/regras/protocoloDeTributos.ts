// O protocolo de entrega de tributos do mês (Heverton, 20/10/2026: "Relatório de empresa (Movimentação mensal)"; o
// modelo é a planilha "RELATORIO EMPRESA 2026", aba "Entrega de Tributos - SN"): a logo, o selo do regime e "Ref:
// MM/AAAA"; uma linha por empresa do grupo, com o código e a razão social, as colunas dos tributos e DATA, S, D, R e
// ENTREGUE E-MAIL para preencher à mão. O que o nads já sabe (as guias entregues pelo Entregas na competência: o valor de
// cada tributo, a data da entrega e se o comprovante foi por e-mail) já vem preenchido. A4 deitado; as linhas não se
// partem entre páginas e o cabeçalho da tabela se repete em cada página. No fim de todo protocolo, a Retificação
// (23/10/2026: "todo final de protocolo de controle de tributos precisa ter a parte de retificação"): o quadro para
// preencher à mão o que foi retificado (a empresa, o tributo, a competência, o valor de antes e o novo, o motivo, a data
// e o visto), sem se partir entre páginas.
import { competenciaParaEtiqueta } from './etiquetasDaFolha';

export interface ColunaDoProtocolo {
  id: string;
  rotulo: string;
  /** os tipos de documento do Entregas que caem nesta coluna (comparados sem acento, em maiúsculas) */
  tipos?: readonly RegExp[];
}

/** Os grupos (o regime do Cadastro do nads) e as colunas de tributos de cada um */
export interface GrupoDoProtocolo { id: string; rotulo: string; selo: string; regimes: readonly string[]; colunas: readonly ColunaDoProtocolo[] }

const PARCELAMENTO: ColunaDoProtocolo = { id: 'parc', rotulo: 'PARCELAMENTO', tipos: [/^PARC/] };
export const GRUPOS_DO_PROTOCOLO: readonly GrupoDoProtocolo[] = [
  { id: 'sn', rotulo: 'Simples Nacional', selo: 'SIMPLES NACIONAL', regimes: ['Simples'], colunas: [
    { id: 'das', rotulo: 'DAS', tipos: [/^DAS$/] },
    { id: 'icms-ant', rotulo: 'ICMS ANTEC.', tipos: [/^ICMS (REQ\.? )?ANTEC/] },
    { id: 'icms-dif', rotulo: 'ICMS DIF. ALIQ.', tipos: [/^ICMS DIF/] },
    { id: 'icms-dif-ativo', rotulo: 'ICMS DIF. ALIQ ATIVO' },
    // o ICMS ST do Entregas é um só: vai na entrada (o da saída é retido na nota, sem guia à parte)
    { id: 'st-ent', rotulo: 'ICMS-ST ENTRADA', tipos: [/^ICMS ST$/, /^ICMS-ST$/] },
    { id: 'st-sai', rotulo: 'ICMS-ST SAÍDA' },
    PARCELAMENTO,
  ] },
  { id: 'mei', rotulo: 'MEI', selo: 'MEI', regimes: ['MEI'], colunas: [
    { id: 'das', rotulo: 'DAS-MEI', tipos: [/^DAS/] },
    PARCELAMENTO,
  ] },
  { id: 'lp-lr', rotulo: 'Lucro Presumido e Real', selo: 'LUCRO PRESUMIDO E REAL', regimes: ['Presumido', 'Real'], colunas: [
    { id: 'darf', rotulo: 'DARF', tipos: [/^DARF$/] },
    { id: 'icms', rotulo: 'ICMS (DAE)', tipos: [/^DAE$/] },
    { id: 'icms-ant', rotulo: 'ICMS ANTEC.', tipos: [/^ICMS (REQ\.? )?ANTEC/] },
    { id: 'icms-dif', rotulo: 'ICMS DIF. ALIQ.', tipos: [/^ICMS DIF/] },
    { id: 'st-ent', rotulo: 'ICMS-ST', tipos: [/^ICMS ST$/, /^ICMS-ST$/] },
    PARCELAMENTO,
  ] },
];
/** quantas linhas em branco a Retificação tem no fim do protocolo */
export const LINHAS_DA_RETIFICACAO = 6;

export const grupoDoProtocolo = (id: string) => GRUPOS_DO_PROTOCOLO.find(g => g.id === id) || GRUPOS_DO_PROTOCOLO[0];

/** Uma guia entregue (do Entregas): os itens, a data e se o comprovante foi por e-mail */
export interface GuiaEntregue { codigo: number; itens: readonly { tipo: string; valor: number | null }[]; em: string | null; porEmail: boolean }
export interface EmpresaDoProtocolo { codigo: number; nome: string }

export interface LinhaDoProtocolo {
  codigo: number;
  nome: string;
  /** o valor (ou "✓" sem valor) por coluna */
  valores: Record<string, string>;
  /** dd/mm da última entrega */
  data: string;
  email: string;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** As linhas do protocolo: as empresas (pelo código) e, quando preencher, o que o Entregas entregou na competência */
export function linhasDoProtocolo(grupo: GrupoDoProtocolo, empresas: readonly EmpresaDoProtocolo[], guias: readonly GuiaEntregue[], preencher: boolean): LinhaDoProtocolo[] {
  const porCodigo = new Map<number, GuiaEntregue[]>();
  if (preencher) for (const g of guias) porCodigo.set(g.codigo, [...(porCodigo.get(g.codigo) || []), g]);
  return [...empresas].sort((a, b) => a.codigo - b.codigo).map(e => {
    const minhas = porCodigo.get(e.codigo) || [];
    const somas = new Map<string, { valor: number; sem: boolean }>();
    let ultima = '';
    let email = false;
    for (const g of minhas) {
      let usou = false;
      for (const it of g.itens) {
        const t = semAcento(it.tipo);
        const col = grupo.colunas.find(c => c.tipos?.some(r => r.test(t)));
        if (!col) continue;
        usou = true;
        const atual = somas.get(col.id) || { valor: 0, sem: false };
        if (typeof it.valor === 'number' && it.valor > 0) atual.valor += it.valor; else atual.sem = true;
        somas.set(col.id, atual);
      }
      if (usou && g.em && g.em > ultima) ultima = g.em;
      if (usou && g.porEmail) email = true;
    }
    const valores: Record<string, string> = {};
    for (const [id, s] of somas) valores[id] = s.valor > 0 ? brl(s.valor) : '✓';
    const data = ultima ? ultima.slice(8, 10) + '/' + ultima.slice(5, 7) : '';
    return { codigo: e.codigo, nome: e.nome, valores, data, email: email ? 'Sim' : '' };
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** O documento A4 deitado para imprimir. logo: a da Nilma (colorida, para o fundo branco): o desenho e o uso */
export function htmlDoProtocolo(p: { competencia: string; grupo: GrupoDoProtocolo; linhas: readonly LinhaDoProtocolo[]; logo: { definicao: string; uso: string } }): string {
  const ref = competenciaParaEtiqueta(p.competencia.trim());
  const cols = p.grupo.colunas;
  const cab = `<tr><th class="cod">COD.</th><th class="nome">RAZÃO SOCIAL</th>${cols.map(c => `<th>${esc(c.rotulo)}</th>`).join('')}<th class="data">DATA</th><th class="sdr">S</th><th class="sdr">D</th><th class="sdr">R</th><th class="mail">ENTREGUE E-MAIL</th></tr>`;
  const corpo = p.linhas.map(l => `<tr><td class="cod">${String(l.codigo).padStart(5, '0')}</td><td class="nome">${esc(l.nome)}</td>${cols.map(c => `<td class="val">${esc(l.valores[c.id] || '')}</td>`).join('')}<td class="data">${esc(l.data) || '&nbsp;&nbsp;/&nbsp;&nbsp;'}</td><td></td><td></td><td></td><td class="mail">${esc(l.email)}</td></tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Protocolo de Entrega de Tributos ${esc(ref)} — ${esc(p.grupo.rotulo)}</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  *{box-sizing:border-box}
  :root{color-scheme:light}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:"Century Gothic","Segoe UI",Arial,sans-serif;color:#000;font-size:8pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .topo{display:flex;align-items:center;gap:8mm;margin-bottom:3mm}
  .topo .logo svg{height:16mm;width:auto;display:block}
  .selo{flex:1;text-align:center;font-weight:700;font-size:18pt;letter-spacing:1pt;color:#2E7D32}
  .titulo{text-align:right}
  .titulo b{display:block;font-size:13pt}
  .titulo span{display:block;font-size:24pt;font-weight:700}
  table{width:100%;border-collapse:separate;border-spacing:1mm .6mm;table-layout:fixed}
  th.cod{width:12mm}
  th.nome{width:70mm}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th{background:#000;color:#fff;font-size:6.5pt;font-weight:700;padding:1mm .8mm;text-align:center;vertical-align:middle}
  td{border-bottom:.3mm solid #000;height:6mm;padding:0 1mm;vertical-align:bottom;white-space:nowrap}
  td.cod{font-weight:700}
  td.nome{overflow:hidden;text-overflow:ellipsis;font-size:7pt}
  td.val{text-align:right}
  td.data,th.data{width:16mm;text-align:center}
  th.sdr{width:6mm}
  td.mail{text-align:center}
  th.mail{width:16mm}
  .pe{margin-top:3mm;font-size:6.5pt;color:#555}
  .retificacao{margin-top:5mm;break-inside:avoid;page-break-inside:avoid}
  .retificacao h2{margin:0 0 1.5mm;font-size:10pt;font-weight:700;letter-spacing:.5pt}
  .retificacao td{height:7mm}
  .retificacao th.ret-cod{width:12mm}
  .retificacao th.ret-nome{width:52mm}
  .retificacao th.ret-trib{width:24mm}
  .retificacao th.ret-comp{width:18mm}
  .retificacao th.ret-valor{width:24mm}
  .retificacao th.ret-data{width:16mm}
  .retificacao th.ret-visto{width:20mm}
</style></head><body>
${p.logo.definicao}<div class="topo"><span class="logo">${p.logo.uso}</span><span class="selo">${esc(p.grupo.selo)}</span><span class="titulo"><b>Protocolo de Entrega de Tributos</b><span>Ref: ${esc(ref)}</span></span></div>
<table><thead>${cab}</thead><tbody>${corpo}</tbody></table>
<p class="pe">${p.linhas.length} ${p.linhas.length === 1 ? 'empresa' : 'empresas'}. Os valores e as datas preenchidos vêm das guias entregues pelo Entregas nesta competência; o resto é para preencher à mão.</p>
<section class="retificacao"><h2>RETIFICAÇÃO</h2>
<table><thead><tr><th class="ret-cod">COD.</th><th class="ret-nome">RAZÃO SOCIAL</th><th class="ret-trib">TRIBUTO</th><th class="ret-comp">COMPETÊNCIA</th><th class="ret-valor">VALOR ANTERIOR</th><th class="ret-valor">VALOR RETIFICADO</th><th>MOTIVO</th><th class="ret-data">DATA</th><th class="ret-visto">VISTO</th></tr></thead>
<tbody>${'<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="data">&nbsp;&nbsp;/&nbsp;&nbsp;</td><td></td></tr>'.repeat(LINHAS_DA_RETIFICACAO)}</tbody></table>
</section>
</body></html>`;
}
