// ViewModel da etapa Fiscal: os títulos para baixar no Fiscal (Gerenciador de Duplicatas), com a data de liquidação
// do banco e o valor cobrado. O nads não fala com o Fiscal: a pessoa faz lá. O passo a passo para marcar saiu
// (Vitor, 05/10/2026: "remove isso, não precisa"); as Contas abrem direto.
import { creditor as cr } from '@nads/core';
import { useSessao } from '../../casca/sessao';

export function useFiscal() {
  const s = useSessao();
  const titulos = [...s.d.titulos].sort((a, b) => cr.ordemData(a.liquidacao) - cr.ordemData(b.liquidacao) || a.id - b.id);
  return {
    titulos: titulos.map(t => ({ id: t.id, nf: t.nf, sacado: t.sacado, liquidacao: t.liquidacao, valor: t.valor, acrescimos: cr.r2(t.mora + t.outros), desconto: t.desconto, cobrado: cr.liquidoDoTitulo(t) })),
    total: { qtd: titulos.length, cobrado: cr.somar(titulos.map(t => cr.liquidoDoTitulo(t))) },
    continuar: s.proxima,
    voltar: s.anterior,
  };
}
