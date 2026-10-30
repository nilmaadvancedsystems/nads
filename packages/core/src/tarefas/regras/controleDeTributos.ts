// O controle de tributos do mês no Fiscal (27/10/2026: "vamos implementar essa planilha de controle como modulo do
// fiscal"; o modelo são as folhas do Protocolo de Entrega de Tributos preenchidas à mão, a do Simples Nacional e a do
// Lucro Presumido): uma linha por empresa do grupo com o valor de cada tributo, a data, as conferências (S, D e R no
// Simples; DCTF, SPC, SPI, SPR e DAPI no Presumido) e como a guia foi entregue; no fim, as observações e a retificação.
// O que o Entregas já entregou na competência vem como sugestão (o mesmo cálculo do protocolo impresso).
import { diaEmBrasilia, numeroDigitado } from '../../formatos';
import { competenciaParaEtiqueta } from './etiquetasDaFolha';
import { linhasDoProtocolo, type ColunaDoProtocolo, type EmpresaDoProtocolo, type GrupoDoProtocolo, type GuiaEntregue } from './protocoloDeTributos';

export type GrupoDoControleId = 'sn' | 'lp';
export interface GrupoDoControle {
  id: GrupoDoControleId;
  rotulo: string;
  selo: string;
  /** os regimes do Cadastro do nads que caem no grupo */
  regimes: readonly string[];
  colunas: readonly ColunaDoProtocolo[];
  /** as conferências (as coluninhas marcadas com OK ou —) */
  marcas: readonly { id: string; rotulo: string; dica: string }[];
}

const PARCELAMENTO: ColunaDoProtocolo = { id: 'parc', rotulo: 'Parcelamento', tipos: [/^PARC/] };
export const GRUPOS_DO_CONTROLE: readonly GrupoDoControle[] = [
  { id: 'sn', rotulo: 'Simples Nacional', selo: 'SIMPLES NACIONAL', regimes: ['Simples'], colunas: [
    { id: 'das', rotulo: 'DAS', tipos: [/^DAS$/] },
    { id: 'icms-ant', rotulo: 'ICMS antec. com./ind.', tipos: [/^ICMS (REQ\.? )?ANTEC/] },
    { id: 'icms-arroz', rotulo: 'ICMS antec. arroz' },
    { id: 'icms-dif', rotulo: 'ICMS dif. alíq. uso/cons.', tipos: [/^ICMS DIF/] },
    { id: 'icms-dif-ativo', rotulo: 'ICMS dif. alíq. ativo' },
    { id: 'st-ent', rotulo: 'ICMS-ST entrada', tipos: [/^ICMS ST$/, /^ICMS-ST$/] },
    { id: 'st-sai', rotulo: 'ICMS-ST saída' },
    PARCELAMENTO,
  ], marcas: [
    { id: 's', rotulo: 'S', dica: 'S' }, { id: 'd', rotulo: 'D', dica: 'D' }, { id: 'r', rotulo: 'R', dica: 'R' },
  ] },
  { id: 'lp', rotulo: 'Lucro Presumido', selo: 'LUCRO PRESUMIDO', regimes: ['Presumido', 'Real'], colunas: [
    { id: 'pis', rotulo: 'PIS', tipos: [/^PIS/] },
    { id: 'cofins', rotulo: 'COFINS', tipos: [/^COFINS/] },
    { id: 'irpj', rotulo: 'IRPJ', tipos: [/^IRPJ/] },
    { id: 'csll', rotulo: 'CSLL', tipos: [/^CSLL/] },
    { id: 'icms', rotulo: 'ICMS', tipos: [/^DAE$/, /^ICMS$/] },
    { id: 'iss', rotulo: 'ISS', tipos: [/^ISS/] },
    PARCELAMENTO,
  ], marcas: [
    { id: 'dctf', rotulo: 'DCTF', dica: 'DCTF' }, { id: 'spc', rotulo: 'SPC', dica: 'SPED Contribuições' },
    { id: 'spi', rotulo: 'SPI', dica: 'SPI' }, { id: 'spr', rotulo: 'SPR', dica: 'SPR' }, { id: 'dapi', rotulo: 'DAPI', dica: 'DAPI' },
  ] },
];
export const grupoDoControle = (id: string) => GRUPOS_DO_CONTROLE.find(g => g.id === id) || GRUPOS_DO_CONTROLE[0];

/** A conferência: feita (OK), não se aplica (—) ou em branco */
export type MarcaDoControle = '' | 'ok' | 'na';
export const PROXIMA_MARCA: Record<MarcaDoControle, MarcaDoControle> = { '': 'ok', ok: 'na', na: '' };
/** Como a guia foi entregue ao cliente (na folha: "imp", "zap", "e-mail" ou —) */
export type EntregaDoControle = '' | 'impresso' | 'zap' | 'email' | 'nao';
export const ENTREGAS_DO_CONTROLE: readonly { valor: EntregaDoControle; rotulo: string }[] = [
  { valor: '', rotulo: 'Falta' }, { valor: 'impresso', rotulo: 'Impresso' }, { valor: 'zap', rotulo: 'WhatsApp' },
  { valor: 'email', rotulo: 'E-mail' }, { valor: 'nao', rotulo: 'Não se aplica' },
];
const ROTULO_NA_FOLHA: Record<EntregaDoControle, string> = { '': '', impresso: 'imp.', zap: 'zap', email: 'e-mail', nao: '—' };

/** Uma linha guardada (controleTributos/{competência}_{código}) */
export interface LinhaDoControle {
  competencia: string;
  codigo: number;
  grupo: GrupoDoControleId;
  /** o texto de cada coluna, como a pessoa escreveu (o valor, "—" ou "0") */
  valores: Record<string, string>;
  /** a data da entrega (AAAA-MM-DD) */
  data: string;
  marcas: Record<string, MarcaDoControle>;
  entregue: EntregaDoControle;
  atualizadoEm?: string;
  atualizadoPor?: string;
}
export const idDaLinhaDoControle = (competencia: string, codigo: number) => competencia + '_' + codigo;
export const linhaEmBranco = (competencia: string, codigo: number, grupo: GrupoDoControleId): LinhaDoControle =>
  ({ competencia, codigo, grupo, valores: {}, data: '', marcas: {}, entregue: '' });

/** Uma retificação (o quadro do fim da folha): a empresa, a referência, os valores, as conferências e a entrega */
export interface RetificacaoDoControle { codigo: number | null; referencia: string; valores: Record<string, string>; marcas: Record<string, MarcaDoControle>; entregue: EntregaDoControle }
/** O fim da folha do grupo no mês (controleTributosFolha/{competência}_{grupo}) */
export interface FolhaDoControle { observacoes: string[]; retificacoes: RetificacaoDoControle[] }
export const idDaFolhaDoControle = (competencia: string, grupo: GrupoDoControleId) => competencia + '_' + grupo;
export const MAX_OBSERVACOES = 30;
export const MAX_RETIFICACOES = 30;

/**
 * O valor como fica na tela: o número em reais (1234,5 → 1.234,50); "-", "—" e "0" ficam como traço e zero; o resto
 * (uma anotação curta), como foi escrito.
 */
export function valorDoControle(texto: string): string {
  const t = texto.trim();
  if (!t) return '';
  if (/^[-–—]+$/.test(t)) return '—';
  if (/^[0Øø]$/.test(t)) return '0';
  const limpo = t.replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+\.\d{1,2}$/.test(limpo)) return t.slice(0, 30);
  const n = numeroDigitado(limpo);
  return n != null ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t.slice(0, 30);
}
/** O número do texto (para os totais): "1.234,50" → 1234.5; traço, zero e anotação → 0 */
export function numeroDoControle(texto: string): number {
  const t = (texto || '').trim();
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return 0;
  return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
}

/** As sugestões do Entregas por empresa: o valor de cada coluna e a data da última entrega (AAAA-MM-DD) */
export function sugestoesDoEntregas(grupo: GrupoDoControle, empresas: readonly EmpresaDoProtocolo[], guias: readonly GuiaEntregue[]): Map<number, { valores: Record<string, string>; data: string; email: boolean }> {
  const comoProtocolo: GrupoDoProtocolo = { id: grupo.id, rotulo: grupo.rotulo, selo: grupo.selo, regimes: grupo.regimes, colunas: grupo.colunas };
  const ultima = new Map<number, string>();
  for (const g of guias) if (g.em && g.em > (ultima.get(g.codigo) || '')) ultima.set(g.codigo, g.em);
  const r = new Map<number, { valores: Record<string, string>; data: string; email: boolean }>();
  for (const l of linhasDoProtocolo(comoProtocolo, empresas, guias, true)) {
    const valores = Object.fromEntries(Object.entries(l.valores).filter(([, v]) => v !== '✓'));
    if (!Object.keys(valores).length && !l.data) continue;
    // o dia da última entrega em Brasília (o confirmadoEm é UTC)
    r.set(l.codigo, { valores, data: l.data ? diaEmBrasilia(ultima.get(l.codigo) || '') : '', email: l.email === 'Sim' });
  }
  return r;
}

/** Junta a sugestão nos campos em branco (o que a pessoa escreveu nunca é trocado) */
export function preencherComSugestao(l: LinhaDoControle, s: { valores: Record<string, string>; data: string; email: boolean } | undefined): LinhaDoControle {
  if (!s) return l;
  const valores = { ...l.valores };
  for (const [k, v] of Object.entries(s.valores)) if (!valores[k]?.trim()) valores[k] = v;
  return { ...l, valores, data: l.data || s.data, entregue: l.entregue || (s.email ? 'email' : '') };
}

/** Em que pé a linha está: entregue (com a entrega escolhida), começada (algo escrito) ou em branco */
export function situacaoDaLinha(l: LinhaDoControle | undefined): 'entregue' | 'comecada' | 'branco' {
  if (!l) return 'branco';
  if (l.entregue) return 'entregue';
  const algo = Object.values(l.valores).some(v => v.trim()) || !!l.data || Object.values(l.marcas).some(Boolean);
  return algo ? 'comecada' : 'branco';
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const dataCurta = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4) : '');
const marcaNaFolha = (m: MarcaDoControle | undefined) => (m === 'ok' ? 'OK' : m === 'na' ? '—' : '');

/** A folha preenchida para imprimir (A4 deitado, no desenho do protocolo de papel) */
export function htmlDoControle(p: {
  competencia: string; grupo: GrupoDoControle; empresas: readonly EmpresaDoProtocolo[]; linhas: ReadonlyMap<number, LinhaDoControle>;
  folha: FolhaDoControle; logo: { definicao: string; uso: string };
}): string {
  const g = p.grupo;
  const ref = competenciaParaEtiqueta(p.competencia.trim());
  const cab = `<tr><th class="cod">COD.</th><th class="nome">RAZÃO SOCIAL</th>${g.colunas.map(c => `<th>${esc(c.rotulo.toUpperCase())}</th>`).join('')}<th class="data">DATA</th>${g.marcas.map(m => `<th class="mk">${esc(m.rotulo)}</th>`).join('')}<th class="mail">ENTREGUE</th></tr>`;
  const corpo = [...p.empresas].sort((a, b) => a.codigo - b.codigo).map(e => {
    const l = p.linhas.get(e.codigo);
    return `<tr><td class="cod">${String(e.codigo).padStart(5, '0')}</td><td class="nome">${esc(e.nome)}</td>${g.colunas.map(c => `<td class="val">${esc(l?.valores[c.id] || '')}</td>`).join('')}<td class="data">${esc(dataCurta(l?.data || '')) || '&nbsp;&nbsp;/&nbsp;&nbsp;'}</td>${g.marcas.map(m => `<td class="mk">${marcaNaFolha(l?.marcas[m.id])}</td>`).join('')}<td class="mail">${esc(ROTULO_NA_FOLHA[l?.entregue || ''])}</td></tr>`;
  }).join('');
  const obs = p.folha.observacoes.filter(o => o.trim());
  const linhasObs = [...obs.map(o => `<tr><td>${esc(o)}</td></tr>`), ...Array(Math.max(0, 4 - obs.length)).fill('<tr><td></td></tr>')].join('');
  const rets = p.folha.retificacoes;
  const linhaRet = (r: RetificacaoDoControle | null) => `<tr><td class="cod">${r?.codigo != null ? String(r.codigo).padStart(5, '0') : ''}</td><td>${esc(r?.referencia || '')}</td>${g.colunas.map(c => `<td class="val">${esc(r?.valores[c.id] || '')}</td>`).join('')}${g.marcas.map(m => `<td class="mk">${marcaNaFolha(r?.marcas[m.id])}</td>`).join('')}<td class="mail">${esc(ROTULO_NA_FOLHA[r?.entregue || ''])}</td></tr>`;
  const corpoRet = [...rets.map(linhaRet), ...Array(Math.max(0, 4 - rets.length)).fill(linhaRet(null))].join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Protocolo de Entrega de Tributos ${esc(ref)} — ${esc(g.rotulo)}</title>
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
  th.nome{width:62mm}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th{background:#000;color:#fff;font-size:6.5pt;font-weight:700;padding:1mm .8mm;text-align:center;vertical-align:middle}
  td{border-bottom:.3mm solid #000;height:6mm;padding:0 1mm;vertical-align:bottom;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  td.cod{font-weight:700}
  td.nome{font-size:7pt}
  td.val{text-align:right}
  td.data,th.data{width:16mm;text-align:center}
  th.mk{width:9mm}
  td.mk,td.mail{text-align:center}
  th.mail{width:16mm}
  section{margin-top:5mm;break-inside:avoid;page-break-inside:avoid}
  section h2{margin:0 0 1.5mm;font-size:10pt;font-weight:700;letter-spacing:.5pt}
  section td{height:7mm}
  th.ref{width:30mm}
</style></head><body>
${p.logo.definicao}<div class="topo"><span class="logo">${p.logo.uso}</span><span class="selo">${esc(g.selo)}</span><span class="titulo"><b>Protocolo de Entrega de Tributos</b><span>Ref: ${esc(ref)}</span></span></div>
<table><thead>${cab}</thead><tbody>${corpo}</tbody></table>
<section><h2>OBSERVAÇÕES</h2><table><thead><tr><th>DESCRIÇÃO</th></tr></thead><tbody>${linhasObs}</tbody></table></section>
<section><h2>RETIFICAÇÃO</h2><table><thead><tr><th class="cod">COD.</th><th class="ref">REFERÊNCIA</th>${g.colunas.map(c => `<th>${esc(c.rotulo.toUpperCase())}</th>`).join('')}${g.marcas.map(m => `<th class="mk">${esc(m.rotulo)}</th>`).join('')}<th class="mail">ENTREGUE</th></tr></thead><tbody>${corpoRet}</tbody></table></section>
</body></html>`;
}
