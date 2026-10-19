// O Fechamento que confere sozinho (Vitor, 16/10/2026: "aplique todas as suas sugestões" — no fim, o dinâmico final roda
// todas as regras de novo e mostra "tudo zerou / ainda tem X"). Pelo balancete dinâmico, mês a mês: o balancete fecha
// (a soma dos grupos de cima é zero), o caixa e os bancos não ficam credores, nenhum cliente credor nem fornecedor
// devedor, os adiantamentos do lado certo, o adiantamento salarial zerado, o passivo da folha e dos impostos sem saldo
// devedor, e nenhuma despesa credora nem receita devedora. O dinâmico traz devedor positivo e credor negativo.
import { normalizarTexto } from '../../formatos';
import {
  ADIANTAMENTO, ADIANTAMENTO_SALARIAL, credoresNoPeriodo, resultadoErradoNoDinamico, temContaDebaixo, tipoDoRazao,
  type BalanceteDinamico, type LinhaDinamico,
} from './index';

export interface ContaNoFechamento { conta: string; nome: string; meses: { mes: string; saldo: number }[] }
export interface PendenciaDoFechamento { id: string; titulo: string; dica: string; contas: ContaNoFechamento[] }

const zero = (v: number) => Math.abs(v) < 0.005;
const BANCO = /\b(banco|bco|sicoob|sicredi|bradesco|itau|santander|nubank|inter|c6|btg|cora|stone|pagbank|pagseguro|mercado pago|caixa economica)\b/;

/** As pendências do fim, pelo dinâmico, nos meses do período (só as que têm conta; vazio = tudo certo). */
export function conferirFechamento(d: BalanceteDinamico, meses: readonly string[]): PendenciaDoFechamento[] {
  const cobertos = meses.filter(m => d.meses.includes(m));
  const ultimo = cobertos[cobertos.length - 1] || '';
  const folha = (l: LinhaDinamico) => !temContaDebaixo(d, l);
  const nome = (l: LinhaDinamico) => l.descricao.replace(/\s+/g, ' ').trim();
  /** as analíticas que passam no teste, com os meses em que o saldo está do lado errado */
  const errados = (filtro: (l: LinhaDinamico) => boolean, errado: (saldo: number) => boolean): ContaNoFechamento[] =>
    d.linhas.filter(l => folha(l) && filtro(l))
      .map(l => ({ conta: l.codigo, nome: nome(l), meses: cobertos.map(m => ({ mes: m, saldo: l.saldos[m] ?? 0 })).filter(x => errado(x.saldo)) }))
      .filter(c => c.meses.length > 0);
  const out: PendenciaDoFechamento[] = [];
  const add = (id: string, titulo: string, dica: string, contas: ContaNoFechamento[]) => { if (contas.length) out.push({ id, titulo, dica, contas }); };

  // o balancete fecha: a soma dos grupos de cima (Ativo, Passivo, Receitas, Despesas…) é zero
  const topo = d.linhas.filter(l => l.classificacao && !l.classificacao.includes('.'));
  const naoFecha = cobertos.map(m => ({ mes: m, saldo: topo.reduce((s, l) => s + (l.saldos[m] ?? 0), 0) })).filter(x => !zero(x.saldo));
  if (naoFecha.length) out.push({ id: 'balancete', titulo: 'O balancete não fecha', dica: 'Ativo = passivo + patrimônio líquido + resultado: falta ou sobra lançamento.', contas: [{ conta: '', nome: 'Diferença', meses: naoFecha }] });

  const tipo = (l: LinhaDinamico) => tipoDoRazao(d, l.codigo);
  const n = (l: LinhaDinamico) => normalizarTexto(l.descricao);
  add('caixa', 'Caixa credor', 'Pagamento lançado no caixa que saiu do banco, ou venda à vista que falta.', errados(l => tipo(l) === 'caixa', s => s < -0.005));
  add('bancos', 'Banco credor', 'Banco negativo: o ajuste do cheque especial.', errados(l => l.classificacao.startsWith('1') && BANCO.test(n(l)), s => s < -0.005));
  if (ultimo) {
    const comoContas = (lista: ReturnType<typeof credoresNoPeriodo>): ContaNoFechamento[] =>
      lista.map(c => ({ conta: c.codigo, nome: c.nome, meses: c.saldos.filter(x => x.saldo < 0 && !zero(x.saldo) && cobertos.includes(x.mes)).map(x => ({ mes: x.mes, saldo: x.saldo })) }))
        .filter(c => c.meses.length > 0);
    add('clientes', 'Cliente credor', 'Recebeu mais do que vendeu: o recebimento sem a nota, ou a nota que faltou entrar.', comoContas(credoresNoPeriodo(d, ultimo, 'clientes')));
    add('fornecedores', 'Fornecedor devedor', 'Pagou mais do que comprou: o pagamento sem a nota, ou a nota que faltou entrar.', comoContas(credoresNoPeriodo(d, ultimo, 'fornecedores')));
  }
  add('adiantamento-fornecedores', 'Adiantamento a fornecedores credor', 'O adiantamento baixado a mais: a nota do fornecedor maior que o adiantamento.', errados(l => ADIANTAMENTO.fornecedores.test(n(l)), s => s < -0.005));
  add('adiantamento-clientes', 'Adiantamento de clientes devedor', 'O adiantamento baixado a mais: a nota de venda maior que o adiantamento.', errados(l => ADIANTAMENTO.clientes.test(n(l)), s => s > 0.005));
  add('adiantamento-salarial', 'Adiantamento salarial com saldo', 'O adiantamento do dia 15 e o desconto na folha zeram no mês.', errados(l => ADIANTAMENTO_SALARIAL.test(n(l)), s => !zero(s)));
  add('passivo', 'Obrigação com saldo devedor', 'Salários, INSS, FGTS, pró-labore, honorários e Simples ficam credores ou zeram: pagamento a mais ou provisão que faltou.',
    errados(l => { const x = tipo(l); return x === 'salarios' || x === 'fgts' || x === 'inss' || x === 'prolabore' || x === 'honorarios' || x === 'simples'; }, s => s > 0.005));
  const resultado = resultadoErradoNoDinamico(d, cobertos);
  const doResultado = (t: 'despesa' | 'receita') => resultado.filter(x => x.tipo === t).map(x => ({ conta: x.codigo, nome: x.nome, meses: x.meses }));
  add('despesas', 'Despesa credora', 'Lançamento invertido, ou estorno na conta errada.', doResultado('despesa'));
  add('receitas', 'Receita devedora', 'Lançamento invertido, ou estorno na conta errada.', doResultado('receita'));
  return out;
}
