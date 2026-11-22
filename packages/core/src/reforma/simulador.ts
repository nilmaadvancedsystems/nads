// O simulador do Simples na Reforma (22/11/2026): a partir de 2027 a empresa do Simples escolhe recolher a CBS e o IBS
// dentro do DAS (como hoje o PIS e a COFINS) ou fora dele, pelo regime regular. Para o escritório orientar o cliente:
//   - dentro do DAS: o DAS do mês segue igual (a parte do PIS e da COFINS vira CBS) e quem compra dele, sendo
//     contribuinte, só toma de crédito o que o DAS tem de CBS/IBS daquela venda;
//   - fora do DAS: o DAS sai sem essa parte e a empresa paga a CBS e o IBS pela alíquota cheia, descontando o crédito das
//     compras; quem compra dele toma o crédito cheio.
// O que pesa é quanto da receita vai para empresas que tomam crédito: para elas, comprar de quem está fora do DAS vale
// mais. É simulação: as alíquotas são parâmetros (a de referência da CBS de 2027 ainda não foi publicada) e o preço de
// venda fica o mesmo nos dois casos (HIPOTESES, que a tela mostra).

export interface EntradaDoSimulador {
  /** a receita do mês (R$) */
  receita: number;
  /** o DAS do mês pelas regras de hoje (R$) */
  das: number;
  /** a parte do PIS e da COFINS dentro do DAS (R$): a que vira CBS a partir de 2027 */
  pisCofinsNoDas: number;
  /** quanto da receita (0 a 100%) vai para empresas que tomam crédito de CBS/IBS */
  parteParaContribuintes: number;
  /** as compras do mês que dariam crédito de CBS/IBS fora do DAS (mercadoria para revenda, insumos), em R$ */
  comprasComCredito: number;
  /** a alíquota da CBS (%) — estimativa até a Receita publicar a de referência */
  aliquotaCbs: number;
  /** a alíquota do IBS (%) — 0,1 em 2027 e 2028 */
  aliquotaIbs: number;
}

export interface LadoDoSimulador {
  /** o que a empresa paga no mês (R$): o DAS e, fora dele, a CBS e o IBS */
  imposto: number;
  /** o DAS do mês (R$) */
  das: number;
  /** a CBS e o IBS pagos fora do DAS, já com o crédito das compras (R$); 0 dentro do DAS */
  cbsIbsFora: number;
  /** o crédito que os clientes contribuintes tomam no mês (R$) */
  creditoDosClientes: number;
}

export type SugestaoDoSimulador = 'dentro' | 'fora' | 'tanto-faz';

export interface ResultadoDoSimulador {
  dentro: LadoDoSimulador;
  fora: LadoDoSimulador & { cbsIbsBruto: number; creditoDasCompras: number };
  /** quanto a empresa paga a mais fora do DAS (negativo: paga menos) */
  custoAMaisFora: number;
  /** quanto os clientes contribuintes ganham a mais de crédito fora do DAS */
  creditoAMaisFora: number;
  sugestao: SugestaoDoSimulador;
  texto: string;
}

/** O que o simulador supõe (vai para a tela, junto do resultado). */
export const HIPOTESES: readonly string[] = [
  'O preço de venda fica o mesmo nos dois casos.',
  'Dentro do DAS, a parte do PIS e da COFINS do DAS de hoje vira CBS; o IBS só entra no DAS a partir de 2029.',
  'Quem compra de empresa do Simples que recolhe dentro do DAS toma de crédito só a CBS e o IBS que o DAS tem daquela venda.',
  'Fora do DAS, a CBS e o IBS saem pela alíquota cheia, menos o crédito das compras; o DAS fica sem a parte do PIS e da COFINS.',
  'A alíquota de referência da CBS de 2027 ainda não foi publicada: confira e troque a do simulador quando sair.',
];

/** Os valores-padrão das alíquotas (%), para começar: a CBS é estimativa; o IBS, o de 2027 e 2028. */
export const ALIQUOTAS_PADRAO = { cbs: 8.8, ibs: 0.1 } as const;

const centavos = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number(n) || 0));
const reais = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A conta dos dois lados e a sugestão. */
export function simularDentroOuFora(e: EntradaDoSimulador): ResultadoDoSimulador {
  const receita = Math.max(0, Number(e.receita) || 0);
  const das = Math.max(0, Number(e.das) || 0);
  const cbsNoDas = entre(e.pisCofinsNoDas, 0, das);
  const parte = entre(e.parteParaContribuintes, 0, 100) / 100;
  const aliquota = (Math.max(0, Number(e.aliquotaCbs) || 0) + Math.max(0, Number(e.aliquotaIbs) || 0)) / 100;

  const dentro: LadoDoSimulador = { imposto: centavos(das), das: centavos(das), cbsIbsFora: 0, creditoDosClientes: centavos(cbsNoDas * parte) };

  const cbsIbsBruto = centavos(receita * aliquota);
  const creditoDasCompras = centavos(Math.max(0, Number(e.comprasComCredito) || 0) * aliquota);
  const cbsIbsFora = centavos(Math.max(0, cbsIbsBruto - creditoDasCompras));
  const dasSemCbs = centavos(das - cbsNoDas);
  const fora = {
    imposto: centavos(dasSemCbs + cbsIbsFora), das: dasSemCbs, cbsIbsFora, cbsIbsBruto, creditoDasCompras,
    creditoDosClientes: centavos(receita * parte * aliquota),
  };

  const custoAMaisFora = centavos(fora.imposto - dentro.imposto);
  const creditoAMaisFora = centavos(fora.creditoDosClientes - dentro.creditoDosClientes);
  let sugestao: SugestaoDoSimulador;
  let texto: string;
  if (!receita) {
    sugestao = 'tanto-faz';
    texto = 'Sem receita no mês, não há o que comparar.';
  } else if (custoAMaisFora <= 0) {
    sugestao = 'fora';
    texto = 'Fora do DAS a empresa paga ' + reais(-custoAMaisFora) + ' a menos no mês e os clientes contribuintes ganham ' + reais(creditoAMaisFora) + ' a mais de crédito.';
  } else if (parte * 100 < 30) {
    sugestao = 'dentro';
    texto = 'A maior parte da receita vai para quem não toma crédito (consumidor final): dentro do DAS a empresa paga ' + reais(custoAMaisFora) + ' a menos no mês.';
  } else if (creditoAMaisFora >= custoAMaisFora) {
    sugestao = 'fora';
    texto = 'Fora do DAS a empresa paga ' + reais(custoAMaisFora) + ' a mais no mês, mas os clientes contribuintes ganham ' + reais(creditoAMaisFora)
      + ' a mais de crédito: dá para negociar o preço e ficar mais competitivo com eles.';
  } else {
    sugestao = 'dentro';
    texto = 'Fora do DAS a empresa pagaria ' + reais(custoAMaisFora) + ' a mais no mês, mais do que os ' + reais(creditoAMaisFora) + ' de crédito a mais que os clientes ganhariam.';
  }
  return { dentro, fora, custoAMaisFora, creditoAMaisFora, sugestao, texto };
}
