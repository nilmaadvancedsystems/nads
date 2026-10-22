// Verificar por conta: cruza as notas da conta com o relatório da conta (razão) e diz
// o que falta, o que está duplicado, o que está a mais e o ICMS.
// Origem: conferencia.html — o algoritmo morava DENTRO do clique $('#vcBtConferir').onclick
// (~L3980-4108); vcNumerosDoHistorico/vcPartesHistorico/ehLinhaIcms (~L3754-3792),
// vcLinhasDuplicadas/vcLinhasFaltando/vcLinhaRazao (~L3785-3806), vcComposicao (~L4110),
// vcNotasServ (~L3735), vcBtCsv (~L4225). O relatório nunca é salvo: só memória.
import { brl, compararNumerico, nomeNorm } from '../../formatos';
import { SV } from '../tabelas/servicos';
import type { Conta, Empresa, FiltroMovimento, NotaComTipo, NotaServico, TipoServico } from '../tipos';
import { agruparTotaisPorNatureza, chaveNaturezaNota, chaveNota } from './cfop';
import { noPeriodo } from './periodo';
import { tipoDoCfopDeBem } from '../../tarefas/regras/bens';
import { nomeComumContas } from './conciliacao';
import { contasDaNatureza, listaTipo, naturezasDaConta, todasNotasComTipo } from './empresa';
import { catDoPart, catServ, contasDoPart, notasCfopDeServico } from './servicos';

/** Uma linha do relatório da conta. */
export interface LinhaRazao {
  txt: string;
  data: string;
  /** sempre positivo */
  valor: number;
  sinal: 1 | -1;
  contra: string;
  /** conta de origem, quando são várias contas */
  conta?: string;
  /** "é do CFOP 1201 (conta 60502)" */
  dica?: string;
  /** a operação da nota do histórico (Entrada, Saída, Tomado, Prestado), achada nas notas fiscais */
  operacao?: string;
}

/** Nota alvo da conferência: fiscal (com CFOP) ou de serviço. */
export type NotaAlvo = (NotaComTipo | (NotaServico & { cfop?: string; tipo?: undefined })) & { exportado?: string };

const IGUAL = 0.005;
const semZeros = (t: string) => t.replace(/^0+/, '') || t;

/**
 * Números de nota no histórico. Padrão fiscal: "… 29-54540585000161-NOME // NF 9009" — o número
 * real vem logo antes do CNPJ. Sem esse padrão, todo número de 3+ dígitos (serviço aceita até 15,
 * sem confundir com CPF/CNPJ). O grupo é limitado ({1,9}) pra regex não travar em texto comprido.
 */
export function numerosDoHistorico(txt: string, serv: boolean): string[] {
  const m = txt.match(/(\d{1,9})-(\d{14})-/);
  if (m) return [m[1]];
  // "nota - documento - nome" (o CNPJ com ou sem pontuação, o CPF): a nota é o número de antes do documento; os números do
  // documento e do nome não são nota (Vitor, 08/10/2026: na 309, o "/0001-" do CNPJ "08760011/0001-81" virava a NF 1 do
  // Raimundo, e 6 lançamentos de outros fornecedores apareciam em "Duplicadas na conta", 4.206,00, sem nada duplicado no razão)
  const ndn = txt.match(NOTA_DOC_NOME);
  if (ndn && ndn.index != null) {
    const antes = (txt.slice(0, ndn.index).match(/\d{3,}/g) || []).filter(t => (serv ? t.length <= 15 && t.length !== 11 && t.length !== 14 : t.length < 11));
    return antes.includes(ndn[1]) ? antes : [...antes, ndn[1]];
  }
  // com espaços em volta do traço (o relatório de serviços tomados): "NF nº - 6 - 27203457000150-NOME" — sem isso, a
  // nota de 1 ou 2 dígitos sumia (Vitor, 01/10/2026: a nota 6 do Raimundo, na 80005 da 292). Entra junto com os outros
  // números (como o original fazia), só quando ainda não veio
  const lista = (txt.match(/\d{3,}/g) || []).filter(t => (serv ? t.length <= 15 && t.length !== 11 && t.length !== 14 : t.length < 11));
  const s = txt.match(/(\d{1,15})\s+-\s+(\d{14}|\d{11})\s*-/);
  return s && lista.indexOf(s[1]) < 0 ? [...lista, s[1]] : lista;
}

/**
 * "nota - documento - nome" no fim do histórico. O documento vem de vários jeitos:
 * 54540585000161, 7314935000191 (CNPJ sem o zero da frente), 07314935/0001-91, 12345678901 (CPF).
 */
const NOTA_DOC_NOME = /(\d{1,15})\s*-\s*(\d{2}\.?\d{3}\.?\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11,14})\s*-\s*(.+)$/;

function docDoHistorico(bruto: string): string {
  const d = bruto.replace(/\D/g, '');
  return d.length > 11 ? d.padStart(14, '0') : d;
}

export function partesDoHistorico(txt: string): { nota: string; doc: string; nome: string; contra: string; lanc: string } {
  const t = String(txt || '').replace(/\s+/g, ' ').trim();
  const p = { nota: '', doc: '', nome: '', contra: '', lanc: '' };
  const m = t.match(NOTA_DOC_NOME);
  if (m) { p.nota = m[1].replace(/^0+(?=\d)/, ''); p.doc = docDoHistorico(m[2]); p.nome = m[3].trim(); }
  const c = t.match(/^(.*?)\s(\d{4,6})\s+pelo valor/i);
  if (c) { p.contra = c[1].trim(); p.lanc = c[2]; }
  return p;
}

/** Lançamento de ICMS não é nota repetida: sai da conferência e vai pra lista própria. */
export function ehLinhaIcms(l: Pick<LinhaRazao, 'txt'>): boolean {
  return /\bicms\b/.test(nomeNorm(l.txt));
}

/** Linha do relatório no formato da tabela. */
export interface LinhaTabela { data: string; nota: string; part: string; contra: string; valor: number; txt?: string; conta?: string; cfop?: string; exportado?: string; operacao?: string; /** a chave da nota (as faltando), para o "Não vai para o Contábil" */ chave?: string }

/** Os CFOPs em que a nota pode não ir para o Contábil, marcada uma a uma (Vitor, 22/10/2026: quase sempre é a água). */
export const CFOPS_QUE_PODEM_NAO_IR = ['1949', '2949'];
export const podeNaoIrParaOContabil = (cfop?: string): boolean => CFOPS_QUE_PODEM_NAO_IR.includes(String(cfop || '').replace(/\D/g, ''));

export function linhaDaTabela(l: LinhaRazao): LinhaTabela {
  const p = partesDoHistorico(l.txt);
  return { data: l.data, nota: p.nota, part: (p.nome || l.txt) + (l.dica ? ' · ' + l.dica : ''), contra: l.contra || p.lanc, valor: l.valor, txt: l.txt, conta: l.conta, operacao: l.operacao || '' };
}

// ---------- a operação da nota (Vitor, 14/10/2026: serviço prestado lançado na conta de tomados aparecia só como "A mais
// na conta"; a coluna Operação mostra de onde a nota é, e a linha de outra operação vira "Operação incorreta") ----------
export type Operacao = 'Entrada' | 'Saída' | 'Tomado' | 'Prestado';
const OPERACAO_DO_SERVICO: Record<TipoServico, Operacao> = { tomados: 'Tomado', prestados: 'Prestado' };
interface NotaDaOperacao { op: Operacao; nome: string; doc: string; valor: number }

/** As notas da empresa (entradas, saídas, tomados, prestados) pelo número, com a operação de cada uma. */
function notasPorNumero(e: Empresa): Record<string, NotaDaOperacao[]> {
  const m: Record<string, NotaDaOperacao[]> = {};
  const add = (numero: string, n: NotaDaOperacao) => { const k = semZeros(String(numero || '').trim()); if (k) (m[k] = m[k] || []).push(n); };
  for (const n of todasNotasComTipo(e)) add(n.numero, { op: n.tipo, nome: n.nome, doc: String(n.doc || '').replace(/\D/g, ''), valor: n.valor });
  for (const t of ['tomados', 'prestados'] as const) {
    for (const n of listaTipo(e, t)) add(n.numero, { op: OPERACAO_DO_SERVICO[t], nome: n.nome, doc: String(n.cnpj || '').replace(/\D/g, ''), valor: n.valor });
  }
  return m;
}

const mesmoNome = (a: string, b: string) => {
  const x = nomeNorm(a), y = nomeNorm(b);
  return x.length >= 5 && y.length >= 5 && (x.startsWith(y) || y.startsWith(x));
};

/**
 * As operações da nota que a linha do razão cita: o número do histórico e, para não pegar a nota de mesmo número de
 * outro participante, o valor, o CPF/CNPJ ou o nome batendo.
 */
function operacoesDaLinha(l: LinhaRazao, porNumero: Record<string, NotaDaOperacao[]>): Operacao[] {
  const p = partesDoHistorico(l.txt);
  const numeros = new Set([...numerosDoHistorico(l.txt, true), ...numerosDoHistorico(l.txt, false), p.nota].filter(Boolean).map(semZeros));
  const ops: Operacao[] = [];
  for (const k of numeros) {
    for (const n of porNumero[k] || []) {
      const bate = Math.abs(Math.abs(n.valor) - l.valor) < IGUAL || (!!p.doc && !!n.doc && p.doc.replace(/^0+/, '') === n.doc.replace(/^0+/, '')) || (!!p.nome && mesmoNome(p.nome, n.nome));
      if (bate && ops.indexOf(n.op) < 0) ops.push(n.op);
    }
  }
  return ops;
}

// ---------- o que conferir ----------
/** Conta ligada só a serviço → modo serviços (sem CFOP). */
export function servicoDaContaVerificar(e: Empresa, codigo: string): TipoServico | null {
  for (const k of Object.keys(e.naturezaConta || {})) {
    const m = /^serv\|(tomados|prestados)\|/.exec(k);
    if (m && contasDaNatureza(e, k).indexOf(codigo) > -1) return m[1] as TipoServico;
  }
  return null;
}

/** Notas de serviço (e com CFOP ligadas às mesmas contas) da conta. */
export function notasServicoDaConta(e: Empresa, t: TipoServico, codigos: string[]): NotaAlvo[] {
  const tNf = t === 'tomados' ? 'Entrada' : 'Saída';
  const serv = listaTipo(e, t).filter(n => contasDoPart(e, t, n.nome).some(c => codigos.indexOf(c) > -1));
  const nf = notasCfopDeServico(e, t).filter(n => contasDaNatureza(e, chaveNaturezaNota(n, tNf)).some(c => codigos.indexOf(c) > -1))
    .map(n => ({ ...n, tipo: tNf } as NotaComTipo));
  return (serv as NotaAlvo[]).concat(nf);
}

/** Opções de CFOP (naturezas) para o formulário; a vinculada à conta vem travada. */
export function opcoesCfop(e: Empresa, conta: Conta | null, codigos?: string[]): { chaves: string[]; rotulos: Record<string, string>; vinculada: string | null } {
  const grupos = agruparTotaisPorNatureza(todasNotasComTipo(e));
  const chaves = Object.keys(grupos).sort((a, b) => compararNumerico(grupos[a].cfops.slice().sort()[0] || '', grupos[b].cfops.slice().sort()[0] || ''));
  const rotulos: Record<string, string> = {};
  for (const k of chaves) {
    const g = grupos[k];
    rotulos[k] = g.cfops.slice().sort(compararNumerico).join(', ') + (g.desc ? ' — ' + g.desc : '') + ' (' + g.itens.length + ' notas)';
  }
  const cods = codigos && codigos.length ? codigos : conta ? [conta.codigo] : [];
  const ligadas = naturezasLigadas(e, cods, grupos);
  const vinculada = ligadas[0] || null;
  // conta ligada a várias naturezas: confere contra todas, e o campo mostra todos os CFOPs
  if (vinculada && ligadas.length > 1) {
    const gs = ligadas.map(k => grupos[k]);
    rotulos[vinculada] = uniaoCfops(gs).join(', ') + ' (' + gs.reduce((s, g) => s + g.itens.length, 0) + ' notas)';
  }
  return { chaves, rotulos, vinculada };
}

/** Naturezas (com notas) ligadas a essas contas no Cadastro, na ordem do CFOP. */
function naturezasLigadas(e: Empresa, codigos: string[], grupos: ReturnType<typeof agruparTotaisPorNatureza>): string[] {
  const ks: string[] = [];
  for (const cod of codigos) for (const k of naturezasDaConta(e, cod)) if (grupos[k] && ks.indexOf(k) < 0) ks.push(k);
  return ks.sort((a, b) => compararNumerico(grupos[a].cfops.slice().sort()[0] || '', grupos[b].cfops.slice().sort()[0] || ''));
}

function uniaoCfops(gs: { cfops: string[] }[]): string[] {
  const cf: string[] = [];
  for (const g of gs) for (const c of g.cfops) if (cf.indexOf(c) < 0) cf.push(c);
  return cf.sort(compararNumerico);
}

/**
 * Naturezas que entram na conferência: se o CFOP escolhido é um dos ligados à(s) conta(s),
 * entram todas as naturezas ligadas (ex.: 96501 = 5102 + 5405); senão, só a escolhida.
 * (O original usava só a primeira natureza ligada — as outras viravam "a mais".)
 */
export function naturezasDaConferencia(e: Empresa, codigos: string[], cfopGrupo: string | null): string[] {
  const grupos = agruparTotaisPorNatureza(todasNotasComTipo(e));
  if (!cfopGrupo || !grupos[cfopGrupo]) return [];
  const ligadas = naturezasLigadas(e, codigos, grupos);
  return ligadas.indexOf(cfopGrupo) > -1 ? ligadas : [cfopGrupo];
}

/** "70002 + 70006 — Compras de Mercadorias" (ou uma conta só). */
export function rotuloContas(contas: Pick<Conta, 'codigo' | 'nome'>[]): string {
  if (!contas.length) return '';
  if (contas.length === 1) return contas[0].codigo + ' — ' + contas[0].nome;
  const nomes = contas.map(a => a.nome);
  return contas.map(a => a.codigo).join(' + ') + ' — ' + (nomeComumContas(nomes) || nomes.join(' / '));
}

// ---------- o cruzamento ----------
export interface Duplicada { numero: string; vezes: number; valor: number; linhas: LinhaRazao[] }

/** Até quantos dias de distância uma linha sem o número da nota confere com ela pelo valor. */
export const DIAS_PELO_VALOR = 5;

const diaDe = (d: string) => { const [dd, mm, aa] = String(d || '').split('/').map(Number); return aa && mm && dd ? Date.UTC(aa, mm - 1, dd) / 86400000 : NaN; };

export interface ResultadoVerificacao {
  faltando: NotaAlvo[];
  duplicada: Duplicada[];
  aMais: LinhaRazao[];
  /** a mais que é nota de outra operação (o serviço prestado na conta de tomados, a saída na de entradas…) */
  operacaoIncorreta: LinhaRazao[];
  /** as operações das notas da conta (Entrada, Saída, Tomado, Prestado) */
  operacoesDaConta: Operacao[];
  /**
   * Conferidas pelo valor: a nota sem o número no histórico, lançada com o mesmo valor até DIAS_PELO_VALOR dias de
   * distância (ex.: a comissão lançada pelo pagamento no banco, "comissao Raimundo DOC.: 16283133").
   */
  peloValor: { nota: NotaAlvo; linha: LinhaRazao }[];
  /** as notas marcadas "Não vai para o Contábil" (fora da conferência e da soma das notas; dá para desfazer) */
  foraDoContabil?: NotaAlvo[];
  icms: LinhaRazao[];
  somaRazao: number;
  somaSemIcms: number;
  icmsSub: number;
  somaFiscal: number;
  serv: TipoServico | null;
  conta: { codigo: string; nome: string };
  /** mais de uma conta com relatório: abas Todas · 70002 · 70006 */
  contas: { codigo: string; nome: string }[] | null;
  fonte: string;
  /** todas as linhas usadas (com a conta de origem), para as abas por conta */
  linhas: LinhaRazao[];
}

export interface EntradaVerificacao {
  empresa: Empresa;
  /** contas conferidas (uma, ou o grupo que divide os CFOPs) */
  contas: Conta[];
  /** relatório de cada conta (código → linhas) */
  razaoPorConta: Record<string, LinhaRazao[]>;
  /** natureza escolhida (modo CFOP) */
  cfopGrupo: string | null;
  /** modo serviços */
  servTipo: TipoServico | null;
  /**
   * o período do Movimento (o da Tarefa, dentro dela): só as notas dele entram (Vitor, 22/10/2026: "se eu tô fazendo até o
   * mês 8, por que falta o mês 09 na conta?"). Sem = todas.
   */
  periodo?: Pick<FiltroMovimento, 'dataDe' | 'dataAte' | 'meses'>;
}

export function conferirConta(x: EntradaVerificacao): ResultadoVerificacao {
  const e = x.empresa;
  const codigos = x.contas.map(c => c.codigo);
  const multi = x.contas.length > 1;
  const todas = todasNotasComTipo(e);
  let alvo: NotaAlvo[];
  let fonte: string;
  let gs: ReturnType<typeof agruparTotaisPorNatureza>[string][] = [];
  if (x.servTipo) {
    alvo = notasServicoDaConta(e, x.servTipo, codigos);
  } else {
    const grupos = agruparTotaisPorNatureza(todas);
    gs = naturezasDaConferencia(e, codigos, x.cfopGrupo).map(k => grupos[k]);
    if (!gs.length) throw new Error('Escolha o CFOP antes de conferir.');
    alvo = gs.flatMap(g => g.itens);
  }
  // só as notas do período (o relatório da conta é o do período; a nota do mês seguinte não falta nele)
  const periodo = x.periodo;
  if (periodo) alvo = alvo.filter(n => noPeriodo({ data: n.data, comp: n.comp || '' }, periodo));
  // as notas que não vão para o Contábil (marcadas uma a uma) saem da conferência
  const marcadas = e.naoContabilNotas || {};
  const foraDoContabil = x.servTipo ? [] : alvo.filter(n => n.cfop && marcadas[chaveNota(n as NotaComTipo)]);
  if (foraDoContabil.length) alvo = alvo.filter(n => foraDoContabil.indexOf(n) < 0);
  const razao: LinhaRazao[] = multi
    ? x.contas.flatMap(a => (x.razaoPorConta[a.codigo] || []).map(l => ({ ...l, conta: a.codigo, dica: undefined })))
    : (x.razaoPorConta[codigos[0]] || []).map(l => ({ ...l, dica: undefined }));

  const icmsLinhas = razao.filter(ehLinhaIcms);
  let linhasConf = razao.filter(l => !ehLinhaIcms(l));

  // nota com mais de um CFOP (ex.: NF 21112 = CFOP 1411 + CFOP 1201): a linha com o valor do item
  // do outro CFOP não é duplicada — pertence a outra conta; vai pra "A mais" com a dica
  const deOutroCfop: LinhaRazao[] = [];
  if (!x.servTipo) {
    const chAlvo: Record<string, 1> = {};
    for (const n of alvo) chAlvo[chaveNota(n as NotaComTipo)] = 1;
    const porNum: Record<string, NotaComTipo[]> = {};
    for (const n of todas) { const k = String(n.numero || '').replace(/^0+/, '') || n.numero; if (k) (porNum[k] = porNum[k] || []).push(n); }
    linhasConf = linhasConf.filter(l => {
      for (const t of numerosDoHistorico(l.txt, false)) {
        const ns = porNum[semZeros(t)] || [];
        const doAlvo = ns.filter(n => chAlvo[chaveNota(n)]);
        if (!doAlvo.length || doAlvo.some(n => Math.abs(n.valor - l.valor) < IGUAL)) continue;
        const f = ns.find(n => !chAlvo[chaveNota(n)] && Math.abs(n.valor - l.valor) < IGUAL);
        if (f) {
          const cs = contasDaNatureza(e, chaveNaturezaNota(f, f.tipo));
          l.dica = 'é do CFOP ' + f.cfop + (cs.length ? ' (conta ' + cs.join(', ') + ')' : ' (sem conta vinculada)');
          deOutroCfop.push(l);
          return false;
        }
      }
      return true;
    });
  }

  const serv = !!x.servTipo;
  const numerosPorLinha = linhasConf.map(l => numerosDoHistorico(l.txt, serv));
  const vistos: Record<string, number> = {};
  linhasConf.forEach((_, i) => { for (const t of numerosPorLinha[i]) { const k = semZeros(t); vistos[k] = (vistos[k] || 0) + 1; } });
  const numerosAlvo: Record<string, 1> = {};
  for (const n of alvo) if (n.numero) numerosAlvo[n.numero.replace(/^0+/, '') || n.numero] = 1;
  // nota de valor zero não tem o que lançar: não entra em "Faltando na conta"
  const faltandoPeloNumero = alvo.filter(n => !!n.numero && Math.abs(n.valor) >= IGUAL && !vistos[n.numero.replace(/^0+/, '') || n.numero]);

  const itensPorNumero: Record<string, number[]> = {};
  const linhasPorNumero: Record<string, LinhaRazao[]> = {};
  for (const n of alvo) { if (!n.numero) continue; const k = n.numero.replace(/^0+/, '') || n.numero; (itensPorNumero[k] = itensPorNumero[k] || []).push(n.valor); }
  linhasConf.forEach((l, i) => { for (const t of numerosPorLinha[i]) { const k = semZeros(t); const a = (linhasPorNumero[k] = linhasPorNumero[k] || []); if (a.indexOf(l) < 0) a.push(l); } });
  // duplicada é decidida pelo VALOR: só quando o lançado com o número da nota passa do valor dela
  const duplicada: Duplicada[] = Object.keys(linhasPorNumero).filter(k => numerosAlvo[k] && linhasPorNumero[k].length > 1).map(k => {
    const ls = linhasPorNumero[k];
    const its = itensPorNumero[k] || [];
    const esperado = its.reduce((s, v) => s + v, 0);
    const lancado = ls.reduce((s, l) => s + l.valor, 0);
    const extra = lancado - esperado;
    if (extra < IGUAL) return null; // bate com a nota (inteira ou item a item)
    const resto = ls.slice().sort((a, b) => a.valor - b.valor);
    const inteira = resto.findIndex(l => Math.abs(l.valor - esperado) < IGUAL);
    if (inteira >= 0) resto.splice(inteira, 1);
    else for (const v of its) { const i = resto.findIndex(l => Math.abs(l.valor - v) < IGUAL); if (i >= 0) resto.splice(i, 1); }
    return { numero: k, vezes: ls.length, valor: extra, linhas: resto };
  }).filter((d): d is Duplicada => d !== null);

  // as linhas sem o número de nenhuma nota: a que falta pelo número pode estar aqui pelo valor (a mais perto na data)
  const semNumero = linhasConf.filter((_, i) => !numerosPorLinha[i].some(t => numerosAlvo[semZeros(t)]));
  const usadas = new Set<LinhaRazao>();
  const peloValor: { nota: NotaAlvo; linha: LinhaRazao }[] = [];
  const faltando = faltandoPeloNumero.filter(n => {
    let melhor: LinhaRazao | null = null, dist = Infinity;
    for (const l of semNumero) {
      if (usadas.has(l) || Math.abs(l.valor - Math.abs(n.valor)) >= IGUAL) continue;
      const d = Math.abs(diaDe(l.data) - diaDe(n.data));
      if (d <= DIAS_PELO_VALOR && d < dist) { dist = d; melhor = l; }
    }
    if (!melhor) return true;
    usadas.add(melhor);
    peloValor.push({ nota: n, linha: melhor });
    return false;
  });
  const sobra = semNumero.filter(l => !usadas.has(l)).concat(deOutroCfop);
  // a operação de cada linha (a coluna Operação) e a da conta: a linha que só é nota de outra operação sai do "A mais"
  const porNumero = notasPorNumero(e);
  const operacoesDaConta: Operacao[] = [];
  const addOp = (o: Operacao) => { if (operacoesDaConta.indexOf(o) < 0) operacoesDaConta.push(o); };
  if (x.servTipo) { addOp(OPERACAO_DO_SERVICO[x.servTipo]); for (const n of alvo) if (n.tipo) addOp(n.tipo); }
  else for (const n of alvo) if (n.tipo) addOp(n.tipo);
  const opsDe = new Map<LinhaRazao, Operacao[]>();
  for (const l of razao) { const ops = operacoesDaLinha(l, porNumero); opsDe.set(l, ops); if (ops.length) l.operacao = ops.join(' / '); }
  const deOutraOperacao = (l: LinhaRazao) => { const ops = opsDe.get(l) || []; return ops.length > 0 && operacoesDaConta.length > 0 && ops.every(o => operacoesDaConta.indexOf(o) < 0); };
  const operacaoIncorreta = sobra.filter(deOutraOperacao);
  const aMais = sobra.filter(l => !deOutraOperacao(l));
  const somaSemIcms = linhasConf.concat(deOutroCfop).reduce((s, l) => s + l.valor, 0);
  const neg = linhasConf.filter(l => l.sinal < 0).length;
  const sinalConta = neg > linhasConf.length / 2 ? -1 : 1;
  const icmsSub = icmsLinhas.reduce((s, l) => s + (l.sinal === sinalConta ? -l.valor : l.valor), 0);
  const somaRazao = somaSemIcms + icmsLinhas.reduce((s, l) => s + l.valor, 0);
  const somaFiscal = alvo.reduce((s, n) => s + n.valor, 0);

  if (x.servTipo) {
    const cats: string[] = [];
    for (const n of alvo) { const c = catServ(x.servTipo, catDoPart(e, x.servTipo, n.nome)).nome; if (cats.indexOf(c) < 0) cats.push(c); }
    fonte = SV[x.servTipo].rotulo + (cats.length ? ' · ' + cats.join(', ') : '');
  } else {
    fonte = 'CFOP ' + uniaoCfops(gs).join(', ') + (gs.length === 1 && gs[0].desc ? ' — ' + gs[0].desc : '');
  }
  const comRel = multi ? x.contas.filter(a => x.razaoPorConta[a.codigo]) : [];
  const rot = rotuloContas(x.contas);
  const conta = !multi ? { codigo: x.contas[0].codigo, nome: x.contas[0].nome }
    : comRel.length === 1 ? { codigo: comRel[0].codigo, nome: comRel[0].nome }
    : { codigo: comRel.map(a => a.codigo).join(' + '), nome: nomeComumContas(comRel.map(a => a.nome)) || rot.slice(rot.indexOf(' — ') + 3) };

  return {
    faltando, duplicada, aMais, operacaoIncorreta, operacoesDaConta, peloValor, foraDoContabil, icms: icmsLinhas, somaRazao, somaSemIcms, icmsSub, somaFiscal,
    serv: x.servTipo, conta,
    contas: comRel.length > 1 ? comRel.map(a => ({ codigo: a.codigo, nome: a.nome })) : null,
    fonte, linhas: razao,
  };
}

/** As linhas de outra operação (o resultado de antes da coluna Operação não tem a lista). */
export const operacaoIncorretaDe = (r: ResultadoVerificacao): LinhaRazao[] => r.operacaoIncorreta || [];

export function semPendencias(r: ResultadoVerificacao): boolean {
  return !r.faltando.length && !r.duplicada.length && !r.aMais.length && !operacaoIncorretaDe(r).length;
}

/**
 * Sobrou só o que costuma ir para outra conta (Vitor, 13/10/2026: "quando for CFOP de bens ou ativos, ICMS, deixa passar"):
 * as notas de bem do ativo imobilizado faltando na conta (1551, 2551, 1406…) — o ICMS no razão já não é pendência. Aponta,
 * mas a conta fica Ok ("Conferir mais adiante...").
 */
export function soPendenciasQuePassam(r: ResultadoVerificacao): boolean {
  return !semPendencias(r) && !r.duplicada.length && !r.aMais.length && !operacaoIncorretaDe(r).length && r.faltando.every(n => !!tipoDoCfopDeBem(n.cfop || ''));
}

/** Linhas "a mais" por repetição (as que sobram de cada número duplicado). */
export function linhasDuplicadas(r: ResultadoVerificacao): LinhaTabela[] {
  const out: LinhaTabela[] = [];
  for (const d of r.duplicada) for (const l of d.linhas) out.push(linhaDaTabela(l));
  return out;
}

export function linhasFaltando(r: ResultadoVerificacao): LinhaTabela[] {
  // a nota faltando é da própria conta: a operação é a dela (Entrada/Saída) ou a do serviço da conta
  const daConta = r.serv ? OPERACAO_DO_SERVICO[r.serv] : '';
  return r.faltando.map(n => linhaDaNota(n, daConta));
}

const linhaDaNota = (n: NotaAlvo, daConta: string): LinhaTabela =>
  ({ data: n.data, nota: n.numero, part: n.nome, contra: '', valor: n.valor, cfop: n.cfop || '', exportado: n.exportado || '', operacao: n.tipo || daConta, ...(n.cfop ? { chave: chaveNota(n as NotaComTipo) } : {}) });

/** As notas marcadas "Não vai para o Contábil", na tabela (com a chave, para desfazer). */
export function linhasForaDoContabil(r: ResultadoVerificacao): LinhaTabela[] {
  return (r.foraDoContabil || []).map(n => linhaDaNota(n, ''));
}

export interface Totais { faltando: number; duplicadas: number; aMais: number; operacaoIncorreta: number; icms: number; diferenca: number; semExplicacao: number }

/** Diferença = Faltando − Duplicadas − A mais − Operação incorreta − ICMS; o que sobrar é "Sem explicação". */
export function totaisVerificacao(r: ResultadoVerificacao): Totais {
  const faltando = r.faltando.reduce((s, n) => s + n.valor, 0);
  const duplicadas = r.duplicada.reduce((s, d) => s + d.valor, 0);
  const aMais = r.aMais.reduce((s, l) => s + l.valor, 0);
  const operacaoIncorreta = operacaoIncorretaDe(r).reduce((s, l) => s + l.valor, 0);
  const icms = r.icms.reduce((s, l) => s + l.valor, 0);
  const diferenca = r.somaFiscal - r.somaRazao;
  return { faltando, duplicadas, aMais, operacaoIncorreta, icms, diferenca, semExplicacao: diferenca - (faltando - duplicadas - aMais - operacaoIncorreta - icms) };
}

/** Aba de uma conta (várias contas): o relatório dela e o que sobrou nela. */
export function resultadoDaConta(r: ResultadoVerificacao, codigo: string) {
  const dups = linhasDuplicadas(r).filter(l => l.conta === codigo);
  const mais = r.aMais.filter(l => l.conta === codigo).map(linhaDaTabela);
  const incorretas = operacaoIncorretaDe(r).filter(l => l.conta === codigo).map(linhaDaTabela);
  const soma = (ls: { valor: number }[]) => ls.reduce((s, l) => s + l.valor, 0);
  const somaConta = soma(r.linhas.filter(l => l.conta === codigo && !ehLinhaIcms(l)));
  return { dups, mais, incorretas, somaConta, pendencias: soma(dups) + soma(mais) + soma(incorretas) };
}

/** CSV do resultado (mesmas colunas da tela + totalizador). */
export function csvVerificacao(r: ResultadoVerificacao): string[] {
  const t = totaisVerificacao(r);
  const multi = !!(r.contas && r.contas.length > 1);
  const L = [(multi ? 'Tipo;Conta;' : 'Tipo;') + 'Data;Nota;Participante;Operação;Contrapartida;Valor'];
  const add = (tipo: string, l: LinhaTabela) => L.push([tipo].concat(multi ? [l.conta || ''] : []).concat([l.data, l.nota || '', String(l.part || '').replace(/;/g, ','), l.operacao || '', l.contra || '', brl(l.valor)]).join(';'));
  linhasFaltando(r).forEach(l => add('Faltando', l));
  linhasDuplicadas(r).forEach(l => add('Duplicada', l));
  operacaoIncorretaDe(r).map(linhaDaTabela).forEach(l => add('Operação incorreta', l));
  r.aMais.map(linhaDaTabela).forEach(l => add('A mais', l));
  r.icms.map(linhaDaTabela).forEach(l => add('ICMS', l));
  L.push('');
  const vz = multi ? ['', '', '', '', ''] : ['', '', '', ''];
  L.push(['Totalizador', ...vz, 'Faltando', brl(t.faltando)].join(';'));
  L.push(['Totalizador', ...vz, 'Duplicadas', brl(-t.duplicadas)].join(';'));
  if (t.operacaoIncorreta) L.push(['Totalizador', ...vz, 'Operação incorreta', brl(-t.operacaoIncorreta)].join(';'));
  L.push(['Totalizador', ...vz, 'A mais', brl(-t.aMais)].join(';'));
  if (t.icms) L.push(['Totalizador', ...vz, 'ICMS', brl(-t.icms)].join(';'));
  L.push(['Totalizador', ...vz, 'Diferença', brl(t.faltando - t.duplicadas - t.aMais - t.operacaoIncorreta - t.icms)].join(';'));
  return L;
}

/** O que falta preencher antes de conferir. */
export function faltaParaConferir(x: { temPlano: boolean; conta: Conta | null; multi: boolean; algumRelatorio: boolean; relatorioUnico: boolean; servTipo: TipoServico | null; qtdNotasServ: number; cfopGrupo: string | null }): string[] {
  const f: string[] = [];
  if (!x.temPlano) f.push('Importar o balancete em Importação › Balancete');
  if (!x.conta) f.push('Escolher qual conta você quer conferir');
  if (x.multi) { if (!x.algumRelatorio) f.push('Importar o relatório de pelo menos uma das contas'); }
  else if (!x.relatorioUnico) f.push('Importar o relatório da conta contábil');
  if (x.servTipo) { if (!x.qtdNotasServ) f.push('Nenhuma nota de ' + SV[x.servTipo].rotulo.toLowerCase() + ' ligada a essa conta'); }
  else if (!x.cfopGrupo) f.push('Escolher o CFOP referente a essa conta');
  return f;
}
