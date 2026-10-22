// O financeiro do escritório (19/10/2026: "o Movimento de Caixa e o Plano de Contas do Toriba, no nads"): os lançamentos
// do caixa (entrada E / saída S), o plano de contas em árvore e a contagem de cédulas. Puro: sem banco e sem tela.
// O banco é financeiroCaixa/{id} e financeiroPlano/{id} (apps/web/.../dados/caixa.firestore.ts).

export type TipoDeLancamento = 'E' | 'S';
export type OrigemDoLancamento = 'toriba' | 'nads';

export interface LancamentoDeCaixa {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  descricao: string;
  /** sempre positivo; quem diz se entra ou sai é o tipo */
  valor: number;
  tipo: TipoDeLancamento;
  observacoes?: string;
  /** o id da ContaDoPlano */
  conta?: string;
  origem: OrigemDoLancamento;
  /** o ID que o lançamento tinha no Toriba (os importados) */
  toribaId?: number;
  criadoEm: string;
  criadoPor: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export type TipoDeConta = 'ATIVO' | 'PASSIVO' | 'PATRIMONIO_LIQUIDO' | 'RECEITA' | 'DESPESA' | 'OUTROS';
export const TIPOS_DE_CONTA: { valor: TipoDeConta; rotulo: string }[] = [
  { valor: 'ATIVO', rotulo: 'Ativo' },
  { valor: 'PASSIVO', rotulo: 'Passivo' },
  { valor: 'PATRIMONIO_LIQUIDO', rotulo: 'Patrimônio líquido' },
  { valor: 'RECEITA', rotulo: 'Receita' },
  { valor: 'DESPESA', rotulo: 'Despesa' },
  { valor: 'OUTROS', rotulo: 'Outros' },
];
export const rotuloDoTipoDeConta = (t: TipoDeConta) => TIPOS_DE_CONTA.find(x => x.valor === t)?.rotulo ?? t;

export interface ContaDoPlano {
  id: string;
  /** a classificação, como 4.1.01 */
  codigo: string;
  descricao: string;
  tipo: TipoDeConta;
  /** 1 para a raiz (4), 2 para 4.1, 3 para 4.1.01… */
  nivel: number;
  /** o id da conta pai (null na raiz) */
  pai: string | null;
  ativo: boolean;
  /** aceita lançamento (as contas de baixo; as de cima só agrupam) */
  movimentavel: boolean;
}

const emCentavos = (v: number) => Math.round(v * 100);
/** soma sem o erro de vírgula flutuante: em centavos e de volta */
const somaDe = (valores: number[]) => valores.reduce((s, v) => s + emCentavos(v), 0) / 100;
const assinado = (l: Pick<LancamentoDeCaixa, 'valor' | 'tipo'>) => (l.tipo === 'E' ? l.valor : -l.valor);

/** O saldo antes da data: entradas menos saídas dos lançamentos estritamente anteriores a ela. */
export function saldoAte(lancamentos: LancamentoDeCaixa[], data: string): number {
  return somaDe(lancamentos.filter(l => l.data < data).map(assinado));
}

export interface ResumoDoPeriodo {
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  /** os do período (de e ate inclusive), por data e depois por id */
  lancamentos: LancamentoDeCaixa[];
}

const compararIds = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });
/** a ordem do caixa: data, depois id (com os números na ordem natural) */
export const porDataEId = (a: LancamentoDeCaixa, b: LancamentoDeCaixa) => (a.data < b.data ? -1 : a.data > b.data ? 1 : compararIds(a.id, b.id));

/** O período de `de` até `ate` (inclusive): o saldo inicial (antes de `de`), as entradas, as saídas, o saldo final e as linhas. */
export function resumoDoPeriodo(lancamentos: LancamentoDeCaixa[], de: string, ate: string): ResumoDoPeriodo {
  const doPeriodo = lancamentos.filter(l => l.data >= de && l.data <= ate).sort(porDataEId);
  const entradas = somaDe(doPeriodo.filter(l => l.tipo === 'E').map(l => l.valor));
  const saidas = somaDe(doPeriodo.filter(l => l.tipo === 'S').map(l => l.valor));
  const saldoInicial = saldoAte(lancamentos, de);
  return { saldoInicial, entradas, saidas, saldoFinal: somaDe([saldoInicial, entradas, -saidas]), lancamentos: doPeriodo };
}

/** As notas e moedas da contagem de cédulas, da maior para a menor (em reais). */
export const CEDULAS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.01] as const;

/** O total da contagem: `quantidades` é a quantidade de cada valor (chave = o valor, como "0.5"). Quantidade inválida ou negativa conta zero. */
export function totalDasCedulas(quantidades: Record<string, number>): number {
  let centavos = 0;
  for (const c of CEDULAS) {
    const q = Number(quantidades[String(c)]);
    if (Number.isFinite(q) && q > 0) centavos += emCentavos(c) * Math.floor(q);
  }
  return centavos / 100;
}

export interface NoDoPlano { conta: ContaDoPlano; filhos: NoDoPlano[] }

/** Compara classificações como 4.1.2 e 4.1.10 pelos números (não pelas letras). */
export const compararCodigos = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });

/** A árvore do plano: pelo campo `pai`, filhos por código. Conta cujo pai não existe vira raiz. */
export function arvoreDoPlano(contas: ContaDoPlano[]): NoDoPlano[] {
  const nos = new Map<string, NoDoPlano>(contas.map(c => [c.id, { conta: c, filhos: [] }]));
  const raizes: NoDoPlano[] = [];
  for (const no of nos.values()) {
    const pai = no.conta.pai ? nos.get(no.conta.pai) : undefined;
    (pai && pai !== no ? pai.filhos : raizes).push(no);
  }
  const ordenar = (lista: NoDoPlano[]) => { lista.sort((a, b) => compararCodigos(a.conta.codigo, b.conta.codigo)); for (const n of lista) ordenar(n.filhos); };
  ordenar(raizes);
  return raizes;
}

/** A árvore em linha (a ordem de desenhar), cada conta com a fundura. */
export function planoEmLinhas(contas: ContaDoPlano[]): { conta: ContaDoPlano; fundo: number }[] {
  const saida: { conta: ContaDoPlano; fundo: number }[] = [];
  const descer = (lista: NoDoPlano[], fundo: number) => { for (const n of lista) { saida.push({ conta: n.conta, fundo }); descer(n.filhos, fundo + 1); } };
  descer(arvoreDoPlano(contas), 0);
  return saida;
}

/** AAAA-MM-DD que existe de verdade (30/02 não passa). */
export function dataValida(d: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const [a, me, di] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const x = new Date(Date.UTC(a, me - 1, di));
  return x.getUTCFullYear() === a && x.getUTCMonth() === me - 1 && x.getUTCDate() === di;
}

/** O que está errado no lançamento (vazio = pode gravar). */
export function conferirLancamento(l: Pick<LancamentoDeCaixa, 'data' | 'descricao' | 'valor' | 'tipo'>): string[] {
  const erros: string[] = [];
  if (!dataValida(l.data)) erros.push('Informe uma data válida.');
  if ((l.descricao || '').trim().length < 2) erros.push('Descreva o lançamento (pelo menos 2 letras).');
  if (!Number.isFinite(l.valor) || l.valor <= 0) erros.push('O valor precisa ser maior que zero.');
  if (l.tipo !== 'E' && l.tipo !== 'S') erros.push('Escolha Entrada ou Saída.');
  return erros;
}

/** O que está errado na conta do plano. */
export function conferirConta(c: Pick<ContaDoPlano, 'codigo' | 'descricao'>): string[] {
  const erros: string[] = [];
  if (!/^\d+(\.\d+)*$/.test(c.codigo.trim())) erros.push('A classificação é feita de números separados por ponto (como 4.1.01).');
  if (c.descricao.trim().length < 2) erros.push('Descreva a conta (pelo menos 2 letras).');
  return erros;
}

/** O nível pela classificação (4 → 1, 4.1 → 2, 4.1.01 → 3). */
export const nivelDoCodigo = (codigo: string) => codigo.trim().split('.').length;

/** A busca do caixa: descrição, observações, valor e a conta (código e nome). */
export function textoDoLancamento(l: LancamentoDeCaixa, conta?: ContaDoPlano): string {
  return [l.descricao, l.observacoes ?? '', l.valor.toFixed(2).replace('.', ','), conta ? conta.codigo + ' ' + conta.descricao : ''].join(' ').toLowerCase();
}

/** O primeiro e o último dia dos períodos prontos (hoje = AAAA-MM-DD). */
export function periodoPronto(qual: 'este-mes' | 'mes-passado' | 'este-ano', hoje: string): { de: string; ate: string } {
  const a = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7));
  const p2 = (n: number) => String(n).padStart(2, '0');
  const ultimo = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (qual === 'este-ano') return { de: `${a}-01-01`, ate: hoje };
  if (qual === 'este-mes') return { de: `${a}-${p2(m)}-01`, ate: hoje };
  const [ano, mes] = m === 1 ? [a - 1, 12] : [a, m - 1];
  return { de: `${ano}-${p2(mes)}-01`, ate: `${ano}-${p2(mes)}-${p2(ultimo(ano, mes))}` };
}

export * from './demonstrativo';
export * from './calculadora';
export * from './honorarios';
export * from './painel';
