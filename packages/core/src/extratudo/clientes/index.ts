// @nads/core/clientes — a etapa Clientes da Tarefa (Vitor, 06/10/2026): o balancete e o balancete dinâmico (o saldo de
// cada conta mês a mês), as contas de cliente com saldo credor (corrigir primeiro), a relação de todas com a situação
// (Pendente = o valor devedor, Ok = zerado, Conferido = vai para o cliente, com a observação) e a planilha e a mensagem
// para o cliente responder. Os conferidos passam para o mês seguinte. TypeScript puro: quem chama guarda o estado.
import * as XLSX from 'xlsx';
import { normalizarTexto } from '../../formatos';
import type { Conta } from '../../conferencia/tipos';
import type { LadoDaConta, RazaoDaMarca } from './razao';
import { baixasGuardadas, faltaDaNota, type BaixaAceita } from './sugestaoDeBaixa';
import { chaveDoItem } from './razao';

export * from './razao';

// ─── o balancete dinâmico ────────────────────────────────────────────────────

/** Uma conta do balancete dinâmico: o saldo anterior e o saldo de cada mês (positivo = devedor no Ativo). */
export interface LinhaDinamico { codigo: string; classificacao: string; descricao: string; saldoAnterior: number; saldos: Record<string, number> }
export interface BalanceteDinamico { meses: string[]; linhas: LinhaDinamico[] }

const numero = (v: unknown): number => {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  // "1234.56" (o Alterdata exporta com ponto) ou "1.234,56"
  const n = /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** As linhas da planilha (a primeira aba) → o balancete dinâmico. O cabeçalho: Código, Classificação, Descrição, Saldo Anterior e os meses (MM/AAAA). */
export function lerBalanceteDinamico(rows: readonly (readonly unknown[])[]): BalanceteDinamico {
  const baixo = (c: unknown) => normalizarTexto(String(c ?? ''));
  const h = rows.findIndex(r => r.some(c => baixo(c) === 'classificacao') && r.some(c => baixo(c) === 'codigo'));
  if (h < 0) throw new Error('Não achei o cabeçalho do balancete dinâmico (Código, Classificação, Descrição).');
  const head = rows[h].map(c => String(c ?? '').trim());
  const col = (nome: string) => head.findIndex(c => baixo(c) === nome);
  const cCod = col('codigo'), cCla = col('classificacao'), cDes = col('descricao'), cAnt = col('saldo anterior');
  const meses = head.map((c, i) => { const m = /^(\d{2})\/(\d{4})$/.exec(c); return m ? { i, mes: m[2] + '-' + m[1] } : null; }).filter((x): x is { i: number; mes: string } => !!x);
  if (!meses.length) throw new Error('O balancete dinâmico não tem as colunas dos meses (MM/AAAA).');
  const linhas: LinhaDinamico[] = [];
  for (const r of rows.slice(h + 1)) {
    const codigo = String(r[cCod] ?? '').trim();
    if (!codigo) continue;
    linhas.push({
      codigo, classificacao: String(r[cCla] ?? '').trim(), descricao: String(r[cDes] ?? '').trim(),
      saldoAnterior: cAnt >= 0 ? numero(r[cAnt]) : 0,
      saldos: Object.fromEntries(meses.map(m => [m.mes, numero(r[m.i])])),
    });
  }
  return { meses: meses.map(m => m.mes), linhas };
}

/** Os clientes fictícios do balancete dinâmico de teste (o ⚡ do modo desenvolvedor): nome e saldo no mês. */
const CLIENTES_DE_TESTE: [string, number][] = [
  ['MERCADO BOM PRECO LTDA', 1250.4], ['ANA PAULA SOUZA', 0], ['CONSTRUTORA ALFA LTDA', 8730], ['PADARIA DO JOAO', 312.9],
  ['JOSE CARLOS PEREIRA', 0], ['FARMACIA SAUDE LTDA', 2045.15], ['AUTO PECAS CENTRAL', 0], ['ESCOLA PEQUENO SABER', 640],
];

/** Os fornecedores fictícios (o ⚡ na etapa Fornecedores): nome e o que a empresa deve no mês. */
const FORNECEDORES_DE_TESTE: [string, number][] = [
  ['DISTRIBUIDORA NORTE LTDA', 4380.25], ['EMBALAGENS SAO JOSE', 0], ['ATACADAO DO GRAO LTDA', 12750], ['TRANSPORTES RAPIDO', 890.4],
  ['GRAFICA CENTRAL ME', 0], ['FRIGORIFICO BOA CARNE', 6210.8], ['ENERGIA E GAS LTDA', 0], ['LATICINIOS SERRA AZUL', 1540],
];

/**
 * Um balancete dinâmico de teste com o mês (e o anterior): os clientes (ou fornecedores) fictícios; com o saldo errado,
 * dois deles ficam do lado errado (o cliente credor, o fornecedor devedor). Os valores com o sinal do Alterdata
 * (devedor positivo, credor negativo).
 */
export function dinamicoDeTeste(mes: string, comCredores: boolean, lado: LadoDaConta = 'clientes'): BalanceteDinamico {
  const [a, m] = mes.split('-').map(Number);
  const antes = m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0');
  const [cod, cla, nome, lista] = lado === 'clientes' ? ['100', '1.1.2.01', 'CLIENTES', CLIENTES_DE_TESTE] : ['320', '2.1.1.01', 'FORNECEDORES', FORNECEDORES_DE_TESTE];
  const linhas: LinhaDinamico[] = [{ codigo: cod, classificacao: cla, descricao: nome, saldoAnterior: 0, saldos: {} }];
  lista.forEach(([n, saldo], i) => {
    const valor = comCredores && (i === 1 || i === 4) ? -(150 + i * 35.5) : saldo;
    linhas.push({ codigo: String(+cod + 1 + i), classificacao: cla + '.' + String(i + 1).padStart(3, '0'), descricao: n, saldoAnterior: 0, saldos: { [antes]: noLado(lado, saldo), [mes]: noLado(lado, valor) } });
  });
  linhas[0].saldos = { [antes]: linhas.slice(1).reduce((t, l) => t + (l.saldos[antes] ?? 0), 0), [mes]: linhas.slice(1).reduce((t, l) => t + (l.saldos[mes] ?? 0), 0) };
  return { meses: [antes, mes], linhas };
}

// ─── as contas de cliente ────────────────────────────────────────────────────

/** Uma conta de cliente: o saldo no mês (positivo = devedor, negativo = credor) e o do balancete atual, quando veio. */
export interface ContaDeCliente { codigo: string; nome: string; saldo: number; noBalancete: number | null }

const SECAO: Record<LadoDaConta, RegExp> = {
  clientes: /^(clientes?|duplicatas? a receber|contas? a receber)\b/,
  // no Passivo (2…): a sintética FORNECEDORES (o "Adiantamento a fornecedores" do Ativo não entra)
  fornecedores: /^(fornecedores?|duplicatas? a pagar|contas? a pagar)\b/,
};

/**
 * O saldo visto do lado do cliente: positivo = o normal da conta, negativo = o errado (o cliente credor, o fornecedor
 * devedor). O dinâmico do Alterdata traz devedor positivo e credor negativo; no fornecedor, troca o sinal.
 */
const noLado = (lado: LadoDaConta, v: number) => (lado === 'clientes' ? v : -v);

/**
 * As contas de cliente (ou de fornecedor) do dinâmico no mês: as analíticas debaixo da sintética (pela classificação).
 * No fornecedor, o saldo vem com o sinal trocado: positivo = a empresa deve, negativo = o fornecedor devedor.
 */
export function clientesDoDinamico(d: BalanceteDinamico, mes: string, lado: LadoDaConta = 'clientes'): ContaDeCliente[] {
  const secoes = d.linhas.filter(l => SECAO[lado].test(normalizarTexto(l.descricao)) && l.classificacao && (lado === 'clientes' || l.classificacao.startsWith('2')));
  const tem = (l: LinhaDinamico) => d.linhas.some(o => o !== l && o.classificacao.startsWith(l.classificacao + '.'));
  return d.linhas
    .filter(l => secoes.some(s => l.classificacao.startsWith(s.classificacao + '.')) && !tem(l))
    .map(l => ({ codigo: l.codigo, nome: l.descricao.replace(/\s+/g, ' '), saldo: noLado(lado, l.saldos[mes] ?? 0), noBalancete: null }));
}

/** O nome da conta de adiantamento no dinâmico: "Adiantamento(s) a fornecedor(es)", "Adto. de clientes"… */
export const ADIANTAMENTO: Record<LadoDaConta, RegExp> = {
  fornecedores: /^(adiant\w*|adto) (a |de |p |para |ao |aos )?fornecedor/,
  clientes: /^(adiant\w*|adto) (a |de |p |para |do |dos )?client/,
};

/**
 * Os meses do período em que o dinâmico tem adiantamento a fornecedores (ou de clientes) (Vitor, 15/10/2026: "observe o
 * balancete se há adiantamento a fornecedores; a 58 não tem, então não coloque como etapa"; "faz no adiantamento de
 * clientes também"): alguma conta de adiantamento com saldo no mês ou no mês de antes (o adiantamento baixado no mês).
 * Só os meses que o dinâmico tem.
 */
export function adiantamentoNoDinamico(d: BalanceteDinamico, meses: readonly string[], de: LadoDaConta): { cobertos: string[]; com: string[] } {
  return mesesComSaldo(d, meses, d.linhas.filter(l => ADIANTAMENTO[de].test(normalizarTexto(l.descricao))));
}

/**
 * Os meses do período em que o dinâmico tem empréstimo ou financiamento (Vitor, 15/10/2026: "da mesma forma de
 * empréstimo, tire ele daqui"): no Passivo (classificação 2…), alguma conta "Empréstimos" ou "Financiamentos" com saldo
 * no mês ou no de antes. O "Empréstimo a sócios" do Ativo e os juros (despesa) não contam. Olha as analíticas debaixo
 * dela: o cheque especial não é empréstimo (Vitor, 15/10/2026), e a sintética o somaria.
 */
export function emprestimosNoDinamico(d: BalanceteDinamico, meses: readonly string[]): { cobertos: string[]; com: string[] } {
  const folha = (l: LinhaDinamico) => !d.linhas.some(o => o !== l && o.classificacao.startsWith(l.classificacao + '.'));
  return mesesComSaldo(d, meses, d.linhas.filter(l => folha(l) && emprestimoBancario(d, l)));
}

const BANCO_NO_NOME = /\b(banco|bco|sicoob|sicredi|bradesco|itau|santander|nubank|inter|c6|btg|cora|stone|pagbank|pagseguro|mercado pago|caixa economica|cef|bnb|bb|bndes|unicred|cresol|safra|banrisul)\b/;

/**
 * A conta é de empréstimo ou financiamento bancário? (Vitor, 19/10/2026: "empréstimos de terceiros e mútuos não entram em
 * Empréstimos e financiamentos, apenas empréstimos bancários"). No Passivo, debaixo de (ou ela mesma) "Empréstimos" ou
 * "Financiamentos"; com o banco no nome (ou "bancário" no grupo), ou financiamento, Finame, CDC, capital de giro. Fora: de
 * terceiros, mútuo, de sócios, coligadas, pessoa física e o cheque especial.
 */
export function emprestimoBancario(d: BalanceteDinamico, l: LinhaDinamico): boolean {
  if (!l.classificacao.startsWith('2')) return false;
  const n = normalizarTexto(l.descricao);
  if (/\b(terceiros?|mutuo|mutuos|socios?|coligad\w*|controlad\w*|ligad\w*|pessoa fisica|particular\w*|cheque especial)\b/.test(n)) return false;
  const acima = d.linhas.filter(g => g === l || l.classificacao.startsWith(g.classificacao + '.'));
  if (!acima.some(g => /^(emprestimos?|financiamentos?)\b/.test(normalizarTexto(g.descricao)))) return false;
  return BANCO_NO_NOME.test(n) || acima.some(g => /\bbancari\w*/.test(normalizarTexto(g.descricao)))
    || /\b(financiament\w*|finame|cdc|capital de giro|consorcio)\b/.test(n);
}

/** A conta do adiantamento salarial no dinâmico ("Adiantamento Salarial", "Adto. de salários", "Adiantamento a empregados"). */
export const ADIANTAMENTO_SALARIAL = /^(adiant\w*|adto) (salarial|de salarios?|salarios?|a empregados|a funcionarios|de funcionarios)\b/;

/** As contas de adiantamento salarial do dinâmico (a analítica: o código vai no lançamento sugerido). */
export function contasDeAdiantamentoSalarial(d: BalanceteDinamico): LinhaDinamico[] {
  return d.linhas.filter(l => ADIANTAMENTO_SALARIAL.test(normalizarTexto(l.descricao)));
}

/**
 * Os meses do período em que o dinâmico tem o adiantamento salarial com saldo (Vitor, 16/10/2026: "contas que eu queria que
 * você colocasse no check de acordo com o balancete"): no mês ou no de antes. O certo é zerar no mês; com saldo, a etapa entra.
 */
export function adiantamentoSalarialNoDinamico(d: BalanceteDinamico, meses: readonly string[]): { cobertos: string[]; com: string[] } {
  return mesesComSaldo(d, meses, contasDeAdiantamentoSalarial(d));
}

/**
 * De que é a conta do razão importado (Vitor, 16/10/2026: o upload único dos razões, na Importação): pelo nome dela no
 * dinâmico, a etapa que usa o razão. O código vem do nome da aba do XLS do Alterdata.
 */
export type TipoDoRazao = 'caixa' | 'salarios' | 'fgts' | 'inss' | 'prolabore' | 'honorarios' | 'simples' | 'adiantamento-salarial'
  | 'adiantamento-fornecedores' | 'adiantamento-clientes' | 'emprestimo' | 'cliente' | 'fornecedor';

export const NOME_DO_TIPO_DO_RAZAO: Record<TipoDoRazao, string> = {
  caixa: 'Caixa', salarios: 'Salários a pagar', fgts: 'FGTS a recolher', inss: 'INSS a recolher', prolabore: 'Pró-labore a pagar',
  honorarios: 'Honorários a pagar', simples: 'Simples Nacional a recolher', 'adiantamento-salarial': 'Adiantamento salarial',
  'adiantamento-fornecedores': 'Adiantamento a fornecedores', 'adiantamento-clientes': 'Adiantamento de clientes',
  emprestimo: 'Empréstimos e financiamentos', cliente: 'Clientes', fornecedor: 'Fornecedores',
};

const PELO_NOME: [TipoDoRazao, RegExp][] = [
  ['caixa', /^caixa\b/],
  ['salarios', /^salarios?\b.*\ba pagar\b/],
  ['fgts', /^fgts\b.*\b(a recolher|a pagar)\b/],
  ['inss', /^inss\b.*\b(a recolher|a pagar)\b/],
  ['prolabore', /^(pro labore|prolabore|retiradas?)\b.*\ba pagar\b/],
  ['honorarios', /^honorarios?\b.*\ba pagar\b/],
  ['simples', /^(simples nacional|das)\b.*\ba recolher\b/],
];

/** O tipo da conta (o código do razão) pelo dinâmico; null = conta que nenhuma etapa usa (ou fora do dinâmico). */
export function tipoDoRazao(d: BalanceteDinamico, codigo: string): TipoDoRazao | null {
  const l = d.linhas.find(x => x.codigo === codigo);
  if (!l) return null;
  const n = normalizarTexto(l.descricao);
  if (ADIANTAMENTO_SALARIAL.test(n)) return 'adiantamento-salarial';
  if (ADIANTAMENTO.fornecedores.test(n)) return 'adiantamento-fornecedores';
  if (ADIANTAMENTO.clientes.test(n)) return 'adiantamento-clientes';
  for (const [tipo, re] of PELO_NOME) if (re.test(n)) return tipo === 'caixa' && !l.classificacao.startsWith('1') ? null : tipo;
  const mes = d.meses[d.meses.length - 1] || '';
  if (clientesDoDinamico(d, mes, 'clientes').some(c => c.codigo === codigo)) return 'cliente';
  if (clientesDoDinamico(d, mes, 'fornecedores').some(c => c.codigo === codigo)) return 'fornecedor';
  // só o bancário (Vitor, 19/10/2026: terceiros e mútuos não entram)
  if (emprestimoBancario(d, l)) return 'emprestimo';
  return null;
}

/** Os tipos que a Importação pede o razão, na ordem das etapas (os clientes e os fornecedores ficam na etapa deles). */
export const TIPOS_DE_RAZAO_PEDIDOS: readonly TipoDoRazao[] = [
  'caixa', 'adiantamento-fornecedores', 'adiantamento-salarial', 'adiantamento-clientes', 'emprestimo', 'salarios', 'inss', 'fgts', 'prolabore', 'honorarios', 'simples',
];

export interface RazaoPedido { codigo: string; nome: string; tipo: TipoDoRazao }

/**
 * Os razões que a Tarefa precisa (Vitor, 19/10/2026: "especifique quais razões você quer"): as contas analíticas do
 * dinâmico que alguma etapa usa (Caixa, Salários, FGTS, INSS…), com saldo ou movimento no período, na ordem das etapas.
 */
export function razoesPedidos(d: BalanceteDinamico): RazaoPedido[] {
  const sintetica = (l: LinhaDinamico) => !!l.classificacao && d.linhas.some(x => x !== l && x.classificacao.startsWith(l.classificacao + '.'));
  const mexe = (l: LinhaDinamico) => Math.abs(l.saldoAnterior) >= 0.005 || d.meses.some(m => Math.abs(l.saldos[m] || 0) >= 0.005);
  const out: RazaoPedido[] = [];
  for (const l of d.linhas) {
    if (!l.codigo || sintetica(l) || !mexe(l)) continue;
    const tipo = tipoDoRazao(d, l.codigo);
    if (tipo && TIPOS_DE_RAZAO_PEDIDOS.includes(tipo)) out.push({ codigo: l.codigo, nome: l.descricao, tipo });
  }
  return out.sort((a, b) => TIPOS_DE_RAZAO_PEDIDOS.indexOf(a.tipo) - TIPOS_DE_RAZAO_PEDIDOS.indexOf(b.tipo) || a.codigo.localeCompare(b.codigo));
}

/** Uma conta do resultado do lado errado: a despesa credora ou a receita devedora, e os meses (o saldo, sem o sinal). */
export interface ContaDoResultadoErrada {
  codigo: string; classificacao: string; nome: string; tipo: 'despesa' | 'receita';
  meses: { mes: string; saldo: number }[];
}

/**
 * Despesas credoras e receitas devedoras no dinâmico (Vitor, 16/10/2026: "despesas/receitas na mesma tela, o sistema só vai
 * conferir no balancete dinâmico se tem despesas credoras e receitas devedoras"). As analíticas debaixo do grupo das
 * receitas e do de custos e despesas (pelo nome do grupo de cima; sem ele, o 3 e o 4 do plano do Alterdata); as redutoras
 * "(-)" (deduções, devoluções), na conta ou no grupo dela, ficam de fora: o lado delas é o contrário.
 */
export function resultadoErradoNoDinamico(d: BalanceteDinamico, meses: readonly string[]): ContaDoResultadoErrada[] {
  const topo = (re: RegExp, padrao: string) => d.linhas.find(l => l.classificacao && !l.classificacao.includes('.') && re.test(normalizarTexto(l.descricao)))?.classificacao || padrao;
  const grupos = { receita: topo(/^receitas?\b/, '3'), despesa: topo(/^(custos?|despesas?)\b/, '4') };
  const debaixo = (l: LinhaDinamico, g: string) => l.classificacao.startsWith(g + '.');
  const folha = (l: LinhaDinamico) => !d.linhas.some(o => o !== l && o.classificacao.startsWith(l.classificacao + '.'));
  // a redutora: "(-)" ou dedução/devolução no nome dela ou de um grupo de cima
  const redutora = (l: LinhaDinamico) => d.linhas.some(o => (o === l || l.classificacao.startsWith(o.classificacao + '.'))
    && (/^\s*\(\s*-\s*\)/.test(o.descricao) || /\b(deduc\w*|devoluc\w*|recuperac\w*)\b/.test(normalizarTexto(o.descricao))));
  const cobertos = meses.filter(m => d.meses.includes(m));
  const out: ContaDoResultadoErrada[] = [];
  for (const l of d.linhas) {
    const tipo = debaixo(l, grupos.receita) ? 'receita' as const : debaixo(l, grupos.despesa) ? 'despesa' as const : null;
    if (!tipo || !folha(l) || redutora(l)) continue;
    // no dinâmico: devedor positivo, credor negativo
    const errados = cobertos.map(m => ({ mes: m, saldo: l.saldos[m] ?? 0 }))
      .filter(x => (tipo === 'receita' ? x.saldo > 0.005 : x.saldo < -0.005));
    if (errados.length) out.push({ codigo: l.codigo, classificacao: l.classificacao, nome: l.descricao.replace(/\s+/g, ' '), tipo, meses: errados.map(x => ({ mes: x.mes, saldo: Math.abs(x.saldo) })) });
  }
  return out;
}

/** Os meses que o dinâmico cobre e, deles, os em que alguma das contas tem saldo no mês ou no de antes. */
function mesesComSaldo(d: BalanceteDinamico, meses: readonly string[], contas: readonly LinhaDinamico[]): { cobertos: string[]; com: string[] } {
  const antes = (m: string) => { const [a, x] = m.split('-').map(Number); return x === 1 ? (a - 1) + '-12' : a + '-' + String(x - 1).padStart(2, '0'); };
  const saldo = (l: LinhaDinamico, m: string) => (m in l.saldos ? l.saldos[m] : m < (d.meses[0] || '') ? l.saldoAnterior : 0);
  const cobertos = meses.filter(m => d.meses.includes(m));
  return { cobertos, com: cobertos.filter(m => contas.some(l => !zero(saldo(l, m)) || !zero(saldo(l, antes(m))))) };
}

/** Um cliente que ficou credor em algum mês: o saldo de cada mês (positivo = devedor, negativo = credor). */
export interface CredorNoPeriodo { codigo: string; nome: string; saldos: { mes: string; saldo: number }[] }

/**
 * Os clientes credores em algum mês do dinâmico até o mês da etapa (Vitor, 07/10/2026: "tem alguns que estão
 * credores em alguns meses, depois ficam devedor"), com o saldo mês a mês; na ordem do dinâmico.
 */
export function credoresNoPeriodo(d: BalanceteDinamico, ateMes: string, lado: LadoDaConta = 'clientes'): CredorNoPeriodo[] {
  const meses = d.meses.filter(m => m <= ateMes);
  const clientes = new Set(clientesDoDinamico(d, ateMes, lado).map(c => c.codigo));
  return d.linhas
    .filter(l => clientes.has(l.codigo))
    .map(l => ({ codigo: l.codigo, nome: l.descricao.replace(/\s+/g, ' '), saldos: meses.map(m => ({ mes: m, saldo: noLado(lado, l.saldos[m] ?? 0) })) }))
    .filter(c => c.saldos.some(x => x.saldo < 0 && !zero(x.saldo)));
}

/** O saldo de cada cliente no balancete atual (o do Alterdata: D positivo, C negativo). */
export function comBalancete(clientes: readonly ContaDeCliente[], balancete: Record<string, Conta>): ContaDeCliente[] {
  return clientes.map(c => {
    const b = balancete[c.codigo];
    return { ...c, noBalancete: b ? (b.dc === 'C' ? -b.valor : b.valor) : null };
  });
}

const zero = (v: number) => Math.abs(v) < 0.005;

/** Os clientes com saldo credor (no mês do dinâmico ou no balancete atual): a prioridade, corrigir antes. */
export function credores(clientes: readonly ContaDeCliente[]): ContaDeCliente[] {
  return clientes.filter(c => (c.saldo < 0 && !zero(c.saldo)) || (c.noBalancete != null && c.noBalancete < 0 && !zero(c.noBalancete)));
}

// ─── a situação de cada um ───────────────────────────────────────────────────

/**
 * Pendente (o saldo, em laranja), Conferido (vai para o cliente, com a observação; laranja também) ou Ok (a conta zerada).
 * Todos do sistema: o Ok é a conta zerada (Vitor, 06/10/2026: "o Ok é só o sistema que dá") e o Conferido, o razão que
 * achou o que perguntar (Vitor, 07/10/2026: sem o conferido manual).
 */
export type SituacaoCliente = 'pendente' | 'ok' | 'conferido';

/** O que a pessoa marcou (guardado no mês): a situação, a observação e, com o razão importado, as notas em aberto. */
export interface MarcaDoCliente {
  nome: string; saldo: number; situacao: SituacaoCliente;
  /** a observação digitada de antes (a tela não escreve mais: no lugar, o que perguntar) */
  obs?: string;
  razao?: RazaoDaMarca;
  /** o que vai para o cliente: as chaves dos itens da relação (chaveDoItem); sem = o cliente todo; [] = nada */
  perguntar?: string[];
  /** as notas em aberto com a baixa no banco (as sugestões aceitas): a chave do item → os lançamentos do banco */
  baixas?: Record<string, BaixaAceita[]>;
  /** as sugestões recusadas de cada nota (Vitor, 15/10/2026: "a opção de recusa também"): não aparecem mais nela */
  recusadas?: Record<string, BaixaAceita[]>;
}
export interface DocClientes {
  contas: Record<string, MarcaDoCliente>; atualizadoEm?: string;
  /** o que já foi mandado pelo Mandei neste mês (assinaturaDoEnvio): mudou depois, tem de mandar de novo */
  enviado?: string;
}

/**
 * A assinatura do que vai para o cliente (Vitor, 08/10/2026: "a partir do momento que a pessoa upa e quer questionar,
 * bloqueie o avançar"): cada conta com as linhas adicionadas no +, em ordem. Igual à guardada = já mandado. '' = nada.
 */
export function assinaturaDoEnvio(linhas: readonly { codigo: string; perguntar?: readonly string[] }[]): string {
  return linhas.filter(l => l.perguntar?.length).map(l => l.codigo + '=' + [...(l.perguntar || [])].sort().join(',')).sort().join(';');
}

/**
 * Zerado é Ok (sempre, do sistema): no dinâmico, ou no razão importado (Vitor, 07/10/2026: "se ele reupar o razão e
 * tiver zerado, dá Ok automático"); com saldo, Conferido só se o razão importado achou nota em aberto ou pagamento solto
 * (Vitor, 07/10/2026: "remova o conferido manual"), senão Pendente. A situação guardada na marca não decide mais nada.
 */
export function situacaoDe(c: ContaDeCliente, marca?: MarcaDoCliente): SituacaoCliente {
  if (zero(c.saldo) || zeradoNoRazao(marca) || quitadoPelasBaixas(marca)) return 'ok';
  return razaoComPendencia(marca?.razao) ? 'conferido' : 'pendente';
}

/**
 * As baixas aceitas zeraram o que o razão achou (Vitor, 15/10/2026: "se o cara aceitar e zerar o valor do cliente, ao
 * invés de Conferido, coloca um Ok"): tinha nota em aberto, e todas ficaram quitadas, sem pagamento solto.
 */
export function quitadoPelasBaixas(marca?: MarcaDoCliente): boolean {
  return !!marca?.razao && !!marca.baixas && razaoComPendencia(marca.razao) && !razaoComPendencia(marca.razao, marca.baixas);
}

/**
 * O razão importado achou o que perguntar: nota em aberto ou pagamento solto (sem a nota, ou a mais). A duplicidade, que
 * é só do escritório, e a devolução sozinha não contam.
 */
export function razaoComPendencia(razao?: RazaoDaMarca, baixas?: Readonly<Record<string, readonly BaixaAceita[]>>): boolean {
  // a nota quitada pelas baixas aceitas não conta
  const quitada = (i: RazaoDaMarca['itens'][number]) => !!baixas?.[chaveDoItem(i)]?.length && faltaDaNota(i.valor, baixas[chaveDoItem(i)]) === 0;
  return !!razao?.itens.some(i => !i.interno && ((i.status === 'aberto' && !quitada(i)) || i.status === 'pagamento'));
}

/** O razão importado fecha em zero, sem nota em aberto. */
export function zeradoNoRazao(marca?: MarcaDoCliente): boolean {
  // a relação só de digitados não diz que a conta zerou
  return !!marca?.razao && !marca.razao.manual && zero(marca.razao.saldo) && !marca.razao.notas.length;
}

/** O documento guardado conferido (o que não for de cliente, fora). */
export function docDoDocumento(d: unknown): DocClientes {
  const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const contas = (o.contas && typeof o.contas === 'object' ? o.contas : {}) as Record<string, Record<string, unknown>>;
  const certo: Record<string, MarcaDoCliente> = {};
  for (const [k, v] of Object.entries(contas)) {
    const s = v?.situacao;
    if (s !== 'pendente' && s !== 'ok' && s !== 'conferido') continue;
    const r = razaoGuardado(v.razao);
    const perguntar = Array.isArray(v.perguntar) ? (v.perguntar as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const baixas = baixasGuardadas(v.baixas);
    const recusadas = baixasGuardadas(v.recusadas);
    certo[k] = {
      nome: String(v.nome ?? ''), saldo: typeof v.saldo === 'number' ? v.saldo : 0, situacao: s, ...(typeof v.obs === 'string' && v.obs ? { obs: v.obs } : {}), ...(r ? { razao: r } : {}),
      ...(Array.isArray(v.perguntar) ? { perguntar } : {}), ...(baixas ? { baixas } : {}), ...(recusadas ? { recusadas } : {}),
    };
  }
  return { contas: certo, ...(typeof o.atualizadoEm === 'string' ? { atualizadoEm: o.atualizadoEm } : {}), ...(typeof o.enviado === 'string' && o.enviado ? { enviado: o.enviado } : {}) };
}

/** O razão guardado na marca, conferido (o que não tiver o formato, fora). */
function razaoGuardado(d: unknown): RazaoDaMarca | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  if (typeof o.arquivo !== 'string' || !Array.isArray(o.notas)) return null;
  const notas = (o.notas as Record<string, unknown>[]).filter(n => n && typeof n.nf === 'string' && typeof n.aberto === 'number')
    .map(n => ({ nf: n.nf as string, data: typeof n.data === 'string' ? n.data : '', aberto: n.aberto as number }));
  return {
    arquivo: o.arquivo, notas, saldo: typeof o.saldo === 'number' ? o.saldo : 0,
    devolucoes: typeof o.devolucoes === 'number' ? o.devolucoes : 0,
    duplicadas: Array.isArray(o.duplicadas) ? o.duplicadas.filter((x): x is string => typeof x === 'string') : [],
    // o recebimento que zerou o saldo anterior, guardado antes: conciliado, nem aparece (Vitor, 15/10/2026)
    itens: Array.isArray(o.itens) ? (o.itens as Record<string, unknown>[]).filter(i => i && typeof i.descricao === 'string' && typeof i.valor === 'number' && i.status !== 'anterior')
      .map(i => ({
        data: typeof i.data === 'string' ? i.data : '', nf: typeof i.nf === 'string' ? i.nf : '', descricao: i.descricao as string, valor: i.valor as number,
        ...(i.interno === true ? { interno: true } : {}),
        ...(i.digitado === true ? { digitado: true } : {}),
        ...(typeof i.conta === 'string' && i.conta ? { conta: i.conta } : {}),
        ...(typeof i.vendido === 'number' ? { vendido: i.vendido } : {}),
        ...(Array.isArray(i.pagos) ? { pagos: (i.pagos as Record<string, unknown>[]).filter(p => p && typeof p.data === 'string' && typeof p.valor === 'number').map(p => ({ data: p.data as string, valor: p.valor as number })) } : {}),
        status: i.status === 'aberto' || i.status === 'pagamento' || i.status === 'devolucao' || i.status === 'anterior' ? i.status : (i.valor as number) > 0 ? 'aberto' as const : 'pagamento' as const,
      })) : [],
    ...(o.manual === true ? { manual: true } : {}),
    ...(Array.isArray(o.participantes) ? { participantes: o.participantes.filter((x): x is string => typeof x === 'string') } : {}),
  };
}

/**
 * Os conferidos de um mês anterior que ainda não estão neste (passam para o mês seguinte): só os que o razão conferiu (o
 * conferido manual de antes fica para trás).
 */
export function conferidosQuePassam(anterior: DocClientes | null, atual: DocClientes): Record<string, MarcaDoCliente> {
  if (!anterior) return {};
  return Object.fromEntries(Object.entries(anterior.contas).filter(([k, m]) => razaoComPendencia(m.razao, m.baixas) && !atual.contas[k]));
}

// ─── para o cliente ──────────────────────────────────────────────────────────

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface LinhaParaCliente { codigo: string; nome: string; saldo: number; obs: string; notas?: { nf: string; aberto: number }[] }

/** As notas em aberto numa linha: "NF 9242 (R$ 1.600,00), NF 10086 (R$ 19.599,52)". */
export function textoDasNotas(notas: readonly { nf: string; aberto: number }[] = []): string {
  return notas.map(n => 'NF ' + n.nf + ' (R$ ' + brl(n.aberto) + ')').join(', ');
}


/** A planilha para o cliente responder (.xlsx): a conta, o cliente, o saldo, a nossa observação e a resposta. */
export function planilhaParaCliente(linhas: readonly LinhaParaCliente[], lado: LadoDaConta = 'clientes'): Uint8Array {
  const quem = lado === 'clientes' ? 'Cliente' : 'Fornecedor';
  const ws = XLSX.utils.aoa_to_sheet([
    ['Conta', quem, 'Saldo (R$)', 'Notas em aberto', 'Observação do escritório', 'Resposta da empresa'],
    ...linhas.map(l => [l.codigo, l.nome, Math.round(l.saldo * 100) / 100, textoDasNotas(l.notas), l.obs, '']),
  ]);
  ws['!cols'] = [{ wch: 10 }, { wch: 42 }, { wch: 14 }, { wch: 40 }, { wch: 48 }, { wch: 48 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, lado === 'clientes' ? 'Clientes' : 'Fornecedores');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * As perguntas mais comuns para o cliente (Vitor, 07/10/2026, com as palavras dele), no menu da observação de quem
 * vai para o cliente.
 */
export const OBJECOES_DO_CLIENTE = [
  'Não encontrei, onde está esse valor?',
  'Foi pago em dinheiro?',
  'O pagamento foi feito em outra conta?',
  'O valor foi recebido na conta pessoal?',
  'Pode nos enviar a relação de recebimentos deste cliente?',
] as const;

/** As perguntas da observação na etapa Fornecedores: as mesmas do Clientes, do lado do pagamento. */
export const OBJECOES_DO_FORNECEDOR = [
  'Não encontrei, onde está esse valor?',
  'Foi pago em dinheiro?',
  'O pagamento foi feito por outra conta?',
  'O valor foi pago pela conta pessoal?',
  'Pode nos enviar a nota fiscal deste pagamento?',
] as const;

/** A mensagem padrão da etapa Fornecedores. */
export const MENSAGEM_PADRAO_FORNECEDORES = 'Olá! Na conferência dos fornecedores de {mes} da {empresa}, estes saldos ficaram em aberto. Pode nos dizer o que aconteceu com cada um?\n\n{lista}\n\nObrigado!';

/** A mensagem padrão (dá para trocar na tela): {empresa}, {mes} e {lista} viram os dados. */
export const MENSAGEM_PADRAO ='Olá! Na conferência dos clientes de {mes} da {empresa}, estes saldos ficaram em aberto. Pode nos dizer o que aconteceu com cada um?\n\n{lista}\n\nObrigado!';

/** O texto da mensagem com a lista dos conferidos (uma linha por cliente: o nome, o saldo e a observação). */
export function textoDaMensagem(modelo: string, empresa: string, mes: string, linhas: readonly LinhaParaCliente[]): string {
  const lista = linhas.map(l => '• ' + l.nome + ' — R$ ' + brl(l.saldo) + (l.notas?.length ? ' — em aberto: ' + textoDasNotas(l.notas) : '') + (l.obs ? ' — ' + l.obs : '')).join('\n');
  return (modelo || MENSAGEM_PADRAO).replace(/\{empresa\}/g, empresa).replace(/\{mes\}/g, mes).replace(/\{lista\}/g, lista);
}
export { sugestoesDeBaixa, selosDaSugestao, palavrasDoNome, mesmoLancamento, comBaixa, faltaDaNota, baixasGuardadas, type LancamentoDoBanco, type SugestaoDeBaixa, type BaixaAceita, type ComoBate, type SeloDaSugestao } from './sugestaoDeBaixa';
export { conferirFechamento, type PendenciaDoFechamento, type ContaNoFechamento } from './fechamento';
export { dinamicoCompletoDeTeste } from './deTeste';
