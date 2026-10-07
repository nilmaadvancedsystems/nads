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
  semNota: { data: string; valor: number; historico: string }[];
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

/** As notas citadas numa devolução ("//NF: 7811,7952,8535"). */
function notasCitadas(h: string): string[] {
  const m = /NF:\s*([\d,\s]+)/i.exec(h.split('//').slice(1).join('//'));
  return m ? m[1].split(/[,\s]+/).filter(Boolean) : [];
}

type Tipo = 'venda' | 'recebimento' | 'devolucao' | 'outro';

function tipoDe(l: LancamentoDoRazao): Tipo {
  if (/devolu/i.test(l.historico)) return 'devolucao';
  // todo crédito na conta do cliente que não é devolução é pagamento (o "Recebimento de clientes" e também a
  // transferência ou o Pix solto, sem a nota: aparecem como "Apenas pagamento"; Vitor, 07/10/2026)
  if (l.valor > 0) return 'recebimento';
  if (/venda/i.test(l.historico) && l.valor < 0) return 'venda';
  return 'outro';
}

/** O fim do mês ('aaaa-mm' → 'aaaa-mm-31', vale para comparar datas 'aaaa-mm-dd'). */
const fimDoMes = (mes: string) => mes + '-31';

/** Confere o razão do cliente até o fim do mês: as notas em aberto, as devoluções e as duplicidades. */
export function conferirRazaoDoCliente(razao: RazaoDaConta, mes: string): RazaoConferido {
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
    const tipo = tipoDe(l);
    if (tipo === 'recebimento') {
      const nf = nfDoRecebimento(l.historico);
      const chave = (nf || l.historico) + '|' + l.data + '|' + l.valor;
      const antes = vistos.get(chave);
      const conta = (l.contrapartida + ' ' + l.nomeContrapartida).trim();
      // o mesmo recebimento em outra conta no mesmo dia: duplicidade (conta uma vez)
      if (antes && antes.conta !== conta) {
        if (!antes.dup) { antes.dup = { nf: nf || '', data: l.data, valor: l.valor, contas: [antes.conta] }; duplicados.push(antes.dup); }
        antes.dup.contas.push(conta);
        continue;
      }
      vistos.set(chave, { conta });
      saldo -= l.valor;
      if (nf && notas.has(nf)) nota(nf, l.data).recebido = centavos(nota(nf, l.data).recebido + l.valor);
      else semNota.push({ data: l.data, valor: l.valor, historico: l.historico });
      continue;
    }
    saldo -= l.valor;
    const nf = nfDoHistorico(l.historico);
    if (tipo === 'venda' && nf) nota(nf, l.data).vendido = centavos(nota(nf, l.data).vendido - l.valor);
    else if (tipo === 'devolucao') devolucoes.push({ nf: nf || '', data: l.data, valor: centavos(l.valor), notas: notasCitadas(l.historico) });
  }
  const todas = [...notas.values()].map(n => ({ ...n, aberto: centavos(n.vendido - n.recebido) }));
  const ultimo = ls[ls.length - 1];
  return {
    emAberto: todas.filter(n => n.aberto > 0 && !zero(n.aberto)),
    aMais: todas.filter(n => n.aberto < 0 && !zero(n.aberto)),
    devolucoes, duplicados, semNota,
    saldo: centavos(saldo),
    saldoDoRazao: ultimo ? centavos(-ultimo.saldo) : null,
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
export interface ItemDoRazao { data: string; descricao: string; valor: number; status: StatusDoItem }
export type StatusDoItem = 'aberto' | 'pagamento' | 'devolucao';
export const ROTULO_DO_STATUS: Record<StatusDoItem, string> = { aberto: 'Em aberto', pagamento: 'Apenas pagamento', devolucao: 'Devolução' };

const dataBR = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
const brl = reais;

/** A relação em ordem de data: as notas em aberto, os recebimentos soltos (sem nota), as devoluções e as duplicidades. */
function itensDoRazao(r: RazaoConferido): ItemDoRazao[] {
  const item = (data: string, descricao: string, valor: number, status: StatusDoItem): ItemDoRazao => ({ data, descricao, valor, status });
  return [
    ...r.emAberto.map(n => item(n.data, 'NF ' + n.nf + (n.recebido ? ' (vendido ' + brl(n.vendido) + ', recebido ' + brl(n.recebido) + ')' : ''), n.aberto, 'aberto')),
    ...r.aMais.map(n => item(n.data, 'NF ' + n.nf + ' recebida a mais', n.aberto, 'pagamento')),
    ...r.semNota.map(x => item(x.data, x.historico, centavos(-x.valor), 'pagamento')),
    ...r.devolucoes.map(d => item(d.data, 'NF ' + (d.nf || '?') + (d.notas.length ? ' (cita NF ' + d.notas.join(', ') + ')' : ''), centavos(-d.valor), 'devolucao')),
    ...r.duplicados.map(d => item(d.data, 'Recebimento em duplicidade' + (d.nf ? ' da NF ' + d.nf : '') + ': ' + d.contas.join(' e '), centavos(d.valor), 'pagamento')),
  ].sort((a, b) => a.data.localeCompare(b.data));
}

/** A observação pronta para o cliente (Vitor, 07/10/2026): "No meu sistema, está em aberto: 19/08/2026 - NF 10086 - R$ 19.599,52". */
export function observacaoDoRazao(m: RazaoDaMarca): string {
  if (!m.notas.length) return '';
  const lista = m.notas.map(n => dataBR(n.data) + ' - NF ' + n.nf + ' - ' + brl(n.aberto)).join('; ');
  return 'No meu sistema, ' + (m.notas.length === 1 ? 'está' : 'estão') + ' em aberto: ' + lista;
}

export function razaoDaMarca(arquivo: string, r: RazaoConferido): RazaoDaMarca {
  return {
    arquivo, notas: r.emAberto.map(n => ({ nf: n.nf, data: n.data, aberto: n.aberto })), saldo: r.saldo,
    devolucoes: centavos(r.devolucoes.reduce((t, d) => t + d.valor, 0)),
    duplicadas: [...new Set(r.duplicados.map(d => d.nf).filter(Boolean))],
    itens: itensDoRazao(r),
  };
}
