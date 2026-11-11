// O lançamento à mão no LCDPR (11/11/2026: "preciso que no importador tenha a opção de lancar na mão algum tipo de
// lançamento, e para abrir uma tela flutuante com o lançamento a ser feito com as opçoes de conta e tudo que tem, puxado
// via balancete igualmente o alterdata é"): a janela segue a "Lançamentos (Cadastramento)" do LCDPR do Alterdata — data,
// valor, lançamento automático (aqui, a categoria: preenche a conta, o histórico padrão e o texto), conta devedora e
// credora (pesquisadas no plano de contas da empresa que veio do Alterdata/balancete; sem ele, no plano do LCDPR),
// histórico padrão, documento, imóvel, tipo de documento, tipo de lançamento e CPF/CNPJ. A mesma janela corrige o
// lançamento que veio do SIEG.
import { HISTORICO_SEM_REGRA, aplicarModelo, categoriaDaConta, soDigitos, umaLinha } from './classificar';
import { dataBr, dataDaCelula, numeroDaCelula } from './relatorios';
import type { ContaAprendida, HistoricoAprendido } from './historicos';
import type { ConfigLcdpr, Lancamento } from './tipos';

/** Uma linha da pesquisa (a conta, o histórico padrão, o imóvel). A sintética aparece, mas não se escolhe. */
export interface ItemDePesquisa { codigo: string; nome: string; detalhe?: string; sintetica?: boolean; /** no histórico: a conta em que ele costuma cair */ conta?: string }

/** Uma conta do plano da empresa (o Cadastro: o plano do Alterdata, ou o balancete). */
export interface ContaDaEmpresa { codigo: string; nome: string; classificacao?: string; sintetica?: boolean; ordem?: number }

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** A pesquisa: o código ou a classificação que começam com o termo, ou o nome que o contém (sem acento). Vazio = tudo. */
export function pesquisar<T extends ItemDePesquisa>(itens: readonly T[], termo: string): T[] {
  const q = semAcento(termo.trim());
  if (!q) return [...itens];
  return itens.filter(i => i.codigo.toLowerCase().startsWith(q) || semAcento(i.detalhe || '').startsWith(q) || semAcento(i.nome).includes(q));
}

/**
 * As contas para escolher: o plano da empresa (o que veio do Alterdata, na ordem dele, com a classificação) quando há; sem
 * ele, o plano do LCDPR (a Configuração). Sem código, não entra.
 */
export function contasDaPesquisa(c: Pick<ConfigLcdpr, 'planoContas'>, daEmpresa?: readonly ContaDaEmpresa[] | null, aprendidas: readonly ContaAprendida[] = []): ItemDePesquisa[] {
  if (daEmpresa && daEmpresa.length) {
    return [...daEmpresa].filter(x => String(x.codigo || '').trim())
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map(x => ({ codigo: String(x.codigo).trim(), nome: x.nome, detalhe: x.classificacao || '', sintetica: !!x.sintetica }));
  }
  const doLcdpr = c.planoContas.filter(x => String(x.codigo || '').trim())
    .map(x => ({ codigo: x.codigo.trim(), nome: x.nome, detalhe: x.classificacao || '', sintetica: String(x.tipo || '').toUpperCase() === 'S' }));
  // as contas que o movimento do Alterdata usa e o plano do LCDPR não tem (11/11/2026)
  const tem = new Set(doLcdpr.map(x => x.codigo));
  return [...doLcdpr, ...aprendidas.filter(a => !tem.has(a.codigo)).map(a => ({ codigo: a.codigo, nome: a.nome, detalhe: 'Alterdata' }))];
}

/**
 * Os históricos padrão: os aprendidos do movimento do Alterdata primeiro (o modelo, a conta em que costuma cair e quantas
 * vezes foi usado), depois o código e o modelo de cada categoria e regra de NCM que não estão lá (sem repetir o código).
 */
export function historicosDaPesquisa(c: Pick<ConfigLcdpr, 'categorias' | 'ncmRules'>, aprendidos: readonly HistoricoAprendido[] = []): ItemDePesquisa[] {
  const vistos = new Map<string, ItemDePesquisa>();
  for (const h of aprendidos) {
    if (!vistos.has(h.codigo)) vistos.set(h.codigo, { codigo: h.codigo, nome: h.modelo, conta: h.conta, detalhe: h.conta ? h.conta + (h.contaNome ? ' · ' + h.contaNome : '') : '' });
  }
  const daConfig = new Map<string, ItemDePesquisa>();
  for (const x of [...c.categorias, ...c.ncmRules]) {
    const codigo = String(x.codHist || '').trim();
    if (codigo && !vistos.has(codigo) && !daConfig.has(codigo)) daConfig.set(codigo, { codigo, nome: x.historico, conta: x.conta });
  }
  return [...vistos.values(), ...[...daConfig.values()].sort((a, b) => a.codigo.localeCompare(b.codigo))];
}

/** Os imóveis para a pesquisa. */
export const imoveisDaPesquisa = (c: Pick<ConfigLcdpr, 'imoveis'>): ItemDePesquisa[] => c.imoveis.filter(x => String(x.codigo || '').trim()).map(x => ({ codigo: x.codigo.trim(), nome: x.descricao }));

/** O nome do código na lista ('' quando não está). */
export const nomeNaPesquisa = (itens: readonly ItemDePesquisa[], codigo: string): string => itens.find(i => i.codigo === String(codigo || '').trim())?.nome || '';

/** O que a janela edita (tudo em texto, como se digita). */
export interface RascunhoDoLancamento {
  /** dd/mm/aaaa */
  data: string;
  /** "1.234,56" */
  valor: string;
  /** o lançamento automático: o nome da categoria ('' = nenhum) */
  automatico: string;
  contaDeved: string;
  contaCred: string;
  codHist: string;
  historico: string;
  documento: string;
  fornecedor: string;
  cnpj: string;
  imovel: string;
  tipoDoc: string;
  tipoLanc: string;
  produto: string;
}

/** O texto pelo modelo, sem o que sobra dos campos vazios (os espaços dobrados e o " - " no fim). */
function preencher(modelo: string, ctx: { documento: string; fornecedor: string; cnpj: string }): string {
  return aplicarModelo(modelo, ctx).replace(/\s+/g, ' ').replace(/(\s*-\s*)+$/, '').trim();
}

const valorEmTexto = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** O lançamento novo: os padrões da Configuração (a conta de pagamento, o imóvel e os tipos). */
export function rascunhoNovo(c: Pick<ConfigLcdpr, 'config'>): RascunhoDoLancamento {
  return {
    data: '', valor: '', automatico: '', contaDeved: '', contaCred: c.config.contaCredoraPadrao, codHist: '', historico: '', documento: '', fornecedor: '', cnpj: '',
    imovel: c.config.imovelPadrao, tipoDoc: c.config.tipoDocPadrao, tipoLanc: c.config.tipoLancPadrao, produto: '',
  };
}

/** O lançamento que já existe, para corrigir. */
export function rascunhoDoLancamento(l: Lancamento): RascunhoDoLancamento {
  return {
    data: dataBr(l.data), valor: valorEmTexto(l.valor), automatico: l.categoria, contaDeved: l.contaDeved, contaCred: l.contaCred, codHist: l.codHist,
    historico: l.historico, documento: l.documento, fornecedor: l.fornecedor, cnpj: l.cnpj, imovel: l.imovel, tipoDoc: l.tipoDoc, tipoLanc: l.tipoLanc, produto: l.produto,
  };
}

/** O lançamento automático (a categoria): a conta devedora, o histórico padrão e o texto pelo modelo. */
export function aplicarAutomatico(r: RascunhoDoLancamento, nome: string, c: Pick<ConfigLcdpr, 'categorias'>): RascunhoDoLancamento {
  const cat = c.categorias.find(x => x.nome === nome);
  if (!cat) return { ...r, automatico: '' };
  return { ...r, automatico: cat.nome, contaDeved: cat.conta, codHist: cat.codHist || '', historico: preencher(cat.historico, { documento: r.documento, fornecedor: r.fornecedor, cnpj: r.cnpj }) };
}

/** O histórico padrão escolhido: o código, o texto pelo modelo dele e, com a conta devedora vazia, a conta em que ele costuma cair. */
export function aplicarHistoricoPadrao(r: RascunhoDoLancamento, codigo: string, historicos: readonly ItemDePesquisa[]): RascunhoDoLancamento {
  const h = historicos.find(x => x.codigo === codigo);
  return h ? { ...r, codHist: h.codigo, historico: preencher(h.nome, { documento: r.documento, fornecedor: r.fornecedor, cnpj: r.cnpj }), contaDeved: r.contaDeved || h.conta || '' } : { ...r, codHist: codigo };
}

/** O modelo do histórico em uso: o da categoria (lançamento automático) com o mesmo histórico padrão, ou o do histórico padrão. */
function modeloDoRascunho(r: RascunhoDoLancamento, c: Pick<ConfigLcdpr, 'categorias'>, historicos: readonly ItemDePesquisa[]): string {
  const cat = c.categorias.find(x => x.nome === r.automatico && String(x.codHist || '') === r.codHist);
  return cat ? cat.historico : historicos.find(x => x.codigo === r.codHist)?.nome || '';
}

/**
 * Um campo digitado. O documento, o fornecedor e o CPF/CNPJ entram no texto do histórico ({{doc}}, {{fornecedor}},
 * {{cnpj}}): mudando, o texto se refaz pelo modelo — a não ser que a pessoa tenha mudado o texto à mão.
 */
export function mudarNoRascunho(r: RascunhoDoLancamento, campo: keyof RascunhoDoLancamento, valor: string, c: Pick<ConfigLcdpr, 'categorias'>, historicos: readonly ItemDePesquisa[]): RascunhoDoLancamento {
  const novo = { ...r, [campo]: valor };
  if (campo !== 'documento' && campo !== 'fornecedor' && campo !== 'cnpj') return novo;
  const modelo = modeloDoRascunho(r, c, historicos);
  if (!modelo || r.historico !== preencher(modelo, { documento: r.documento, fornecedor: r.fornecedor, cnpj: r.cnpj })) return novo;
  return { ...novo, historico: preencher(modelo, { documento: novo.documento, fornecedor: novo.fornecedor, cnpj: novo.cnpj }) };
}

/** O que falta (ou está errado) para gravar; vazio = pode gravar. A data tem que ser de um dos meses abertos. */
export function problemasDoRascunho(r: RascunhoDoLancamento, meses: string | readonly string[]): string[] {
  const p: string[] = [];
  const abertos = (typeof meses === 'string' ? [meses] : [...meses]).filter(Boolean);
  const data = dataDaCelula(r.data);
  if (!data) p.push('a data (dd/mm/aaaa)');
  else if (abertos.length && !abertos.includes(data.slice(0, 7))) p.push('a data dentro de ' + abertos.map(c => c.slice(5) + '/' + c.slice(0, 4)).join(' ou '));
  if (!(numeroDaCelula(r.valor) > 0)) p.push('o valor');
  if (!r.contaDeved.trim()) p.push('a conta devedora');
  if (!r.contaCred.trim()) p.push('a conta credora');
  if (!r.historico.trim() || r.historico.trim() === HISTORICO_SEM_REGRA) p.push('o histórico');
  const doc = soDigitos(r.cnpj);
  if (doc && doc.length !== 11 && doc.length !== 14) p.push('o CPF/CNPJ com 11 ou 14 dígitos');
  return p;
}

/**
 * O lançamento a partir do rascunho (já sem problemas): o novo é "à mão"; o que existe guarda a origem. Com a conta
 * devedora, sai de REVISAR; a categoria é a que tem a mesma conta e o mesmo histórico padrão.
 */
export function lancamentoDoRascunho(r: RascunhoDoLancamento, c: Pick<ConfigLcdpr, 'categorias'>, base: Lancamento | { id: number }): Lancamento {
  const antes = 'origem' in base ? base : null;
  const contaDeved = r.contaDeved.trim(), codHist = r.codHist.trim();
  const mudouAConta = !antes || antes.contaDeved !== contaDeved || antes.codHist !== codHist;
  return {
    id: base.id, origem: antes ? antes.origem : 'Manual', data: dataDaCelula(r.data), documento: r.documento.trim(), cnpj: soDigitos(r.cnpj), fornecedor: umaLinha(r.fornecedor).trim(),
    categoria: categoriaDaConta(c.categorias, contaDeved, codHist), contaDeved, contaCred: r.contaCred.trim(), codHist, historico: umaLinha(r.historico).trim(),
    valor: numeroDaCelula(r.valor), imovel: r.imovel.trim(), tipoDoc: r.tipoDoc.trim(), tipoLanc: r.tipoLanc.trim(), produto: umaLinha(r.produto).trim(),
    ncm: antes ? antes.ncm : '', revisar: !contaDeved,
    origemRegra: !contaDeved ? 'Nenhuma' : mudouAConta || !antes ? 'Manual' : antes.origemRegra,
    ...(antes?.chave ? { chave: antes.chave } : {}),
  };
}
