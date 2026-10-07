// O razão da conta do cliente na etapa Clientes (Vitor, 06/10/2026): a pessoa importa o razão da conciliação do
// Alterdata e o nads acha as notas que o pagamento não fechou, para irem na relação para o cliente com o número.
// Cada nota: o que foi vendido (as linhas de venda com o número dela) menos o que foi recebido (os recebimentos que
// citam o número). O mesmo recebimento lançado em duas contas no mesmo dia (Caixa e Banco) conta uma vez só e aparece
// como duplicidade. As devoluções abatem o saldo, mas não dizem de qual nota são. Vale o que foi lançado até o fim do mês.
import { reais } from '../../formatos';
import type { LancamentoDoRazao, RazaoDaConta } from '../../tarefas/regras/razao';

/** Uma nota de venda do cliente no razão: vendido, recebido e o que ficou em aberto (positivo = o cliente deve). */
export interface NotaDoCliente { nf: string; data: string; vendido: number; recebido: number; aberto: number }

export interface DevolucaoDoCliente { nf: string; data: string; valor: number; notas: string[] }

/** O mesmo recebimento lançado mais de uma vez (no mesmo dia, mesmo valor, em contas diferentes). */
export interface RecebimentoDuplicado { nf: string; data: string; valor: number; contas: string[] }

export interface RazaoConferido {
  /** as notas em aberto (o pagamento não fechou), da mais antiga para a mais nova */
  emAberto: NotaDoCliente[];
  /** as notas recebidas a mais (sem contar a duplicidade) */
  aMais: NotaDoCliente[];
  devolucoes: DevolucaoDoCliente[];
  duplicados: RecebimentoDuplicado[];
  /** recebimentos que citam uma nota que não está no razão (vendida antes do começo dele) ou nenhuma */
  semNota: { data: string; valor: number; historico: string; conta: string }[];
  /** o saldo no fim do mês pelo que foi achado (positivo = devedor) */
  saldo: number;
  /** o saldo da coluna Saldo do razão no fim do mês (positivo = devedor); null = sem lançamento até lá */
  saldoDoRazao: number | null;
}

const centavos = (n: number) => Math.round(n * 100) / 100;
const zero = (n: number) => Math.abs(n) < 0.005;

/** O número da nota no histórico do Alterdata: "… - 9078-05455270000100-NOME" (venda e devolução). */
function nfDoHistorico(h: string): string | null {
  return /-\s*(\d{1,9})-\d{11,14}\b/.exec(h)?.[1] ?? null;
}

/** O número da nota no recebimento: "Recebimento de clientes 9078 -DUP.001", "… 9242/002 - NOME". */
function nfDoRecebimento(h: string): string | null {
  return /receb\w*\s+de\s+clientes?\D*?(\d{3,9})/i.exec(h)?.[1] ?? null;
}

/** O número da nota no pagamento ao fornecedor: "Pagamento a fornecedores 9078 …", "Pagto fornecedor 9242/002"; senão, o do histórico da nota. */
function nfDoPagamento(h: string): string | null {
  return /pag\w*\.?\s+(?:a\s+|de\s+|ao\s+)?fornecedor\w*\D*?(\d{3,9})/i.exec(h)?.[1] ?? nfDoHistorico(h);
}

/**
 * De que lado é a conta (Vitor, 07/10/2026: Fornecedores é "a mesma coisa que o Clientes", com o devedor no lugar do
 * credor). No razão do Alterdata o crédito é positivo: no cliente, a venda é débito e o recebimento crédito; no
 * fornecedor, a compra é crédito e o pagamento débito. Por isso o fornecedor é o cliente com o sinal trocado.
 */
export type LadoDaConta = 'clientes' | 'fornecedores';
const sinalDo = (lado: LadoDaConta) => (lado === 'clientes' ? 1 : -1);

/** As notas citadas numa devolução ("//NF: 7811,7952,8535"). */
function notasCitadas(h: string): string[] {
  const m = /NF:\s*([\d,\s]+)/i.exec(h.split('//').slice(1).join('//'));
  return m ? m[1].split(/[,\s]+/).filter(Boolean) : [];
}

type Tipo = 'venda' | 'recebimento' | 'devolucao' | 'outro';

function tipoDe(l: LancamentoDoRazao, lado: LadoDaConta): Tipo {
  if (/devolu/i.test(l.historico)) return 'devolucao';
  // no fornecedor: todo débito é pagamento; o crédito com o número da nota é a compra
  if (lado === 'fornecedores') return l.valor < 0 ? 'recebimento' : nfDoHistorico(l.historico) ? 'venda' : 'outro';
  // todo crédito na conta do cliente que não é devolução é pagamento (o "Recebimento de clientes" e também a
  // transferência ou o Pix solto, sem a nota: aparecem como "Apenas pagamento"; Vitor, 07/10/2026)
  if (l.valor > 0) return 'recebimento';
  if (/venda/i.test(l.historico) && l.valor < 0) return 'venda';
  return 'outro';
}

/** O fim do mês ('aaaa-mm' → 'aaaa-mm-31', vale para comparar datas 'aaaa-mm-dd'). */
const fimDoMes = (mes: string) => mes + '-31';

/**
 * Confere o razão do cliente (ou do fornecedor) até o fim do mês: as notas em aberto, as devoluções e as duplicidades.
 * No fornecedor, "vendido" é o comprado, "recebido" é o pago e o saldo positivo é o que a empresa deve (credor).
 */
export function conferirRazaoDoCliente(razao: RazaoDaConta, mes: string, lado: LadoDaConta = 'clientes'): RazaoConferido {
  const sinal = sinalDo(lado);
  const ate = fimDoMes(mes);
  const ls = razao.lancamentos.filter(l => l.data <= ate);
  const notas = new Map<string, NotaDoCliente>();
  const devolucoes: DevolucaoDoCliente[] = [];
  const duplicados: RecebimentoDuplicado[] = [];
  const semNota: RazaoConferido['semNota'] = [];
  const vistos = new Map<string, { conta: string; dup?: RecebimentoDuplicado }>();
  let saldo = 0;
  const nota = (nf: string, data: string) => {
    let n = notas.get(nf);
    if (!n) { n = { nf, data, vendido: 0, recebido: 0, aberto: 0 }; notas.set(nf, n); }
    return n;
  };
  for (const l of ls) {
    const tipo = tipoDe(l, lado);
    // o valor visto do lado do cliente (no fornecedor, com o sinal trocado)
    const valor = sinal * l.valor;
    if (tipo === 'recebimento') {
      const nf = lado === 'clientes' ? nfDoRecebimento(l.historico) : nfDoPagamento(l.historico);
      const chave = (nf || l.historico) + '|' + l.data + '|' + valor;
      const antes = vistos.get(chave);
      const conta = (l.contrapartida + ' ' + l.nomeContrapartida).trim();
      // o mesmo recebimento em outra conta no mesmo dia: duplicidade (conta uma vez)
      if (antes && antes.conta !== conta) {
        if (!antes.dup) { antes.dup = { nf: nf || '', data: l.data, valor, contas: [antes.conta] }; duplicados.push(antes.dup); }
        antes.dup.contas.push(conta);
        continue;
      }
      vistos.set(chave, { conta });
      saldo -= valor;
      if (nf && notas.has(nf)) nota(nf, l.data).recebido = centavos(nota(nf, l.data).recebido + valor);
      // a conta do lançamento (o banco ou o caixa por onde entrou): o cliente precisa dela para achar o pagamento
      else semNota.push({ data: l.data, valor, historico: l.historico, conta: (l.nomeContrapartida || l.contrapartida || '').trim() });
      continue;
    }
    saldo -= valor;
    const nf = nfDoHistorico(l.historico);
    if (tipo === 'venda' && nf) nota(nf, l.data).vendido = centavos(nota(nf, l.data).vendido - valor);
    else if (tipo === 'devolucao') devolucoes.push({ nf: nf || '', data: l.data, valor: centavos(valor), notas: notasCitadas(l.historico) });
  }
  const todas = [...notas.values()].map(n => ({ ...n, aberto: centavos(n.vendido - n.recebido) }));
  const ultimo = ls[ls.length - 1];
  return {
    emAberto: todas.filter(n => n.aberto > 0 && !zero(n.aberto)),
    aMais: todas.filter(n => n.aberto < 0 && !zero(n.aberto)),
    devolucoes, duplicados, semNota,
    saldo: centavos(saldo),
    saldoDoRazao: ultimo ? centavos(-sinal * ultimo.saldo) : null,
  };
}

/**
 * O que fica guardado na marca do cliente: o arquivo, as notas em aberto (vão para a relação do cliente), o saldo
 * achado, o total das devoluções e as notas recebidas em duplicidade (só para o escritório ver).
 */
export interface RazaoDaMarca {
  arquivo: string; notas: { nf: string; data: string; aberto: number }[]; saldo: number;
  devolucoes: number; duplicadas: string[];
  /** a relação para conferir (a mini tabela embaixo do cliente): as notas em aberto e o que ficou solto */
  itens: ItemDoRazao[];
}

/**
 * Uma linha da relação: a data ('aaaa-mm-dd'), o que é, o valor (positivo = o cliente deve; negativo = abate) e o status
 * (Vitor, 07/10/2026): em aberto (a nota que o pagamento não fechou), apenas pagamento (transferência ou pagamento solto,
 * sem a nota, ou a mais) e devolução.
 */
export interface ItemDoRazao {
  data: string;
  /** a nota fiscal da linha ('' = sem nota: o pagamento solto) — Vitor, 07/10/2026: "Data, nota fiscal, descrição, valor" */
  nf: string;
  descricao: string; valor: number; status: StatusDoItem;
  /** só para o escritório (a duplicidade de recebimento): não vai para o cliente */
  interno?: boolean;
  /** a conta do lançamento solto (o banco ou o caixa por onde o pagamento passou) — Vitor, 07/10/2026 */
  conta?: string;
}
export type StatusDoItem = 'aberto' | 'pagamento' | 'devolucao';
export const ROTULO_DO_STATUS: Record<StatusDoItem, string> = { aberto: 'Em aberto', pagamento: 'Apenas pagamento', devolucao: 'Devolução' };

const dataBR = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
const brl = reais;

/** A relação em ordem de data: as notas em aberto, os recebimentos soltos (sem nota), as devoluções e as duplicidades. */
function itensDoRazao(r: RazaoConferido, lado: LadoDaConta): ItemDoRazao[] {
  const item = (data: string, nf: string, descricao: string, valor: number, status: StatusDoItem, interno = false, conta = ''): ItemDoRazao =>
    ({ data, nf, descricao, valor, status, ...(interno ? { interno } : {}), ...(conta ? { conta } : {}) });
  const [vendido, recebido, recebida, recebimento, venda] = lado === 'clientes' ? ['vendido', 'recebido', 'Recebida', 'Recebimento', 'Venda a prazo'] : ['comprado', 'pago', 'Paga', 'Pagamento', 'Compra a prazo'];
  return [
    ...r.emAberto.map(n => item(n.data, n.nf, venda + (n.recebido ? ' (' + vendido + ' ' + brl(n.vendido) + ', ' + recebido + ' ' + brl(n.recebido) + ')' : ''), n.aberto, 'aberto')),
    ...r.aMais.map(n => item(n.data, n.nf, recebida + ' a mais', n.aberto, 'pagamento')),
    ...r.semNota.map(x => item(x.data, '', x.historico, centavos(-x.valor), 'pagamento', false, x.conta)),
    ...r.devolucoes.map(d => item(d.data, d.nf, 'Devolução' + (d.notas.length ? ' (cita NF ' + d.notas.join(', ') + ')' : ''), centavos(-d.valor), 'devolucao')),
    ...r.duplicados.map(d => item(d.data, d.nf, recebimento + ' em duplicidade: ' + d.contas.join(' e '), centavos(d.valor), 'pagamento', true)),
  ].sort((a, b) => a.data.localeCompare(b.data));
}

/** A observação pronta para o cliente (Vitor, 07/10/2026): "No meu sistema, está em aberto: 19/08/2026 - NF 10086 - R$ 19.599,52". */
export function observacaoDoRazao(m: RazaoDaMarca): string {
  if (!m.notas.length) return '';
  const lista = m.notas.map(n => dataBR(n.data) + ' - NF ' + n.nf + ' - ' + brl(n.aberto)).join('; ');
  return 'No meu sistema, ' + (m.notas.length === 1 ? 'está' : 'estão') + ' em aberto: ' + lista;
}

export function razaoDaMarca(arquivo: string, r: RazaoConferido, lado: LadoDaConta = 'clientes'): RazaoDaMarca {
  return {
    arquivo, notas: r.emAberto.map(n => ({ nf: n.nf, data: n.data, aberto: n.aberto })), saldo: r.saldo,
    devolucoes: centavos(r.devolucoes.reduce((t, d) => t + d.valor, 0)),
    duplicadas: [...new Set(r.duplicados.map(d => d.nf).filter(Boolean))],
    itens: itensDoRazao(r, lado),
  };
}

/** Uma linha para o formulário do cliente (o Mandei): data, nota fiscal, o que é, o valor, o tipo e a conta. */
export interface LinhaParaOTicket { data: string; nf: string; descricao: string; valor: string; tipo: 'nota' | 'pagamento' | 'devolucao' | 'saldo'; conta?: string }

const dataDoRazaoBR = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');

/**
 * Os lançamentos que o cliente vê no ticket (Vitor, 07/10/2026): os do razão importado (sem a duplicidade, que é só do
 * escritório), cada um com a data, a nota (a nota em aberto) ou a conta (o pagamento solto: o banco); sem o razão, o
 * saldo do fim do mês ('aaaa-mm').
 */
export function linhasParaOTicket(razao: RazaoDaMarca | undefined, saldo: number, mes: string): LinhaParaOTicket[] {
  const doRazao = (razao?.itens || []).filter(i => !i.interno);
  if (doRazao.length) {
    return doRazao.map(i => ({
      data: dataDoRazaoBR(i.data), nf: i.nf || '—', descricao: i.descricao, valor: reais(i.valor),
      tipo: i.status === 'aberto' ? 'nota' as const : i.status === 'devolucao' ? 'devolucao' as const : 'pagamento' as const,
      ...(i.conta ? { conta: i.conta } : {}),
    }));
  }
  const [a, m] = mes.split('-').map(Number);
  const fim = String(new Date(a, m, 0).getDate()).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + a;
  return [{ data: fim, nf: '—', descricao: 'Saldo em aberto em ' + String(m).padStart(2, '0') + '/' + a, valor: reais(saldo), tipo: 'saldo' }];
}
