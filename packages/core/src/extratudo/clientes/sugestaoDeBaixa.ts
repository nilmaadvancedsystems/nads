// A sugestão de baixa da nota em aberto no razão do cliente ou do fornecedor (Vitor, 15/10/2026: "relacionar as notas em
// aberto daquele razão e mostrar uma sugestão de baixa, pegando os valores dos bancos, junto a data, descrição, o que for
// preciso para identificar se houve algum pagamento daquela nota em aberto, para o usuário já achar no banco e analisar").
// Procura nos extratos importados (todos os bancos da empresa) o lançamento no sentido certo (cliente: entrou; fornecedor:
// saiu), da data da nota até 6 meses depois, com o mesmo valor ou com o nome do participante no histórico. Só sugere.
import { normalizarTexto } from '../../formatos';

/** Um lançamento do extrato: data 'aaaa-mm-dd', valor em centavos (+ entrou, − saiu), o histórico e o banco (o nome e a marca, para o logo). */
export interface LancamentoDoBanco { data: string; valor: number; historico: string; banco: string; marca?: string }

export type ComoBate = 'total' | 'parcela' | 'juros' | 'desconto';

export interface SugestaoDeBaixa extends LancamentoDoBanco {
  /** o mesmo valor do que está em aberto */
  mesmoValor: boolean;
  /** o nome do participante aparece no histórico */
  mesmoNome: boolean;
  /** como o valor bate: o total em aberto, o de uma parcela, com juros/multa (a mais) ou com desconto (a menos) */
  como: ComoBate;
  /** a parcela: "2/3" (o vendido em 3x) ou "1 de 2" (o aberto em 2x); vazio no total */
  parcela: string;
  /** perto da data em que a próxima duplicata cairia (pelo ritmo das já pagas) */
  dataEsperada: boolean;
}

/** Até quantos dias depois da nota o pagamento costuma vir (as parcelas vão longe). */
const DIAS_DEPOIS = 400;
/** Até quantos dias antes (o pagamento adiantado ou a nota emitida depois). */
const DIAS_ANTES = 5;
/** O que vale como juros/multa (até 10% a mais) e como desconto (até 3% a menos). */
const JUROS = 0.10, DESCONTO = 0.03;
/** A data esperada da parcela: até tantos dias de diferença. */
const FOLGA_DA_DATA = 10;

/** Palavras do nome que não identificam ninguém. */
const GENERICAS = new Set(['ltda', 'eireli', 'epp', 'me', 'sa', 'cia', 'comercio', 'industria', 'servicos', 'servico', 'empresa', 'de', 'da', 'do', 'dos', 'das', 'e',
  'brasil', 'distribuidora', 'transportes', 'construtora', 'engenharia', 'grupo', 'outros', 'diversos', 'clientes', 'fornecedores', 'comercial', 'industrial']);

const dia = (d: string) => { const [a, m, x] = d.split('-').map(Number); return Date.UTC(a, m - 1, x) / 86400000; };

/** O depósito de cheque nunca é a baixa de uma nota (Vitor, 15/10/2026: "não entra, não coloque em hipótese alguma"). */
export function ehDepositoDeCheque(historico: string): boolean {
  const h = ' ' + normalizarTexto(historico) + ' ';
  return /\s(dep\w*)\s/.test(h) && /\s(cheques?|chq|ch)\s/.test(h);
}

/** As palavras do nome que identificam (4 letras ou mais, sem as genéricas). */
export function palavrasDoNome(nome: string): string[] {
  return normalizarTexto(nome).split(' ').filter(p => p.length >= 4 && !GENERICAS.has(p));
}

/** A nota em aberto como a relação guarda: data, valor em aberto (reais), o vendido e as parcelas já recebidas. */
export interface NotaEmAberto { data: string; valor: number; vendido?: number; pagos?: readonly { data: string; valor: number }[] }

interface Alvo { centavos: number; como: 'total' | 'parcela'; parcela: string; confiavel: boolean }

/** Os valores que podem aparecer no banco: o aberto inteiro, as parcelas já pagas, o vendido e o aberto em 2 a 10x. */
function alvosDa(n: NotaEmAberto): Alvo[] {
  const c = (v: number) => Math.round(Math.abs(v) * 100);
  const aberto = c(n.valor);
  const out: Alvo[] = [{ centavos: aberto, como: 'total', parcela: '', confiavel: true }];
  // a parcela que o cliente já pagou é a de referência (as que faltam costumam ser iguais)
  for (const p of n.pagos || []) out.push({ centavos: c(p.valor), como: 'parcela', parcela: 'como a de ' + p.data.slice(8, 10) + '/' + p.data.slice(5, 7), confiavel: true });
  const vendido = n.vendido ? c(n.vendido) : 0;
  for (let k = 2; k <= 10; k++) {
    if (vendido) out.push({ centavos: Math.round(vendido / k), como: 'parcela', parcela: 'em ' + k + 'x do vendido', confiavel: false });
    out.push({ centavos: Math.round(aberto / k), como: 'parcela', parcela: 'em ' + k + 'x do aberto', confiavel: false });
  }
  return out.filter(a => a.centavos > 0);
}

/** As datas em que as próximas duplicatas cairiam: a última paga + o intervalo das pagas (ou 30 dias), até 10 vezes. */
function datasEsperadas(n: NotaEmAberto): number[] {
  const pagos = (n.pagos || []).map(p => dia(p.data)).sort((a, b) => a - b);
  if (!pagos.length) return [];
  const passo = pagos.length > 1 ? Math.max(7, Math.round((pagos[pagos.length - 1] - pagos[0]) / (pagos.length - 1))) : 30;
  return Array.from({ length: 10 }, (_, i) => pagos[pagos.length - 1] + passo * (i + 1));
}

/**
 * As sugestões de baixa de uma nota em aberto (Vitor, 15/10/2026: "olhe as datas das duplicatas já pagas, observe as
 * descrições dos bancos para não indicar coisa errada; divida a duplicata em aberto em 1 a 10x; pode ter multa e juros,
 * então valores aproximados"). sentido: +1 = entra (cliente), −1 = sai (fornecedor). O lançamento do banco que já é a
 * baixa de uma parcela paga (mesmo valor, até 3 dias da data dela) fica de fora.
 * Para não indicar coisa errada: o total exato vale sozinho; a parcela que já foi paga antes, também; o resto (a divisão
 * em 2 a 10x, os juros e o desconto) só com o nome do participante no histórico.
 */
export function sugestoesDeBaixa(nota: NotaEmAberto, nome: string, lancamentos: readonly LancamentoDoBanco[], sentido: 1 | -1, limite = 5): SugestaoDeBaixa[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nota.data)) return [];
  const alvos = alvosDa(nota);
  if (!alvos.length) return [];
  const palavras = palavrasDoNome(nome);
  const d0 = dia(nota.data);
  const esperadas = datasEsperadas(nota);
  const jaPagos = (nota.pagos || []).map(p => ({ d: dia(p.data), c: Math.round(Math.abs(p.valor) * 100) }));
  const achados: (SugestaoDeBaixa & { nota: number; dist: number })[] = [];
  for (const l of lancamentos) {
    if (Math.sign(l.valor) !== sentido || ehDepositoDeCheque(l.historico)) continue;
    const dl = dia(l.data);
    if (dl - d0 < -DIAS_ANTES || dl - d0 > DIAS_DEPOIS) continue;
    const v = Math.abs(l.valor);
    // já é a baixa de uma parcela paga
    if (jaPagos.some(p => p.c === v && Math.abs(p.d - dl) <= 3)) continue;
    const h = ' ' + normalizarTexto(l.historico) + ' ';
    const mesmoNome = palavras.some(p => h.includes(' ' + p + ' '));
    // o melhor alvo para este valor
    let melhor: { a: Alvo; como: ComoBate; exato: boolean } | null = null;
    for (const a of alvos) {
      const exato = Math.abs(v - a.centavos) <= 1;
      const juros = !exato && v > a.centavos && v <= a.centavos * (1 + JUROS);
      const desconto = !exato && v < a.centavos && v >= a.centavos * (1 - DESCONTO);
      if (!exato && !juros && !desconto) continue;
      // sem o nome no histórico, só o total exato ou a parcela igual à já paga
      if (!mesmoNome && !(exato && a.confiavel)) continue;
      const como: ComoBate = exato ? a.como : juros ? 'juros' : 'desconto';
      const peso = (x: { a: Alvo; exato: boolean }) => (x.exato ? 2 : 0) + (x.a.como === 'total' ? 1 : 0) + (x.a.confiavel ? 1 : 0);
      if (!melhor || peso({ a, exato }) > peso(melhor)) melhor = { a, como, exato };
    }
    if (!melhor) continue;
    const dataEsperada = esperadas.some(e => Math.abs(e - dl) <= FOLGA_DA_DATA);
    const nota_ = (melhor.exato ? 4 : 1) + (melhor.a.como === 'total' ? 2 : 0) + (melhor.a.confiavel ? 1 : 0) + (mesmoNome ? 3 : 0) + (dataEsperada ? 2 : 0);
    achados.push({
      ...l, mesmoValor: melhor.exato && melhor.a.como === 'total', mesmoNome, como: melhor.como,
      parcela: melhor.a.como === 'parcela' ? melhor.a.parcela : '', dataEsperada, nota: nota_, dist: Math.abs(dl - d0),
    });
  }
  return achados.sort((a, b) => b.nota - a.nota || a.dist - b.dist).slice(0, limite).map(({ nota: _n, dist: _d, ...x }) => x);
}

/**
 * A baixa aceita de uma nota em aberto (Vitor, 15/10/2026: "um botãozinho para, quando o usuário mudar ou aceitar a
 * sugestão, ficar Ok"): o lançamento do banco escolhido, guardado na marca do participante pela chave do item.
 */
export type BaixaAceita = LancamentoDoBanco;

/** O mesmo lançamento do banco (a data, o valor, o histórico e o banco). */
export function mesmoLancamento(a: LancamentoDoBanco, b: LancamentoDoBanco): boolean {
  return a.data === b.data && a.valor === b.valor && a.historico === b.historico && a.banco === b.banco;
}

/**
 * Aceita (sim) ou desfaz (não) um lançamento do banco como baixa de um item. A nota pode ter mais de uma (Vitor, 15/10/2026:
 * "se tiver saldo ainda, não mude para Ok, apenas diminua aquele valor aceito"). Sem nenhuma, undefined.
 */
export function comBaixa(baixas: Readonly<Record<string, readonly BaixaAceita[]>> | undefined, chave: string, l: LancamentoDoBanco, sim: boolean): Record<string, BaixaAceita[]> | undefined {
  const n: Record<string, BaixaAceita[]> = Object.fromEntries(Object.entries(baixas || {}).map(([k, v]) => [k, [...v]]));
  const daNota = (n[chave] || []).filter(b => !mesmoLancamento(b, l));
  if (sim) daNota.push({ data: l.data, valor: l.valor, historico: l.historico, banco: l.banco, ...(l.marca ? { marca: l.marca } : {}) });
  if (daNota.length) n[chave] = daNota; else delete n[chave];
  return Object.keys(n).length ? n : undefined;
}

/** O que falta da nota em aberto (em centavos) depois das baixas aceitas; 0 = quitada (o que passa é juros/multa). */
export function faltaDaNota(aberto: number, aceitas: readonly LancamentoDoBanco[] | undefined): number {
  const falta = Math.round(Math.abs(aberto) * 100) - (aceitas || []).reduce((t, b) => t + Math.abs(b.valor), 0);
  return falta > 1 ? falta : 0;
}

const baixaGuardada = (v: Record<string, unknown> | null | undefined): BaixaAceita | null =>
  v && typeof v.data === 'string' && typeof v.valor === 'number' && typeof v.historico === 'string' && typeof v.banco === 'string'
    ? { data: v.data, valor: v.valor, historico: v.historico, banco: v.banco, ...(typeof v.marca === 'string' && v.marca ? { marca: v.marca } : {}) }
    : null;

/** As baixas guardadas, conferidas (o que não tiver o formato, fora; a de antes, uma só, vira lista). */
export function baixasGuardadas(d: unknown): Record<string, BaixaAceita[]> | undefined {
  if (!d || typeof d !== 'object') return undefined;
  const n: Record<string, BaixaAceita[]> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    const lista = (Array.isArray(v) ? v : [v]).map(x => baixaGuardada(x as Record<string, unknown>)).filter((x): x is BaixaAceita => !!x);
    if (lista.length) n[k] = lista;
  }
  return Object.keys(n).length ? n : undefined;
}

export interface SeloDaSugestao { texto: string; tom: 'ok' | 'neutral' | 'warn'; dica: string }

/** Os selos da Situação de uma sugestão: como o valor bate, a parcela, a data esperada e o nome. quem: "cliente"/"fornecedor". */
export function selosDaSugestao(g: SugestaoDeBaixa, quem: string): SeloDaSugestao[] {
  const out: SeloDaSugestao[] = [];
  if (g.mesmoValor) out.push({ texto: 'Mesmo valor', tom: 'ok', dica: 'O valor em aberto da nota' });
  const k = /^em (\d+)x do (vendido|aberto)$/.exec(g.parcela);
  const igual = /^como a de (.+)$/.exec(g.parcela);
  if (igual) out.push({ texto: 'Igual à de ' + igual[1], tom: 'ok', dica: 'O valor da parcela já paga em ' + igual[1] });
  else if (k) out.push({ texto: (k[2] === 'vendido' ? 'Parcela ' : 'Aberto em ') + k[1] + 'x', tom: 'neutral', dica: (k[2] === 'vendido' ? 'O valor da nota' : 'O que falta') + ' dividido em ' + k[1] + 'x' });
  if (g.como === 'juros') out.push({ texto: 'Com juros/multa', tom: 'warn', dica: 'Até 10% a mais' });
  if (g.como === 'desconto') out.push({ texto: 'Com desconto', tom: 'warn', dica: 'Até 3% a menos' });
  if (g.dataEsperada) out.push({ texto: 'Data esperada', tom: 'neutral', dica: 'Perto de quando a próxima parcela cairia, pelo ritmo das já pagas' });
  if (g.mesmoNome) out.push({ texto: 'Mesmo nome', tom: 'neutral', dica: 'O nome do ' + quem + ' aparece no histórico' });
  return out;
}
