// ViewModel das etiquetas da folha (Savio, 15/10/2026, DP › Obrigações: "preciso de um gerador de etiquetas para folhas
// de pagamento, com várias na mesma página, respeitando o limite da página"; antes de abrir, a competência e a data de
// pagamento, que saem impressas): a janela com os dois textos e a quantidade e a impressão numa página à parte (iframe)
// em A4. A competência já vem da tela e a data sugerida é o 5º dia útil do mês seguinte; os dois campos são editáveis.
import { tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { imprimirHtml } from './imprimirHtml';

export function useEtiquetasDaFolha(competencia: string) {
  const { toast } = useRetorno();
  const [aberta, setAberta] = useState(false);
  const [competenciaTexto, setCompetenciaTexto] = useState('');
  const [dataDePagamento, setDataDePagamento] = useState('');
  const [quantidade, setQuantidade] = useState('');

  const total = t.quantidadeValida(quantidade);
  const pronta = competenciaTexto.trim() !== '' && dataDePagamento.trim() !== '';
  return {
    aberta, competencia: competenciaTexto, dataDePagamento, quantidade,
    setCompetencia: setCompetenciaTexto, setDataDePagamento, setQuantidade,
    /** a quantidade que vai sair e em quantas páginas, para o aviso da janela */
    total, paginas: t.paginasDe(total), porPagina: t.ETIQUETAS_POR_PAGINA, pronta,
    abrir: () => {
      setCompetenciaTexto(t.competenciaParaEtiqueta(competencia));
      setDataDePagamento(t.quintoDiaUtilDoMesSeguinte(competencia));
      setQuantidade(String(t.ETIQUETAS_POR_PAGINA));
      setAberta(true);
    },
    fechar: () => setAberta(false),
    imprimir: () => {
      if (!pronta) return;
      imprimirHtml(t.htmlDasEtiquetas({ competencia: competenciaTexto, dataDePagamento, quantidade: total }));
      setAberta(false);
      toast('Etiquetas prontas: escolha a impressora');
    },
  };
}
