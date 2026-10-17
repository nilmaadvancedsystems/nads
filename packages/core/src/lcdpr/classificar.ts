// A classificação do LCDPR (a mesma do lcdpr.html): a nota de compra vai para a conta da regra de NCM que responde pela
// maior parte do valor dela (o item principal manda, não o primeiro da lista); o CT-e é sempre frete (a categoria
// escolhida na Configuração geral); sem regra, o lançamento vai para REVISAR. Aqui também: o histórico pelo modelo, a
// categoria escolhida à mão, os grupos do que falta revisar, a busca e a regra nova sugerida depois de classificar à mão.
import type { Categoria, ConfigLcdpr, Lancamento, OrigemDaRegra, OrigemDoDocumento, RegraNcm } from './tipos';

export const soDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** CPF (11) ou CNPJ (14) com a máscara; o resto como veio. */
export function cpfCnpjFormatado(v: string): string {
  const d = soDigitos(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d;
}

/** O histórico pelo modelo: {{doc}}, {{fornecedor}} e {{cnpj}} (com a máscara). */
export function aplicarModelo(modelo: string, ctx: { documento: string; fornecedor: string; cnpj: string }): string {
  return String(modelo || '')
    .replaceAll('{{doc}}', ctx.documento || '')
    .replaceAll('{{fornecedor}}', ctx.fornecedor || '')
    .replaceAll('{{cnpj}}', cpfCnpjFormatado(ctx.cnpj));
}

/** O NCM com os zeros da frente que o Excel come (o 01022190 guardado como número vira 1022190). */
export function ncmCompleto(v: unknown): string {
  const s = String(v ?? '').trim();
  return /^\d+$/.test(s) ? s.padStart(8, '0') : s;
}

/** O nome da categoria com a mesma conta e o mesmo código de histórico ('' se nenhuma). */
export function categoriaDaConta(categorias: readonly Categoria[], conta: string, codHist: string): string {
  return categorias.find(c => String(c.conta) === String(conta) && String(c.codHist || '') === String(codHist || ''))?.nome || '';
}

interface Classificacao { conta: string; codHist: string; historico: string; origemRegra: OrigemDaRegra }

/**
 * A nota pelas regras de NCM: cada linha fica com a primeira regra cujo prefixo casa; soma-se o valor das linhas por
 * regra e vence a que responde pela maior parte da nota (empate: a que apareceu primeiro). Sem nenhuma, null (REVISAR).
 */
export function classificarNota(linhas: readonly { ncm: unknown; valor: number }[], regras: readonly RegraNcm[]): Classificacao | null {
  const totais = new Map<number, { regra: RegraNcm; total: number }>();
  for (const l of linhas) {
    const ncm = ncmCompleto(l.ncm);
    if (!ncm) continue;
    const i = regras.findIndex(r => { const p = String(r.prefixo || '').trim(); return !!p && ncm.startsWith(p); });
    if (i < 0) continue;
    const acc = totais.get(i) || { regra: regras[i], total: 0 };
    acc.total += Number(l.valor) || 0;
    totais.set(i, acc);
  }
  let melhor: { regra: RegraNcm; total: number } | null = null;
  for (const acc of totais.values()) if (!melhor || acc.total > melhor.total) melhor = acc;
  return melhor ? { conta: melhor.regra.conta, codHist: melhor.regra.codHist, historico: melhor.regra.historico, origemRegra: 'NCM' } : null;
}

/** O CT-e é sempre frete: a categoria do CT-e da Configuração geral (sem ela, REVISAR). */
export function classificarCte(c: ConfigLcdpr): Classificacao | null {
  const cat = c.categorias.find(x => x.nome === c.config.categoriaFretesCTe);
  return cat ? { conta: cat.conta, codHist: cat.codHist, historico: cat.historico, origemRegra: 'Padrão CT-e' } : null;
}

export const HISTORICO_SEM_REGRA = '⚠ Sem regra correspondente — classificar manualmente';

/** O documento lido de um relatório do SIEG (uma nota agrupada ou um CT-e). */
export interface DocumentoDoSieg {
  documento: string; fornecedor: string; cnpj: string; valor: number; data: string;
  /** a IE do destinatário (a fazenda), só na nota */
  ieDest: string;
  produto: string;
  /** os NCMs da nota, sem repetir, separados por ", " */
  ncm: string;
  /** cada item da nota (o NCM e o valor do item), para a classificação */
  linhas: { ncm: unknown; valor: number }[];
}

/** O lançamento de um documento: a classificação, o imóvel pela IE do destinatário (ou o padrão) e os padrões da Configuração. */
export function lancamentoDoDocumento(doc: DocumentoDoSieg, origem: OrigemDoDocumento, c: ConfigLcdpr, id: number): Lancamento {
  const m = origem === 'NF' ? classificarNota(doc.linhas, c.ncmRules) : classificarCte(c);
  // a IE às vezes vem com zeros na frente diferentes entre as notas ("0011288860080" e "11288860080")
  const ie = (s: string) => soDigitos(s).replace(/^0+/, '');
  const vinculo = doc.ieDest ? c.ieDest.find(x => ie(x.ie) && ie(x.ie) === ie(doc.ieDest)) : undefined;
  return {
    id, origem, data: doc.data, documento: doc.documento, cnpj: soDigitos(doc.cnpj), fornecedor: doc.fornecedor,
    categoria: m ? categoriaDaConta(c.categorias, m.conta, m.codHist) : '',
    contaDeved: m ? m.conta : '', contaCred: c.config.contaCredoraPadrao, codHist: m ? m.codHist || '' : '',
    historico: m ? aplicarModelo(m.historico, doc) : HISTORICO_SEM_REGRA,
    valor: doc.valor, imovel: vinculo ? vinculo.imovel : c.config.imovelPadrao,
    tipoDoc: c.config.tipoDocPadrao, tipoLanc: c.config.tipoLancPadrao,
    produto: doc.produto, ncm: doc.ncm, revisar: !m, origemRegra: m ? m.origemRegra : 'Nenhuma',
  };
}

/**
 * A categoria escolhida à mão: a conta, o código e o histórico dela, sai de REVISAR e fica "manual". Sem categoria
 * (a opção vazia), só a categoria some: a conta e o histórico ficam como estão.
 */
export function aplicarCategoria(l: Lancamento, nome: string, categorias: readonly Categoria[]): Lancamento {
  const cat = categorias.find(c => c.nome === nome);
  if (!cat) return { ...l, categoria: nome || '' };
  return { ...l, categoria: nome, contaDeved: cat.conta, codHist: cat.codHist || '', historico: aplicarModelo(cat.historico, l), revisar: false, origemRegra: 'Manual' };
}

/** O primeiro NCM do lançamento, com os zeros da frente ('' se não tiver). */
export function ncmDoLancamento(l: Pick<Lancamento, 'ncm'>): string {
  const bruto = String(l.ncm || '').split(/[^0-9]+/).filter(Boolean)[0];
  return bruto ? bruto.padStart(8, '0') : '';
}

/** A regra que já pega esse NCM (a primeira que casa). */
export function regraQuePega(ncm: string, regras: readonly RegraNcm[]): RegraNcm | undefined {
  return regras.find(r => { const p = String(r.prefixo || '').trim(); return !!p && ncm.startsWith(p); });
}

/**
 * Depois de classificar à mão: a regra que dá para criar (o capítulo de 4 dígitos do NCM, para pegar a família do
 * produto sem casar com o país inteiro) e quantos lançamentos da sessão têm esse prefixo. null quando não há NCM, não
 * há conta ou já existe regra que pega. O histórico da regra é o MODELO da categoria (o do lançamento já tem o número e
 * o fornecedor desta nota).
 */
export function regraSugerida(l: Lancamento, todos: readonly Lancamento[], c: ConfigLcdpr): { regra: RegraNcm; quantas: number } | null {
  const ncm = ncmDoLancamento(l);
  if (!ncm || !l.contaDeved || regraQuePega(ncm, c.ncmRules)) return null;
  const prefixo = ncm.slice(0, 4);
  const modelo = c.categorias.find(x => x.nome === l.categoria)?.historico;
  return {
    regra: { prefixo, conta: l.contaDeved, codHist: l.codHist || '', historico: modelo ?? l.historico ?? '' },
    quantas: todos.filter(x => ncmDoLancamento(x).startsWith(prefixo)).length,
  };
}

/**
 * A regra nova vale já para o que está em REVISAR nesta sessão (o aviso da página antiga prometia "vale para N
 * lançamentos desta importação"): quem estava em REVISAR não casava com regra nenhuma, então, se algum NCM dele casa
 * com a nova, é ela que vence.
 */
export function aplicarRegraNosPendentes(lancs: readonly Lancamento[], regra: RegraNcm, categorias: readonly Categoria[]): Lancamento[] {
  const p = String(regra.prefixo || '').trim();
  if (!p) return [...lancs];
  return lancs.map(l => {
    if (!l.revisar) return l;
    const ncms = String(l.ncm || '').split(/[^0-9]+/).filter(Boolean).map(n => n.padStart(8, '0'));
    if (!ncms.some(n => n.startsWith(p))) return l;
    return { ...l, contaDeved: regra.conta, codHist: regra.codHist || '', historico: aplicarModelo(regra.historico, l), revisar: false, origemRegra: 'NCM', categoria: categoriaDaConta(categorias, regra.conta, regra.codHist) };
  });
}

/** Um grupo do que falta revisar: mesmo NCM (4 dígitos) e mesmo fornecedor quase sempre é a mesma conta. */
export interface GrupoParaRevisar { chave: string; ncm: string; fornecedor: string; ids: number[]; valor: number }

export function gruposParaRevisar(lancs: readonly Lancamento[]): GrupoParaRevisar[] {
  const mapa = new Map<string, GrupoParaRevisar>();
  for (const l of lancs) {
    if (!l.revisar) continue;
    const ncm = ncmDoLancamento(l).slice(0, 4);
    const chave = ncm + '|' + (l.fornecedor || '').toUpperCase();
    let g = mapa.get(chave);
    if (!g) { g = { chave, ncm, fornecedor: l.fornecedor || '(sem fornecedor)', ids: [], valor: 0 }; mapa.set(chave, g); }
    g.ids.push(l.id);
    g.valor += Number(l.valor) || 0;
  }
  return [...mapa.values()].sort((a, b) => b.ids.length - a.ids.length || b.valor - a.valor);
}

/** Os lançamentos da tabela: só REVISAR (se pedido), a busca (fornecedor, documento, histórico, produto) e por data. */
export function lancamentosVisiveis(lancs: readonly Lancamento[], f: { busca: string; soRevisar: boolean }): Lancamento[] {
  let lista = f.soRevisar ? lancs.filter(l => l.revisar) : [...lancs];
  const q = (f.busca || '').trim().toUpperCase();
  if (q) lista = lista.filter(l => (l.fornecedor + ' ' + l.documento + ' ' + l.historico + ' ' + l.produto).toUpperCase().includes(q));
  return porData(lista);
}

/** Por data (os sem data primeiro, como a página antiga), sem mexer na ordem dos do mesmo dia. */
export function porData<T extends { data: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
}

/** A regra de NCM bate no filtro? Qualquer campo contém o texto; o NCM inteiro (só dígitos) acha a regra de prefixo que o pega. */
export function regraNoFiltro(r: RegraNcm, filtro: string): boolean {
  const q = filtro.trim().toUpperCase();
  if (!q) return true;
  const pref = String(r.prefixo || '').trim();
  return [r.prefixo, r.conta, r.codHist, r.historico].some(v => String(v || '').toUpperCase().includes(q)) || (/^\d+$/.test(q) && !!pref && q.startsWith(pref));
}

/** O texto de uma linha nova não pode ter quebra: o histórico vai numa linha só do arquivo do LCDPR. */
export const umaLinha = (s: string) => String(s ?? '').replace(/\s*\n\s*/g, ' ');
