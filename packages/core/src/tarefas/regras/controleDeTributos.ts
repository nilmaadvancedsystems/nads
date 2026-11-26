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
    // a reforma tributária (03/11/2026: "adicione uma coluna de ibs e uma de cbs")
    { id: 'ibs', rotulo: 'IBS', tipos: [/^IBS/] },
    { id: 'cbs', rotulo: 'CBS', tipos: [/^CBS/] },
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
// o eContador do Alterdata (04/11/2026: "preciso que coloque a opção econtador do alterdata como envio e tambem preciso que preencha dae e icms na planilha la, enviei 2 dae via impresso e não preencheu"): as guias postadas no portal do cliente
export type EntregaDoControle = '' | 'impresso' | 'zap' | 'email' | 'econtador' | 'scireport' | 'nao';
export const ENTREGAS_DO_CONTROLE: readonly { valor: EntregaDoControle; rotulo: string }[] = [
  { valor: '', rotulo: 'Falta' }, { valor: 'impresso', rotulo: 'Impresso' }, { valor: 'zap', rotulo: 'WhatsApp' },
  { valor: 'email', rotulo: 'E-mail' }, { valor: 'econtador', rotulo: 'eContador' }, { valor: 'scireport', rotulo: 'SCI Report' }, { valor: 'nao', rotulo: 'Não se aplica' },
];
const ROTULO_NA_FOLHA: Record<EntregaDoControle, string> = { '': '', impresso: 'imp.', zap: 'zap', email: 'e-mail', econtador: 'eCont.', scireport: 'SCI', nao: '—' };

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
/**
 * A empresa retificada no mês (10/11/2026: "uma opção de retificação como um liga e desliga"; uma marca por empresa na
 * competência). Mora nas marcas da linha, então o banco e as regras não mudam; não conta como andamento da empresa.
 */
export const MARCA_RETIFICADA = 'retificada';
export const linhaRetificada = (l: LinhaDoControle | undefined) => l?.marcas[MARCA_RETIFICADA] === 'ok';
export function alternarRetificacaoDaLinha(l: LinhaDoControle): LinhaDoControle {
  const marcas = { ...l.marcas };
  if (marcas[MARCA_RETIFICADA]) delete marcas[MARCA_RETIFICADA]; else marcas[MARCA_RETIFICADA] = 'ok';
  return { ...l, marcas };
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
 * O quadro de retificação do mês (16/11/2026: "um botão parecido com o do 13º" que troca a tabela do Relatório pela da
 * retificação; escolhido o quadro do protocolo): uma linha por retificação — as guardadas na folha do grupo e as empresas
 * com o Retif. ligado que ainda não têm uma guardada (o código e a referência do mês; o resto em branco, até alguém
 * escrever: aí ela vai para a folha). Em ordem de código e, na mesma empresa, de referência, para a linha não pular de
 * lugar quando passa a ser guardada.
 */
export interface LinhaDaRetificacao {
  /** a posição na folha; null = a empresa ligada que ainda não foi guardada */
  indice: number | null;
  retificacao: RetificacaoDoControle;
  /** a empresa está com o Retif. ligado no Relatório */
  ligada: boolean;
}
export const retificacaoEmBranco = (codigo: number | null, referencia: string): RetificacaoDoControle => ({ codigo, referencia, valores: {}, marcas: {}, entregue: '' });
const mesDaReferencia = (r: string) => { const m = /^(\d{2})\/(\d{4})$/.exec(r); return m ? m[2] + '-' + m[1] : r; };

export function quadroDeRetificacao(p: {
  competencia: string; empresas: readonly EmpresaDoProtocolo[]; linhas: ReadonlyMap<number, LinhaDoControle>; folha: FolhaDoControle;
}): LinhaDaRetificacao[] {
  const ligadas = new Set(p.empresas.filter(e => linhaRetificada(p.linhas.get(e.codigo))).map(e => e.codigo));
  const guardadas = new Set(p.folha.retificacoes.map(r => r.codigo));
  const ref = competenciaParaEtiqueta(p.competencia.trim());
  const todas: LinhaDaRetificacao[] = [
    ...p.folha.retificacoes.map((retificacao, indice) => ({ indice, retificacao, ligada: retificacao.codigo != null && ligadas.has(retificacao.codigo) })),
    ...[...ligadas].filter(c => !guardadas.has(c)).map(c => ({ indice: null, retificacao: retificacaoEmBranco(c, ref), ligada: true })),
  ];
  const cod = (l: LinhaDaRetificacao) => l.retificacao.codigo ?? Number.MAX_SAFE_INTEGER;
  return todas.sort((a, b) => cod(a) - cod(b) || mesDaReferencia(a.retificacao.referencia).localeCompare(mesDaReferencia(b.retificacao.referencia)) || (a.indice ?? 1e9) - (b.indice ?? 1e9));
}

/** A referência (o mês retificado) como fica: "9/2026", "092026" ou "2026-09" → "09/2026"; vazio fica vazio; o resto não vale (null) */
export function referenciaDaRetificacao(texto: string): string | null {
  const t = texto.trim();
  if (!t) return '';
  const iso = /^(\d{4})-(\d{2})$/.exec(t);
  const br = /^(\d{1,2})\s*[/.-]?\s*(\d{4})$/.exec(t);
  const [mes, ano] = iso ? [Number(iso[2]), iso[1]] : br ? [Number(br[1]), br[2]] : [0, ''];
  return mes >= 1 && mes <= 12 ? String(mes).padStart(2, '0') + '/' + ano : null;
}

/** Cabe mais uma retificação na folha do grupo */
export const cabeRetificacao = (folha: FolhaDoControle) => folha.retificacoes.length < MAX_RETIFICACOES;

/** A linha do quadro mudada: a guardada é trocada no lugar; a da empresa ligada passa a ser guardada (no fim da folha) */
export function guardarRetificacao(folha: FolhaDoControle, linha: Pick<LinhaDaRetificacao, 'indice'>, nova: RetificacaoDoControle): FolhaDoControle {
  if (linha.indice != null && linha.indice < folha.retificacoes.length) {
    return { ...folha, retificacoes: folha.retificacoes.map((r, i) => (i === linha.indice ? nova : r)) };
  }
  return cabeRetificacao(folha) ? { ...folha, retificacoes: [...folha.retificacoes, nova] } : folha;
}

/** "+ Retificação": a empresa e o mês retificado; a mesma empresa com a mesma referência não entra duas vezes */
export function adicionarRetificacao(folha: FolhaDoControle, codigo: number, referencia: string): FolhaDoControle {
  if (folha.retificacoes.some(r => r.codigo === codigo && r.referencia === referencia)) return folha;
  return guardarRetificacao(folha, { indice: null }, retificacaoEmBranco(codigo, referencia));
}

/**
 * Tirar a linha do quadro: a guardada sai da folha; a empresa ligada sem outra guardada também se desliga (senão volta
 * em branco). desligar: o código da empresa a desligar no Relatório; folha: null quando a folha não muda.
 */
export function removerRetificacao(folha: FolhaDoControle, linha: LinhaDaRetificacao): { folha: FolhaDoControle | null; desligar: number | null } {
  const codigo = linha.retificacao.codigo;
  if (linha.indice == null) return { folha: null, desligar: linha.ligada ? codigo : null };
  const retificacoes = folha.retificacoes.filter((_, i) => i !== linha.indice);
  const sobra = retificacoes.some(r => r.codigo === codigo);
  return { folha: { ...folha, retificacoes }, desligar: linha.ligada && !sobra ? codigo : null };
}

/** Em que pé a retificação está: entregue, começada (algo escrito ou conferido) ou em branco */
export function situacaoDaRetificacao(r: RetificacaoDoControle): 'entregue' | 'comecada' | 'branco' {
  if (r.entregue) return 'entregue';
  return Object.values(r.valores).some(v => v.trim()) || Object.values(r.marcas).some(Boolean) ? 'comecada' : 'branco';
}

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

/** A competência n meses depois ('2026-09', 1 → '2026-10'; -1 → '2026-08') */
export function somarMesesDaCompetencia(competencia: string, n: number): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const d = new Date(ano, mes - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
/**
 * De que mês é a apuração de uma guia entregue (03/11/2026: "é sempre apurado um mês depois, então se é entregue no mês 10
 * é referente ao mês 9"). O Entregas grava a competência do mês em que a entrega foi registrada, a não ser quando o PDF da
 * guia diz o período de apuração. Entregue no mesmo mês da competência gravada, ela é a do mês da entrega, e a apuração é
 * a do mês anterior; entregue depois, a competência gravada já é a da apuração.
 */
export function competenciaDaApuracao(competencia: string, confirmadoEm: string | null | undefined): string {
  const mesDaEntrega = confirmadoEm ? diaEmBrasilia(confirmadoEm).slice(0, 7) : '';
  return mesDaEntrega && mesDaEntrega <= competencia ? somarMesesDaCompetencia(competencia, -1) : competencia;
}

/** As sugestões do Entregas por empresa: o valor de cada coluna e a data da última entrega (AAAA-MM-DD) */
export function sugestoesDoEntregas(grupo: GrupoDoControle, empresas: readonly EmpresaDoProtocolo[], guias: readonly GuiaEntregue[]): Map<number, { valores: Record<string, string>; data: string; email: boolean }> {
  const comoProtocolo: GrupoDoProtocolo = { id: grupo.id, rotulo: grupo.rotulo, selo: grupo.selo, regimes: grupo.regimes, colunas: grupo.colunas };
  const r = new Map<number, { valores: Record<string, string>; data: string; email: boolean }>();
  for (const l of linhasDoProtocolo(comoProtocolo, empresas, guias, true)) {
    const valores = Object.fromEntries(Object.entries(l.valores).filter(([, v]) => v !== '✓'));
    if (!Object.keys(valores).length && !l.data) continue;
    // o dia da última entrega em Brasília (o confirmadoEm é UTC), só das guias do grupo: a guia de outro departamento (o
    // FGTS do DP) entregue depois não muda a data dos tributos
    r.set(l.codigo, { valores, data: l.em ? diaEmBrasilia(l.em) : '', email: l.email === 'Sim' });
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

/**
 * A coluna do controle de uma guia lida pelo robô (03/11/2026: "ao enviar o arquivo ele lê e ja coloca os valores na
 * tabela"): o DAS no Simples; no Presumido, a DARF pelo tributo do código da receita (PIS, COFINS, IRPJ, CSLL), o DAE do
 * ICMS e o DAM do ISS. O que não tem coluna clara no grupo fica sem coluna ('': vai no e-mail e não preenche valor): a DARF
 * do IRRF ou do INSS, o ICMS no Simples (pode ser antecipação, ST ou diferencial), o DAS no Presumido e o parcelamento (o
 * período da parcela não é o da apuração). O mesmo do robô (robo/lote-fiscal.js, colunaDaGuia).
 */
export function colunaDaGuia(grupo: GrupoDoControleId, tipo: string, tributo: string, parcelamento = false, receita = ''): string {
  if (parcelamento) return '';
  const t = (tributo || '').toUpperCase();
  const coluna = tipo === 'DAS' ? 'das'
    : tipo === 'DARF' && ['PIS', 'COFINS', 'IRPJ', 'CSLL'].includes(t) ? t.toLowerCase()
    : tipo === 'DAE' && t === 'ICMS' ? (grupo === 'sn' ? colunaDoIcmsDoSimples(receita) : 'icms')
    : tipo === 'DAM' && t === 'ISS' ? 'iss' : '';
  return coluna && grupoDoControle(grupo).colunas.some(c => c.id === coluna) ? coluna : '';
}
/**
 * A coluna do ICMS do Simples pela receita escrita no DAE (04/11/2026: "preciso que coloque a opção econtador do alterdata como envio e tambem preciso que preencha dae e icms na planilha la, enviei 2 dae via impresso e não preencheu"): no Simples o ICMS se divide em antecipação,
 * diferencial de alíquota e ST, e a receita diz qual é ("0327-7 ICMS REC.ANTECIPADO-INDUSTRIA" → ICMS antec.; "0317-8 ICMS
 * DIFERENCA DE ALIQUOTA" → ICMS dif. alíq.). Sem receita reconhecida, '' (a pessoa escolhe a coluna na revisão).
 */
export function colunaDoIcmsDoSimples(receita: string): string {
  const r = (receita || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (!r) return '';
  if (/ARROZ/.test(r)) return 'icms-arroz';
  if (/DIFERENCA DE ALIQ|DIF\.? ?(DE )?ALIQ|DIFAL/.test(r)) return /ATIVO|IMOBILIZ/.test(r) ? 'icms-dif-ativo' : 'icms-dif';
  if (/ANTECIPA/.test(r)) return 'icms-ant';
  if (/SUBST|\bS\.? ?T\b/.test(r)) return /SAIDA/.test(r) ? 'st-sai' : 'st-ent';
  return '';
}
/**
 * O grupo do Relatório pelo regime da empresa (26/11/2026, no Enviar guias: "o robo vai identificar pela empres e vai trocar
 * o layout de envio variando isso"): o Simples no Simples Nacional; o Presumido e o Real no Lucro Presumido. Aceita o nome do
 * Cadastro do nads ("Simples", "Presumido") e o do arquivador ("SIMPLES NACIONAL", "LUCRO PRESUMIDO"). Fora disso (MEI,
 * isenta, sem regime), null: vale o grupo do relatório onde o lote foi aberto. O mesmo do robô (robo/lote-fiscal.js).
 */
export function grupoDoRegime(regime: string | null | undefined): GrupoDoControleId | null {
  const k = (regime || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/^LUCRO\s+/, '').replace(/\s+NACIONAL$/, '').trim();
  return GRUPOS_DO_CONTROLE.find(g => g.regimes.some(r => r.toUpperCase() === k))?.id ?? null;
}
/** O grupo da guia: o do regime da empresa; sem ele, o do relatório onde o lote foi aberto */
export const grupoDaGuia = (regime: string | null | undefined, grupoDoLote: GrupoDoControleId): GrupoDoControleId => grupoDoRegime(regime) ?? grupoDoLote;

/**
 * O tipo de guia de cada coluna, por grupo (a pasta do Fiscal onde a guia escolhida à mão vai no Drive): no Simples o DAS
 * (e o DAS do parcelamento) e o DAE dos ICMS; no Presumido a DARF dos federais (e a do parcelamento), o DAE do ICMS e o DAM
 * do ISS. O IBS e a CBS ainda não têm pasta na árvore do Fiscal: ficam sem tipo, como a guia fora das colunas.
 */
const TIPO_DA_COLUNA: Readonly<Record<GrupoDoControleId, Readonly<Record<string, string>>>> = {
  sn: { das: 'DAS', 'icms-ant': 'DAE', 'icms-arroz': 'DAE', 'icms-dif': 'DAE', 'icms-dif-ativo': 'DAE', 'st-ent': 'DAE', 'st-sai': 'DAE', parc: 'DAS' },
  lp: { pis: 'DARF', cofins: 'DARF', irpj: 'DARF', csll: 'DARF', icms: 'DAE', iss: 'DAM', parc: 'DARF' },
};
export const tipoDaColuna = (grupo: GrupoDoControleId, coluna: string): string => TIPO_DA_COLUNA[grupo][coluna] || '';

/**
 * Os tipos de guia que a pessoa escolhe no Enviar guias, os do grupo da empresa (26/11/2026: no Presumido "pis cofins IRPJ
 * csll ICMS iss ibs,cbs", e o parcelamento; no Simples, as colunas do Simples): cada um diz a coluna do Relatório e a pasta.
 */
export interface TipoDeGuia { coluna: string; rotulo: string; tipo: string }
export const tiposDeGuiaDoGrupo = (grupo: GrupoDoControleId): TipoDeGuia[] =>
  grupoDoControle(grupo).colunas.map(c => ({ coluna: c.id, rotulo: c.rotulo, tipo: tipoDaColuna(grupo, c.id) }));

/**
 * O tipo (a pasta) que vale da guia depois de uma escolha na revisão. Escolhido um tipo no menu (coluna, '' = sem coluna):
 * o da coluna no grupo da empresa; sem pasta para ela (sem coluna, IBS, CBS), o que o leitor achou; senão OUTRO (sem pasta
 * no Drive, só vai no envio). Mudou só o cliente ou o mês (coluna undefined): o que já estava escolhido, senão o lido.
 * Antes, a guia sem tipo lido que ganhava o cliente primeiro ficava OUTRO mesmo depois de escolher a coluna.
 */
export function tipoDaEscolha(p: { grupo: GrupoDoControleId; coluna?: string; lido?: string; anterior?: string }): string {
  if (p.coluna === undefined) return p.anterior || p.lido || 'OUTRO';
  return tipoDaColuna(p.grupo, p.coluna) || p.lido || 'OUTRO';
}

/** Em que pé a linha está: entregue (com a entrega escolhida), começada (algo escrito) ou em branco */
export function situacaoDaLinha(l: LinhaDoControle | undefined): 'entregue' | 'comecada' | 'branco' {
  if (!l) return 'branco';
  if (l.entregue) return 'entregue';
  const algo = Object.values(l.valores).some(v => v.trim()) || !!l.data || Object.entries(l.marcas).some(([m, v]) => m !== MARCA_RETIFICADA && !!v);
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
  // no quadro: o mesmo da tela (as que a folha guardou e as empresas ligadas no Relatório que ainda não têm uma guardada)
  const rets = quadroDeRetificacao(p).map(l => l.retificacao);
  const nomeDaRet = (r: RetificacaoDoControle | null) => p.empresas.find(e => e.codigo === r?.codigo)?.nome || '';
  const linhaRet = (r: RetificacaoDoControle | null) => `<tr><td class="cod">${r?.codigo != null ? String(r.codigo).padStart(5, '0') : ''}</td><td class="nome">${esc(nomeDaRet(r))}</td><td class="ref">${esc(r?.referencia || '')}</td>${g.colunas.map(c => `<td class="val">${esc(r?.valores[c.id] || '')}</td>`).join('')}${g.marcas.map(m => `<td class="mk">${marcaNaFolha(r?.marcas[m.id])}</td>`).join('')}<td class="mail">${esc(ROTULO_NA_FOLHA[r?.entregue || ''])}</td></tr>`;
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
  th.ref{width:18mm}
  td.ref{text-align:center}
</style></head><body>
${p.logo.definicao}<div class="topo"><span class="logo">${p.logo.uso}</span><span class="selo">${esc(g.selo)}</span><span class="titulo"><b>Protocolo de Entrega de Tributos</b><span>Ref: ${esc(ref)}</span></span></div>
<table><thead>${cab}</thead><tbody>${corpo}</tbody></table>
<section><h2>OBSERVAÇÕES</h2><table><thead><tr><th>DESCRIÇÃO</th></tr></thead><tbody>${linhasObs}</tbody></table></section>
<section><h2>RETIFICAÇÃO</h2><table><thead><tr><th class="cod">COD.</th><th class="nome">RAZÃO SOCIAL</th><th class="ref">REFERÊNCIA</th>${g.colunas.map(c => `<th>${esc(c.rotulo.toUpperCase())}</th>`).join('')}${g.marcas.map(m => `<th class="mk">${esc(m.rotulo)}</th>`).join('')}<th class="mail">ENTREGUE</th></tr></thead><tbody>${corpoRet}</tbody></table></section>
</body></html>`;
}
