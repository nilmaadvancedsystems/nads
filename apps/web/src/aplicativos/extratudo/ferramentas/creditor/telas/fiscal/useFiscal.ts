// ViewModel da etapa Fiscal: o passo a passo entre o relatório conferido e a planilha do sistema.
// No Fiscal, baixar os títulos dos clientes no Gerenciador de Duplicatas e exportar para o Contábil;
// no Contábil, exportar a planilha dos recebimentos (a que entra na etapa Sistema). O nads não fala com
// o Fiscal: a pessoa faz lá e marca aqui. Só libera o Sistema com os três passos marcados.
import { creditor as cr } from '@nads/core';
import { PASSOS_FISCAL, useSessao, type PassoFiscal } from '../../casca/sessao';

const TEXTO: Record<PassoFiscal, { titulo: string; texto: string }> = {
  baixar: {
    titulo: 'Baixar os clientes no Gerenciador de Duplicatas',
    texto: 'No Fiscal, abra o Gerenciador de Duplicatas da empresa e dê baixa nos títulos abaixo, cada um com a data de liquidação do banco e o valor cobrado.',
  },
  'exportar-contabil': {
    titulo: 'Exportar para o Contábil',
    texto: 'Ainda no Fiscal, exporte as baixas para o Contábil.',
  },
  'exportar-planilha': {
    titulo: 'Exportar a planilha',
    texto: 'No Contábil, exporte a planilha com os recebimentos (NF, Cliente, Contrapartida, Histórico, Valor). É ela que entra na próxima etapa.',
  },
};

export function useFiscal() {
  const s = useSessao();
  const feitos = s.estado.passosFiscal;
  const titulos = [...s.d.titulos].sort((a, b) => cr.ordemData(a.liquidacao) - cr.ordemData(b.liquidacao) || a.id - b.id);

  function marcar(p: PassoFiscal, feito: boolean) {
    s.mudar(e => ({ ...e, passosFiscal: feito ? [...new Set([...e.passosFiscal, p])] : e.passosFiscal.filter(x => x !== p) }));
  }

  return {
    empresa: (s.empresa.codigo != null ? s.empresa.codigo + ' – ' : '') + s.empresa.nome,
    passos: PASSOS_FISCAL.map((p, i) => ({ id: p, n: i + 1, ...TEXTO[p], feito: feitos.includes(p) })),
    marcar,
    titulos: titulos.map(t => ({ id: t.id, nf: t.nf, sacado: t.sacado, liquidacao: t.liquidacao, valor: t.valor, acrescimos: cr.r2(t.mora + t.outros), desconto: t.desconto, cobrado: cr.liquidoDoTitulo(t) })),
    total: { qtd: titulos.length, cobrado: cr.somar(titulos.map(t => cr.liquidoDoTitulo(t))) },
    podeContinuar: s.d.fiscalFeito,
    faltam: PASSOS_FISCAL.length - PASSOS_FISCAL.filter(p => feitos.includes(p)).length,
    continuar: s.proxima,
    voltar: s.anterior,
  };
}
