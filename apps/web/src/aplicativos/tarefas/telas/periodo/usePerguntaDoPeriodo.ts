// ViewModel da pergunta "Quais meses?" (Vitor, 02/10/2026: "quando iniciar, uma popup pergunta qual mês ou meses ele
// quer fazer; não vai ter seleção mais na ferramenta, só a informação"). Ao iniciar uma empresa (a lista ou a página
// dela), escolhe De e Até: o mesmo mês = um mês; meses diferentes = Em lote (todas as etapas no período inteiro).
import { tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDoExecutor } from '../../casca/navegacao';

export interface PedidoDoPeriodo {
  rota: string; nome: string; de: string; ate: string;
  /** alterar o período do Em lote (o menu do executor): outro título e botão, e quem escolhe é o executor */
  titulo?: string; botao?: string; aoEscolher?: (rota: string) => void;
}

export function usePerguntaDoPeriodo() {
  const navegar = useNavigate();
  const [pedido, setPedido] = useState<PedidoDoPeriodo | null>(null);
  // os meses que dá para escolher: os últimos 12, do mais velho para o mais novo
  const [meses] = useState(() => t.competenciasRecentes(new Date(), 12).reverse().map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })));
  const qtd = pedido ? t.competenciasDoPeriodo(t.rotaDoPeriodo(pedido.de, pedido.ate)).length : 0;
  return {
    pedido, meses, qtd,
    /** abre a pergunta para a empresa, já com o mês que estava escolhido na tela */
    perguntar: (rota: string, nome: string, competencia: string, mais?: Partial<PedidoDoPeriodo>) => setPedido({ rota, nome, de: competencia, ate: competencia, ...mais }),
    setDe: (de: string) => setPedido(p => (p ? { ...p, de, ate: p.ate < de ? de : p.ate } : p)),
    setAte: (ate: string) => setPedido(p => (p ? { ...p, ate, de: p.de > ate ? ate : p.de } : p)),
    cancelar: () => setPedido(null),
    iniciar: () => {
      if (!pedido) return;
      const rota = pedido.de === pedido.ate ? pedido.de : t.rotaDoPeriodo(pedido.de, pedido.ate);
      setPedido(null);
      if (pedido.aoEscolher) pedido.aoEscolher(rota);
      else navegar(caminhoDoExecutor(pedido.rota, rota));
    },
  };
}
