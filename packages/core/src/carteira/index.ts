// A Carteira (12/11/2026: "cada funcionário vai registrar sua comissão, ter seu controle financeiro pessoal (individual);
// o cara do financeiro pode upar o holerite e o comprovante de pagamento, aparecendo pra pessoa"): o dashboard do
// salário e das finanças de cada pessoa e o controle das comissões, resumido para o Financeiro pagar.
// Só a lógica (sem tela e sem banco). Por enquanto só o Vitor usa; os outros veem o botão e a tela "em desenvolvimento".
import { rotuloDoVinculo, type ContaAPagar, type TipoDoVinculo } from '../financeiro/contasPagar';

/** Quem já usa a Carteira (12/11/2026: "deixe essa nova função apenas para o Vítor disponível"): pelo primeiro nome. */
export const LIBERADA_PARA: readonly string[] = ['vitor'];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function liberadaPara(nome: string | null | undefined): boolean {
  const primeiro = semAcento(String(nome || '')).split(/\s+/)[0] || '';
  return LIBERADA_PARA.includes(primeiro);
}

// ── comissões ───────────────────────────────────────────────────────────────

/** lançada pela pessoa → aprovada pelo Financeiro → paga (ou recusada, com o motivo) */
export type SituacaoDaComissao = 'lancada' | 'aprovada' | 'paga' | 'recusada';

export const SITUACOES_DA_COMISSAO: readonly { valor: SituacaoDaComissao; rotulo: string }[] = [
  { valor: 'lancada', rotulo: 'Lançada' },
  { valor: 'aprovada', rotulo: 'Aprovada' },
  { valor: 'paga', rotulo: 'Paga' },
  { valor: 'recusada', rotulo: 'Recusada' },
];

export const rotuloDaSituacao = (s: SituacaoDaComissao) => SITUACOES_DA_COMISSAO.find(x => x.valor === s)?.rotulo ?? s;

export interface Comissao {
  id: string;
  /** de quem é (usuarios/{uid}) */
  uid: string;
  nome: string;
  /** o mês em que entra para pagamento, AAAA-MM */
  competencia: string;
  /** o dia da venda/serviço, AAAA-MM-DD */
  data: string;
  /** o cliente ou a empresa (texto livre) */
  cliente: string;
  descricao: string;
  valor: number;
  situacao: SituacaoDaComissao;
  criadoEm: string;
  /** a decisão do Financeiro (aprovar, recusar, pagar): quem, quando e o motivo da recusa */
  decididoPor?: string;
  decididoEm?: string;
  motivo?: string;
  pagoEm?: string;
}

export interface ComissaoParaSalvar { competencia: string; data: string; cliente: string; descricao: string; valor: number }

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** O que está errado na comissão (lista vazia = pode salvar). */
export function conferirComissao(c: ComissaoParaSalvar): string[] {
  const erros: string[] = [];
  if (!COMPETENCIA.test(c.competencia)) erros.push('Escolha o mês do pagamento.');
  if (!DATA.test(c.data)) erros.push('Informe a data.');
  if (!c.cliente.trim()) erros.push('Informe o cliente.');
  if (!c.descricao.trim()) erros.push('Descreva a comissão.');
  if (!(c.valor > 0)) erros.push('O valor precisa ser maior que zero.');
  if (c.valor >= 1_000_000) erros.push('Confira o valor: passa de R$ 1 milhão.');
  if (c.cliente.length > 150 || c.descricao.length > 500) erros.push('O texto está grande demais.');
  return erros;
}

/** A pessoa só mexe na comissão enquanto ela está lançada (depois de aprovada, só o Financeiro). */
export const podeEditar = (c: Comissao) => c.situacao === 'lancada';

const r2 = (n: number) => Math.round(n * 100) / 100;
const soma = (xs: readonly number[]) => r2(xs.reduce((s, x) => s + x, 0));

export interface TotaisDasComissoes { lancadas: number; aprovadas: number; pagas: number; recusadas: number; total: number; quantas: number }

export function totaisDasComissoes(lista: readonly Comissao[]): TotaisDasComissoes {
  const de = (s: SituacaoDaComissao) => soma(lista.filter(c => c.situacao === s).map(c => c.valor));
  const lancadas = de('lancada'), aprovadas = de('aprovada'), pagas = de('paga'), recusadas = de('recusada');
  return { lancadas, aprovadas, pagas, recusadas, total: r2(lancadas + aprovadas + pagas), quantas: lista.filter(c => c.situacao !== 'recusada').length };
}

/** Para o Financeiro pagar: por pessoa, no mês, o que está aprovado (a pagar), o que falta revisar e o que já foi pago. */
export interface ResumoParaPagar { uid: string; nome: string; aRevisar: number; aPagar: number; pagas: number; quantas: number; ids: { aprovadas: string[]; lancadas: string[] } }

export function resumoParaPagar(lista: readonly Comissao[]): ResumoParaPagar[] {
  const porPessoa = new Map<string, Comissao[]>();
  for (const c of lista) porPessoa.set(c.uid, [...(porPessoa.get(c.uid) || []), c]);
  return [...porPessoa.entries()].map(([uid, cs]) => {
    const t = totaisDasComissoes(cs);
    return {
      uid, nome: cs[0].nome, aRevisar: t.lancadas, aPagar: t.aprovadas, pagas: t.pagas, quantas: t.quantas,
      ids: { aprovadas: cs.filter(c => c.situacao === 'aprovada').map(c => c.id), lancadas: cs.filter(c => c.situacao === 'lancada').map(c => c.id) },
    };
  }).sort((a, b) => b.aPagar - a.aPagar || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ── finanças pessoais ───────────────────────────────────────────────────────

export type TipoDeLancamento = 'entrada' | 'saida';

export interface Lancamento {
  id: string;
  tipo: TipoDeLancamento;
  /** AAAA-MM-DD */
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
}
export type LancamentoParaSalvar = Omit<Lancamento, 'id'>;

export const CATEGORIAS: Record<TipoDeLancamento, readonly string[]> = {
  entrada: ['Salário', 'Comissão', 'Extra', 'Outros'],
  saida: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Contas', 'Cartão', 'Outros'],
};

export function conferirLancamento(l: LancamentoParaSalvar): string[] {
  const erros: string[] = [];
  if (!DATA.test(l.data)) erros.push('Informe a data.');
  if (!l.descricao.trim()) erros.push('Descreva o lançamento.');
  if (!(l.valor > 0)) erros.push('O valor precisa ser maior que zero.');
  if (l.valor >= 10_000_000) erros.push('Confira o valor.');
  if (l.descricao.length > 200 || l.categoria.length > 40) erros.push('O texto está grande demais.');
  return erros;
}

export interface ResumoDasFinancas { entradas: number; saidas: number; saldo: number; porCategoria: { categoria: string; valor: number; parte: number }[] }

/** O mês (AAAA-MM) das finanças: entradas, saídas, o saldo e onde o dinheiro foi (as saídas por categoria, maior primeiro). */
export function resumoDasFinancas(lista: readonly Lancamento[], competencia: string): ResumoDasFinancas {
  const doMes = lista.filter(l => l.data.slice(0, 7) === competencia);
  const entradas = soma(doMes.filter(l => l.tipo === 'entrada').map(l => l.valor));
  const saidas = soma(doMes.filter(l => l.tipo === 'saida').map(l => l.valor));
  const cats = new Map<string, number>();
  for (const l of doMes) if (l.tipo === 'saida') cats.set(l.categoria || 'Outros', r2((cats.get(l.categoria || 'Outros') || 0) + l.valor));
  const porCategoria = [...cats.entries()].map(([categoria, valor]) => ({ categoria, valor, parte: saidas ? valor / saidas : 0 })).sort((a, b) => b.valor - a.valor);
  return { entradas, saidas, saldo: r2(entradas - saidas), porCategoria };
}

// ── holerites e comprovantes ────────────────────────────────────────────────

export type TipoDeDocumento = 'holerite' | 'comprovante';

export interface DocumentoDaCarteira {
  id: string;
  /** de quem é */
  uid: string;
  nome: string;
  tipo: TipoDeDocumento;
  /** o mês a que se refere, AAAA-MM */
  competencia: string;
  /** o valor líquido (holerite) ou pago (comprovante), quando o Financeiro informa */
  valor: number | null;
  arquivo: string;
  tamanho: number;
  partes: number;
  enviadoEm: string;
  enviadoPor: string;
}

export const rotuloDoDocumento = (t: TipoDeDocumento) => (t === 'holerite' ? 'Holerite' : 'Comprovante de pagamento');

/** Até quanto o arquivo do holerite ou do comprovante pode ter (sobe em pedaços pelo banco, como os anexos das contas). */
export const LIMITE_DO_DOCUMENTO = 10 * 1024 * 1024;

/** O salário do mês: o valor do holerite daquele mês (o mais novo, se tiver dois); null = não informado. */
export function salarioDoMes(docs: readonly DocumentoDaCarteira[], competencia: string): number | null {
  const h = docs.filter(d => d.tipo === 'holerite' && d.competencia === competencia && d.valor != null).sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))[0];
  return h ? h.valor : null;
}

// ── meses ───────────────────────────────────────────────────────────────────

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const competenciaDe = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

/** "novembro de 2026" */
export function mesPorExtenso(c: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(c);
  return m ? MESES[Number(m[2]) - 1] + ' de ' + m[1] : c;
}

/** Os últimos n meses, do atual para trás (para os seletores e o histórico). */
export function ultimosMeses(hoje: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => competenciaDe(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)));
}

/** O histórico dos meses para o gráfico do painel: o salário, as comissões (sem as recusadas) e o saldo das finanças. */
export function historico(meses: readonly string[], comissoes: readonly Comissao[], lancamentos: readonly Lancamento[], docs: readonly DocumentoDaCarteira[]) {
  return [...meses].reverse().map(c => ({
    competencia: c,
    salario: salarioDoMes(docs, c) ?? 0,
    comissoes: totaisDasComissoes(comissoes.filter(x => x.competencia === c)).total,
    saldo: resumoDasFinancas(lancamentos, c).saldo,
  }));
}

// ── o que o Financeiro pagou à pessoa (as contas a pagar ligadas a ela) ─────

export interface PagamentoNaCarteira {
  /** o id da conta a pagar */
  id: string;
  tipo: TipoDoVinculo;
  rotulo: string;
  /** o mês do vencimento, AAAA-MM */
  competencia: string;
  vencimento: string;
  valor: number;
  pago: boolean;
  pagoEm: string | null;
  valorPago: number | null;
  /** os comprovantes anexados na conta (o boleto não aparece para a pessoa) */
  comprovantes: { id: string; nome: string; tamanho: number }[];
}

/** As contas ligadas à pessoa, do vencimento mais novo para o mais velho. */
export function pagamentosDaCarteira(contas: readonly ContaAPagar[], uid: string): PagamentoNaCarteira[] {
  return contas.filter(c => c.funcionario?.uid === uid).map(c => ({
    id: c.id, tipo: c.funcionario!.tipo, rotulo: rotuloDoVinculo(c.funcionario!.tipo) + (c.documento ? ' · ' + c.documento : ''),
    competencia: c.vencimento.slice(0, 7), vencimento: c.vencimento, valor: c.valor,
    pago: !!c.pagamento, pagoEm: c.pagamento?.data ?? null, valorPago: c.pagamento?.valorPago ?? null,
    comprovantes: c.anexos.filter(a => a.tipo === 'comprovante').map(a => ({ id: a.id, nome: a.nome, tamanho: a.tamanho })),
  })).sort((a, b) => b.vencimento.localeCompare(a.vencimento));
}

/** O que o escritório pagou à pessoa no mês (o pago, pelo valor pago) e o que ainda está para pagar. */
export function recebidoNoMes(pags: readonly PagamentoNaCarteira[], competencia: string): { recebido: number; aReceber: number } {
  const doMes = pags.filter(p => (p.pagoEm ?? p.vencimento).slice(0, 7) === competencia);
  return {
    recebido: soma(doMes.filter(p => p.pago).map(p => p.valorPago ?? p.valor)),
    aReceber: soma(doMes.filter(p => !p.pago).map(p => p.valor)),
  };
}
