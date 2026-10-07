// Os razões de teste das etapas da Tarefa (o ⚡ do modo desenvolvedor, Vitor, 06/10/2026): o Caixa e o INSS a recolher
// do período, no formato que o Alterdata exporta, para ver a tela funcionando sem importar arquivo. Fictícios.
import type { GuiaDoInss } from './inss';
import { lerRazao, type RazaoDaConta } from './razao';

const CAB = ['Data', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo'];
const centavos = (n: number) => Math.round(n * 100) / 100;
const dataBR = (mes: string, dia: number) => String(dia).padStart(2, '0') + '/' + mes.slice(5, 7) + '/' + mes.slice(0, 4);
const seguinte = (mes: string) => { const [a, m] = mes.split('-').map(Number); return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0'); };
const mesBR = (mes: string) => mes.slice(5, 7) + '/' + mes.slice(0, 4);

type Linha = [dia: number, contra: string, nome: string, valor: number, historico: string];

/** As linhas → o razão (o saldo andando: valor negativo = débito na conta). */
function montar(porMes: { mes: string; linhas: Linha[] }[], saldoInicial: number): RazaoDaConta {
  let saldo = saldoInicial;
  const rows: unknown[][] = [CAB];
  for (const { mes, linhas } of porMes) {
    for (const [dia, contra, nome, valor, historico] of linhas) {
      saldo = centavos(saldo + valor);
      rows.push([dataBR(mes, dia), contra, nome, valor, '', historico, saldo]);
    }
  }
  return lerRazao(rows);
}

/**
 * O caixa de teste do período: vendas à vista, um DARF e um boleto pagos pelo banco e lançados no caixa, dias de caixa
 * credor e, com o Creditor, o CRÉD.LIQ.COBRANÇA no primeiro mês (a etapa Creditor entra na rotina).
 */
export function caixaDeTeste(meses: readonly string[], comCreditor: boolean): RazaoDaConta {
  const ms = [...new Set(meses)].sort();
  return montar(ms.map((mes, i) => ({
    mes,
    linhas: [
      [2, '30101', 'Receita de vendas', -1500, 'Vendas à vista'],
      [5, '20105', 'DARF Simples Nacional', 320, 'DB.CONV.TR FD-RFB DOC.: 1665' + i],
      ...(comCreditor && i === 0 ? [[10, '10301', 'Clientes', -2150, 'CRÉD.LIQ.COBRANÇA DOC.: 22540' + i] as Linha] : []),
      [15, '20101', 'Fornecedores', 480, 'DÉB. TIT. COBRANÇA'],
      [20, '20101', 'Fornecedores', 2600, 'Pagamento fornecedor'],
      [25, '20301', 'Lucros a distribuir', 1500, 'Retirada dos sócios'],
      [28, '30101', 'Receita de vendas', -1200, 'Vendas à vista'],
    ] as Linha[],
  })), -800);
}

/** Os valores do INSS de teste de cada mês (o último mês com a patronal provisionada a menos, para ver a diferença). */
const VALORES = { segurados: 452.7, individuais: 178.31, patronal: 1168.15, terceiros: 239.01, adicional: 97.26 };

/**
 * O INSS a recolher de teste: a provisão de cada mês (segurados, pró-labore, patronal e terceiros), o pagamento da guia
 * no dia 20 do mês seguinte e as guias (com o Adicional GILRAT, que o sistema não provisiona). No último mês, a
 * patronal provisionada fica 10,00 menor que a guia.
 */
export function inssDeTeste(meses: readonly string[]): { razao: RazaoDaConta; guias: GuiaDoInss[] } {
  const ms = [...new Set(meses)].sort();
  const porMes: { mes: string; linhas: Linha[] }[] = [];
  const guias: GuiaDoInss[] = [];
  ms.forEach((mes, i) => {
    const ultimo = i === ms.length - 1;
    const patronal = centavos(VALORES.patronal - (ultimo ? 10 : 0));
    const ref = '<' + mesBR(mes) + '>';
    const provisoes: Linha[] = [
      [28, '40001', 'Salários a Pagar', VALORES.segurados, 'Pelo valor de INSS descontado em folha a recolher  ' + ref + ' FUNCIONARIO TESTE'],
      [28, '36006', 'Pro Labore a Pagar', VALORES.individuais, 'Pelo valor de INSS a recolher descontado s/ retirada pró-labore  ' + ref + ' SOCIO TESTE'],
      [28, '81002', 'INSS-Encargos da Empresa', VALORES.terceiros, 'Pelo valor de INSS terceiros a recolher ' + ref],
      [28, '81002', 'INSS-Encargos da Empresa', patronal, 'Pelo valor de INSS empresa a recolher ' + ref],
    ];
    const pago = i > 0 ? guias[i - 1] : null;
    const linhas: Linha[] = [
      ...(pago ? [[20, '10503', 'Banco Sicoob - 01', -pago.total, 'Pagamento de INSS ref ' + mesBR(pago.competencia) + ' conforme DARF.'] as Linha] : []),
      ...provisoes,
    ];
    porMes.push({ mes, linhas });
    const venc = seguinte(mes) + '-20';
    const itens = [
      { codigo: '1082', variacao: '01', descricao: 'Contrib Previd Descontada de Segurados', principal: VALORES.segurados },
      { codigo: '1099', variacao: '01', descricao: 'Contrib Prev Descontada de Segurado Contribuinte Individual', principal: VALORES.individuais },
      { codigo: '1138', variacao: '01', descricao: 'Contribuição Previdenciária Empregador/Empresa', principal: VALORES.patronal },
      { codigo: '1141', variacao: '01', descricao: 'Contribuição Adicional Risco Ambiental/Aposent Especial', principal: VALORES.adicional },
      { codigo: '1170', variacao: '01', descricao: 'Contribuição Terceiros - Salário Educação', principal: VALORES.terceiros },
    ].map(it => ({ ...it, total: it.principal }));
    const total = centavos(itens.reduce((s, it) => s + it.principal, 0));
    guias.push({ competencia: mes, numero: '0716260' + mes.replace('-', ''), vencimento: venc, pagaEm: venc, itens, principal: total, total });
  });
  return { razao: montar(porMes, 0), guias };
}

/** Uma conta do passivo da folha com o razão próprio na etapa Salários, INSS e FGTS (Vitor, 07/10/2026). */
export type ContaDaFolha = 'salarios' | 'fgts' | 'prolabore';

/** As contas que têm de zerar (a obrigação do mês de antes paga no mês): Salários e Pró-labore (Vitor, 07/10/2026). */
export const CONTAS_QUE_ZERAM: readonly ContaDaFolha[] = ['salarios', 'prolabore'];

const TEXTO_DA_FOLHA: Record<ContaDaFolha, { base: number; contra: string; nome: string; paga: string; entra: string }> = {
  salarios: { base: 12480.5, contra: '41201', nome: 'Salários e ordenados', paga: 'Pagamento dos salários de ', entra: 'Folha de pagamento de ' },
  fgts: { base: 1004.2, contra: '41205', nome: 'FGTS', paga: 'Pagamento do FGTS de ', entra: 'FGTS sobre a folha de ' },
  prolabore: { base: 3036, contra: '41210', nome: 'Pró-labore', paga: 'Pagamento do pró-labore de ', entra: 'Pró-labore de ' },
};

/**
 * O razão de teste de Salários a pagar ou do FGTS a recolher (o ⚡): a folha (ou a guia) do mês entra a crédito e é paga
 * no mês seguinte; o último mês fica credor. Com devedor, o pagamento do último mês sai a maior e o mês fecha devedor; com
 * sobra, sai a menor e a folha de antes não zera.
 */
export function razaoDaFolhaDeTeste(meses: readonly string[], conta: ContaDaFolha, erro: boolean | 'devedor' | 'sobra'): RazaoDaConta {
  const comDevedor = erro === true || erro === 'devedor';
  const x = TEXTO_DA_FOLHA[conta];
  const base = x.base;
  const porMes = meses.map((mes, i) => {
    const valor = centavos(base + i * 137.35);
    const anterior = i > 0 ? centavos(base + (i - 1) * 137.35) : 0;
    // com sobra: a folha do penúltimo mês paga a menos no último (o saldo antigo não zera)
    const pago = comDevedor && i === meses.length - 1 ? centavos(anterior + valor + 850)
      : erro === 'sobra' && i === meses.length - 1 ? centavos(anterior - 640) : anterior;
    const linhas: Linha[] = [];
    if (i > 0) linhas.push([5, '10503', 'Banco Sicoob', -pago, x.paga + mesBR(meses[i - 1])]);
    linhas.push([28, x.contra, x.nome, valor, x.entra + mesBR(mes)]);
    return { mes, linhas };
  });
  return montar(porMes, 0);
}
