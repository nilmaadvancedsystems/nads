// As contas a pagar do escritório (28/10/2026: "o Contas a Pagar do Toriba, no nads"): os fornecedores (com a conta do
// plano que já vem na conta), as contas (fornecedor, conta contábil, documento, emissão, vencimento, valor), o pagamento
// (data, valor pago, juros, desconto; vira a saída no Caixa), a recorrência ("cria as parcelas na hora": uma por mês, no
// mesmo dia), os anexos (o boleto e o comprovante), a situação (Em aberto, Vencida, Paga, pelas datas), o aviso de
// vencimento do Painel e o relatório em planilha. Puro: sem banco e sem tela.
// O banco é financeiroFornecedores/{id} e financeiroContasPagar/{id} (apps/web/.../dados/contasPagar.firestore.ts).
import { dataValida, type ContaDoPlano } from './index';
import { xlsxDeLinhas, type CelulaDoDemonstrativo } from './demonstrativo';

export interface Fornecedor {
  /** os que vieram do Toriba: toriba-<n> */
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  /** CNPJ ou CPF, só os dígitos ('' se não tem) */
  documento: string;
  /** a conta do plano que vem preenchida na conta a pagar (o id da ContaDoPlano; os do Toriba podem trazer a classificação) */
  contaPadrao?: string;
  ativo: boolean;
  criadoEm?: string;
  criadoPor?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export type TipoDeAnexo = 'boleto' | 'comprovante';

export interface AnexoDaConta {
  id: string;
  tipo: TipoDeAnexo;
  nome: string;
  /** em bytes */
  tamanho: number;
  /** em quantos pedaços os bytes estão no banco */
  partes: number;
  enviadoEm: string;
  enviadoPor: string;
}

export interface PagamentoDaConta {
  /** AAAA-MM-DD */
  data: string;
  valorPago: number;
  juros: number;
  desconto: number;
  /** a saída que o pagamento criou no Caixa */
  lancamentoId?: string;
  por: string;
  em: string;
}

/** as parcelas criadas juntas (a "Despesa recorrente" do Toriba): o mesmo grupo, a parcela k de N */
export interface RecorrenciaDaConta { grupo: string; parcela: number; de: number }

export interface ContaAPagar {
  id: string;
  /** o ID da tela (1, 2, 3…), como o do Toriba */
  numero: number;
  fornecedorId: string;
  /** o id da ContaDoPlano (a conta contábil) */
  conta?: string;
  /** o número do documento (a nota, o boleto) */
  documento: string;
  /** AAAA-MM-DD */
  emissao: string;
  vencimento: string;
  valor: number;
  /** só os dígitos */
  linhaDigitavel?: string;
  observacoes?: string;
  recorrencia?: RecorrenciaDaConta;
  pagamento?: PagamentoDaConta;
  anexos: AnexoDaConta[];
  /** o Auditor do Toriba: quem lançou e quando */
  lancadoEm: string;
  lancadoPor: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export type SituacaoDaConta = 'aberta' | 'vencida' | 'paga';
export const SITUACOES_DA_CONTA: { valor: SituacaoDaConta; rotulo: string; tom: 'warn' | 'bad' | 'ok' }[] = [
  { valor: 'aberta', rotulo: 'Em aberto', tom: 'warn' },
  { valor: 'vencida', rotulo: 'Vencida', tom: 'bad' },
  { valor: 'paga', rotulo: 'Paga', tom: 'ok' },
];
export const rotuloDaSituacao = (s: SituacaoDaConta) => SITUACOES_DA_CONTA.find(x => x.valor === s)?.rotulo ?? s;

/** Paga (tem pagamento), Vencida (o vencimento já passou) ou Em aberto (vence hoje ou depois). */
export function situacaoDaConta(c: Pick<ContaAPagar, 'vencimento' | 'pagamento'>, hoje: string): SituacaoDaConta {
  return c.pagamento ? 'paga' : c.vencimento < hoje ? 'vencida' : 'aberta';
}

/** o anexo passa de 10 MB: não sobe (os bytes ficam no banco, em pedaços) */
export const LIMITE_DO_ANEXO = 10 * 1024 * 1024;
/** a recorrência vai até 60 parcelas (5 anos) */
export const MAX_PARCELAS = 60;

const emCentavos = (v: number) => Math.round(v * 100);
const p2 = (n: number) => String(n).padStart(2, '0');
const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/**
 * Os vencimentos das n parcelas: o primeiro e um por mês depois, no mesmo dia; no mês que não tem o dia, o último dia
 * (31/01 → 28/02 → 31/03: o dia é sempre o do primeiro, não o do mês anterior).
 */
export function vencimentosDaRecorrencia(primeiro: string, n: number): string[] {
  if (!dataValida(primeiro) || !(n >= 1)) return [];
  const a = Number(primeiro.slice(0, 4)), m = Number(primeiro.slice(5, 7)), d = Number(primeiro.slice(8, 10));
  const datas: string[] = [];
  for (let k = 0; k < Math.floor(n); k++) {
    const total = a * 12 + (m - 1) + k;
    const ano = Math.floor(total / 12), mes = (total % 12) + 1;
    datas.push(`${ano}-${p2(mes)}-${p2(Math.min(d, ultimoDia(ano, mes)))}`);
  }
  return datas;
}

/** O que está errado na conta (vazio = pode gravar); `parcelas` só na conta nova com a recorrência ligada. */
export function conferirContaAPagar(c: Pick<ContaAPagar, 'fornecedorId' | 'emissao' | 'vencimento' | 'valor'>, parcelas?: number): string[] {
  const erros: string[] = [];
  if (!c.fornecedorId) erros.push('Escolha o fornecedor.');
  if (c.emissao && !dataValida(c.emissao)) erros.push('Confira a data de emissão.');
  if (!dataValida(c.vencimento)) erros.push('Informe um vencimento válido.');
  if (!Number.isFinite(c.valor) || c.valor <= 0) erros.push('O valor precisa ser maior que zero.');
  if (parcelas != null && (!Number.isInteger(parcelas) || parcelas < 2 || parcelas > MAX_PARCELAS)) erros.push(`A quantidade de recorrência vai de 2 a ${MAX_PARCELAS}.`);
  return erros;
}

/** O valor pago que a tela sugere: o valor da conta mais os juros, menos o desconto. */
export const valorComJuros = (valor: number, juros: number, desconto: number) => (emCentavos(valor) + emCentavos(juros || 0) - emCentavos(desconto || 0)) / 100;

/** O que está errado no pagamento. */
export function conferirPagamento(p: Pick<PagamentoDaConta, 'data' | 'valorPago' | 'juros' | 'desconto'>): string[] {
  const erros: string[] = [];
  if (!dataValida(p.data)) erros.push('Informe a data do pagamento.');
  if (!Number.isFinite(p.valorPago) || p.valorPago <= 0) erros.push('O valor pago precisa ser maior que zero.');
  if (!Number.isFinite(p.juros) || p.juros < 0) erros.push('Os juros não podem ser negativos.');
  if (!Number.isFinite(p.desconto) || p.desconto < 0) erros.push('O desconto não pode ser negativo.');
  return erros;
}

/** O que está errado no fornecedor (o CNPJ/CPF é opcional, mas com 11 ou 14 dígitos). */
export function conferirFornecedor(f: Pick<Fornecedor, 'razaoSocial' | 'nomeFantasia' | 'documento'>): string[] {
  const erros: string[] = [];
  if ((f.razaoSocial || f.nomeFantasia || '').trim().length < 2) erros.push('Informe a razão social ou o nome fantasia.');
  const d = (f.documento || '').replace(/\D/g, '');
  if (d && d.length !== 11 && d.length !== 14) erros.push('O CNPJ tem 14 dígitos e o CPF, 11.');
  return erros;
}

/** Como o fornecedor aparece na tela: o nome fantasia, ou a razão social. */
export const nomeDoFornecedor = (f: Pick<Fornecedor, 'razaoSocial' | 'nomeFantasia'> | undefined) => (f ? (f.nomeFantasia || '').trim() || (f.razaoSocial || '').trim() : '');

/** A conta do plano que o fornecedor traz: pelo id ou, nos que vieram do Toriba, pela classificação (4.1.01). */
export function contaPadraoDoFornecedor(f: Pick<Fornecedor, 'contaPadrao'> | undefined, plano: readonly ContaDoPlano[]): string {
  const x = (f?.contaPadrao || '').trim();
  if (!x) return '';
  return (plano.find(c => c.id === x) || plano.find(c => c.codigo === x))?.id ?? '';
}

/** "parcela 2 de 12" ('' fora da recorrência) */
export const rotuloDaParcela = (r: RecorrenciaDaConta | undefined) => (r ? `parcela ${r.parcela} de ${r.de}` : '');

/** A descrição da saída no Caixa: "PAG FORNECEDOR DOC 123 2/12". */
export function descricaoDoPagamento(fornecedor: string, documento: string, r?: RecorrenciaDaConta): string {
  return ['PAG', (fornecedor || 'FORNECEDOR').trim().toUpperCase(), documento.trim() ? 'DOC ' + documento.trim() : '', r ? `${r.parcela}/${r.de}` : ''].filter(Boolean).join(' ');
}

/** O próximo ID (1 mais o maior que existe). */
export const proximoNumero = (contas: readonly Pick<ContaAPagar, 'numero'>[]) => contas.reduce((m, c) => Math.max(m, c.numero || 0), 0) + 1;

/** A ordem da lista: o vencimento, depois o ID. */
export const porVencimento = (a: ContaAPagar, b: ContaAPagar) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero;

export type PeriodoDasContas = 'este-mes' | 'proximo-mes' | 'mes-passado' | 'este-ano' | 'tudo';
export const PERIODOS_DAS_CONTAS: { valor: PeriodoDasContas; rotulo: string }[] = [
  { valor: 'este-mes', rotulo: 'Este mês' },
  { valor: 'proximo-mes', rotulo: 'Próximo mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
  { valor: 'este-ano', rotulo: 'Este ano' },
  { valor: 'tudo', rotulo: 'Todas as datas' },
];

/** O primeiro e o último dia do período, pelo vencimento: o mês inteiro (as contas que ainda vão vencer contam); 'tudo' é vazio. */
export function periodoDasContas(qual: PeriodoDasContas, hoje: string): { de: string; ate: string } {
  const a = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7));
  if (qual === 'tudo') return { de: '', ate: '' };
  if (qual === 'este-ano') return { de: `${a}-01-01`, ate: `${a}-12-31` };
  const total = a * 12 + (m - 1) + (qual === 'proximo-mes' ? 1 : qual === 'mes-passado' ? -1 : 0);
  const ano = Math.floor(total / 12), mes = (total % 12) + 1;
  return { de: `${ano}-${p2(mes)}-01`, ate: `${ano}-${p2(mes)}-${p2(ultimoDia(ano, mes))}` };
}

export type FiltroDeSituacao = 'todas' | SituacaoDaConta;

export interface FiltroDasContas {
  /** AAAA-MM-DD, pelo vencimento; vazio = sem limite */
  de: string;
  ate: string;
  /** o id do fornecedor; vazio = todos */
  fornecedor: string;
  /** o id da conta do plano; vazio = todas */
  conta: string;
  situacao: FiltroDeSituacao;
  busca: string;
}

/** O texto da busca: o ID, o fornecedor, o documento, o valor e as observações. */
export function textoDaConta(c: ContaAPagar, fornecedor: string): string {
  return [String(c.numero), fornecedor, c.documento, c.valor.toFixed(2).replace('.', ','), c.observacoes ?? ''].join(' ').toLowerCase();
}

/** As contas que passam pelo filtro, por vencimento; `nomeDe` dá o nome do fornecedor (para a busca). */
export function filtrarContas(contas: readonly ContaAPagar[], f: FiltroDasContas, hoje: string, nomeDe: (id: string) => string): ContaAPagar[] {
  const q = f.busca.trim().toLowerCase();
  return contas.filter(c => (!f.de || c.vencimento >= f.de) && (!f.ate || c.vencimento <= f.ate)
    && (!f.fornecedor || c.fornecedorId === f.fornecedor) && (!f.conta || c.conta === f.conta)
    && (f.situacao === 'todas' || situacaoDaConta(c, hoje) === f.situacao)
    && (!q || textoDaConta(c, nomeDe(c.fornecedorId)).includes(q))).sort(porVencimento);
}

export interface TotaisDasContas {
  quantas: number;
  /** a soma dos valores das contas */
  valor: number;
  /** o que já se pagou (os valores pagos) */
  pago: number;
  /** o valor das que não estão pagas (em aberto e vencidas) */
  aPagar: number;
  /** o valor das vencidas */
  vencido: number;
}

/** Os totais das contas listadas, em centavos e de volta (sem o erro de vírgula). */
export function totaisDasContas(contas: readonly ContaAPagar[], hoje: string): TotaisDasContas {
  let valor = 0, pago = 0, aPagar = 0, vencido = 0;
  for (const c of contas) {
    const s = situacaoDaConta(c, hoje);
    valor += emCentavos(c.valor);
    if (s === 'paga') pago += emCentavos(c.pagamento!.valorPago);
    else { aPagar += emCentavos(c.valor); if (s === 'vencida') vencido += emCentavos(c.valor); }
  }
  return { quantas: contas.length, valor: valor / 100, pago: pago / 100, aPagar: aPagar / 100, vencido: vencido / 100 };
}

export interface AvisoDeVencimento {
  /** as não pagas que já venceram, da mais velha para a mais nova */
  vencidas: ContaAPagar[];
  /** as que vencem hoje */
  hoje: ContaAPagar[];
  /** as que vencem nos próximos dias (amanhã até hoje + dias) */
  proximas: ContaAPagar[];
  totalVencido: number;
  totalDaSemana: number;
}

const maisDias = (iso: string, n: number) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);

/** O aviso do Painel: as vencidas, as de hoje e as dos próximos `dias` (7), só as não pagas. */
export function avisoDeVencimento(contas: readonly ContaAPagar[], hoje: string, dias = 7): AvisoDeVencimento {
  const limite = maisDias(hoje, dias);
  const abertas = contas.filter(c => !c.pagamento).sort(porVencimento);
  const vencidas = abertas.filter(c => c.vencimento < hoje);
  const deHoje = abertas.filter(c => c.vencimento === hoje);
  const proximas = abertas.filter(c => c.vencimento > hoje && c.vencimento <= limite);
  const soma = (xs: ContaAPagar[]) => xs.reduce((s, c) => s + emCentavos(c.valor), 0) / 100;
  return { vencidas, hoje: deHoje, proximas, totalVencido: soma(vencidas), totalDaSemana: soma([...deHoje, ...proximas]) };
}

// ---------- o relatório em planilha (28/10/2026: "o relatório com os filtros e exportar Excel") ----------

export const CABECALHO_DAS_CONTAS = ['ID', 'Fornecedor', 'Documento', 'Conta contábil', 'Emissão', 'Vencimento', 'Valor', 'Situação', 'Pago em', 'Valor pago', 'Juros', 'Desconto', 'Parcela', 'Observações'] as const;

const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

export interface LinhaDoRelatorio { conta: ContaAPagar; fornecedor: string; contaDoPlano?: ContaDoPlano }

/** O nome do arquivo: "Contas a pagar AAAA-MM-DD a AAAA-MM-DD.xlsx" (sem período: "Contas a pagar.xlsx"). */
export const nomeDaPlanilhaDasContas = (de: string, ate: string) => (de || ate ? `Contas a pagar ${de || 'início'} a ${ate || 'fim'}.xlsx` : 'Contas a pagar.xlsx');

/** As linhas da planilha: o título, o que está filtrando, o cabeçalho, uma linha por conta e os totais. */
export function linhasDasContas(itens: readonly LinhaDoRelatorio[], hoje: string, filtros: string): CelulaDoDemonstrativo[][] {
  const t = totaisDasContas(itens.map(i => i.conta), hoje);
  const corpo = itens.map(({ conta: c, fornecedor, contaDoPlano: p }): CelulaDoDemonstrativo[] => [
    // o ID como texto: na planilha todo número sai em R$
    String(c.numero), fornecedor, c.documento, p ? `${p.codigo} ${p.descricao}` : '', dataBr(c.emissao), dataBr(c.vencimento), c.valor,
    rotuloDaSituacao(situacaoDaConta(c, hoje)), c.pagamento ? dataBr(c.pagamento.data) : '', c.pagamento ? c.pagamento.valorPago : '',
    c.pagamento?.juros || '', c.pagamento?.desconto || '', c.recorrencia ? `${c.recorrencia.parcela}/${c.recorrencia.de}` : '', c.observacoes ?? '',
  ]);
  return [
    ['Contas a pagar'],
    [filtros],
    [],
    [...CABECALHO_DAS_CONTAS],
    ...corpo,
    [],
    ['', 'Total', '', '', '', '', t.valor, '', '', t.pago],
    ['', 'A pagar', '', '', '', '', t.aPagar],
    ['', 'Vencido', '', '', '', '', t.vencido],
  ];
}

/** O .xlsx das contas listadas (aba "Contas a pagar"), com os valores em R$. */
export function planilhaDasContas(itens: readonly LinhaDoRelatorio[], hoje: string, filtros: string): Uint8Array {
  return xlsxDeLinhas(linhasDasContas(itens, hoje, filtros), 'Contas a pagar', [6, 34, 14, 30, 11, 11, 14, 11, 11, 14, 12, 12, 8, 36]);
}
