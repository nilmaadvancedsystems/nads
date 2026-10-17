// O balancete dinâmico de teste da empresa toda (o ⚡ do modo desenvolvedor; Vitor, 16/10/2026: "em todas as telas, a opção
// de nutrir com dados de teste"): Ativo, Passivo, Receitas e Despesas que fecham em cada mês. Com pendências: um cliente
// credor, o adiantamento salarial com saldo, o Simples devedor, uma despesa credora e uma receita devedora. Fictício.
import type { BalanceteDinamico, LinhaDinamico } from './index';

const r2 = (n: number) => Math.round(n * 100) / 100;

export function dinamicoCompletoDeTeste(meses: readonly string[], comPendencias: boolean): BalanceteDinamico {
  const ms = [...meses].sort();
  const ultimo = ms[ms.length - 1];
  const p = (m: string, certo: number, errado: number) => (comPendencias && m === ultimo ? errado : certo);
  // as analíticas (o saldo de cada mês; devedor positivo, credor negativo)
  const analiticas: [string, string, string, (m: string, i: number) => number][] = [
    ['10101', '1.1.1.01.001', 'Caixa Geral', (_, i) => 5000 + i * 300],
    ['10503', '1.1.1.02.001', 'Banco Sicoob', (_, i) => 12000 + i * 900],
    ['11501', '1.1.2.01.001', 'CLIENTE EXEMPLO LTDA', m => p(m, 3200, -450)],
    ['11502', '1.1.2.01.002', 'CLIENTE MODELO ME', (_, i) => 1800 + i * 50],
    ['12401', '1.1.2.06.001', 'Adiantamento Salarial', m => p(m, 0, 2400)],
    ['20101', '2.1.1.01.001', 'FORNECEDOR EXEMPLO LTDA', (_, i) => -(2600 + i * 40)],
    ['52001', '2.1.1.02.001', 'Salários a Pagar', (_, i) => -(7800 + i * 20)],
    ['54010', '2.1.1.03.010', 'Simples Nacional a Recolher', m => p(m, -4200, 350)],
    ['31101', '3.1.1.01.001', 'Venda de Serviços', (_, i) => -(50000 + i * 1000)],
    ['31102', '3.1.1.01.002', 'Venda de Produtos', m => p(m, -900, 120)],
    ['42101', '4.2.1.01.001', 'Salários e Ordenados', (_, i) => 11000 + i * 200],
    ['42102', '4.2.1.03.001', 'Telefone', m => p(m, 180, -60)],
  ];
  const linhas: LinhaDinamico[] = [];
  const valores = new Map<string, Record<string, number>>();
  for (const [codigo, classificacao, descricao, f] of analiticas) {
    const saldos = Object.fromEntries(ms.map((m, i) => [m, r2(f(m, i))]));
    valores.set(classificacao, saldos);
    linhas.push({ codigo, classificacao, descricao, saldoAnterior: 0, saldos });
  }
  // o Patrimônio líquido fecha cada mês (a soma dos grupos de cima é zero)
  const pl: Record<string, number> = {};
  for (const m of ms) pl[m] = r2(-[...valores.values()].reduce((s, v) => s + (v[m] ?? 0), 0));
  linhas.push({ codigo: '24101', classificacao: '2.4.1.01.001', descricao: 'Lucros acumulados', saldoAnterior: 0, saldos: pl });
  valores.set('2.4.1.01.001', pl);
  // as sintéticas: a soma das analíticas debaixo
  const sinteticas: [string, string, string][] = [
    ['1', '1', 'ATIVO'], ['111', '1.1.1', 'DISPONÍVEL'], ['1101', '1.1.1.01', 'CAIXA'], ['1102', '1.1.1.02', 'BANCOS CONTA MOVIMENTO'],
    ['112', '1.1.2', 'CRÉDITOS'], ['1150', '1.1.2.01', 'CLIENTES'], ['1240', '1.1.2.06', 'ADIANTAMENTOS'],
    ['2', '2', 'PASSIVO'], ['2110', '2.1.1.01', 'FORNECEDORES'], ['2120', '2.1.1.02', 'OBRIGAÇÕES TRABALHISTAS'], ['2130', '2.1.1.03', 'OBRIGAÇÕES TRIBUTÁRIAS'],
    ['2400', '2.4.1', 'PATRIMÔNIO LÍQUIDO'],
    ['3', '3', 'RECEITAS'], ['3110', '3.1.1.01', 'MERCADO INTERNO'],
    ['4', '4', 'CUSTOS E DESPESAS'], ['4210', '4.2.1.01', 'DESPESAS TRABALHISTAS'], ['4213', '4.2.1.03', 'DESPESAS ADMINISTRATIVAS'],
  ];
  for (const [codigo, classificacao, descricao] of sinteticas) {
    const saldos: Record<string, number> = {};
    for (const m of ms) saldos[m] = r2([...valores.entries()].filter(([c]) => c.startsWith(classificacao + '.')).reduce((s, [, v]) => s + (v[m] ?? 0), 0));
    linhas.push({ codigo, classificacao, descricao, saldoAnterior: 0, saldos });
  }
  linhas.sort((a, b) => a.classificacao.localeCompare(b.classificacao, 'pt-BR', { numeric: true }));
  return { meses: ms, linhas };
}
