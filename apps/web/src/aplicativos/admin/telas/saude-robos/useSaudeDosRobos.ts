// ViewModel da Saúde dos robôs (07/11/2026): um cartão por robô com o último batimento, o último trabalho, a fila, os erros e o
// estado (ok / atenção / parado). Os dados chegam do painel do robô (dois documentos e a atividade, ao vivo) e do
// robo/estado (o backup, lido a cada 30 s enquanto a tela está aberta); o relógio anda a cada 15 s.
import { entregas } from '@nads/core';
import { useEffect, useState } from 'react';
import { usePainelRobo, useSaudeDoRobo } from '../../../tarefas/dados/repo';

const GRAVIDADE: Record<entregas.TomDoPainel, number> = { erro: 0, aviso: 1, neutro: 2, ok: 3 };

export function useSaudeDosRobos() {
  const painel = usePainelRobo();
  const saude = useSaudeDoRobo();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const r = setInterval(() => setAgora(Date.now()), 15 * 1000); return () => clearInterval(r); }, []);

  const todos = [...entregas.cartoesDosRobos(painel, agora), entregas.cartaoDoBackup(saude?.estado ?? null, painel.vm, agora)];
  // os parados primeiro, depois os de atenção; dentro do mesmo estado, a ordem de sempre
  const cartoes = todos.map((c, i) => ({ c, i })).sort((a, b) => GRAVIDADE[a.c.tom] - GRAVIDADE[b.c.tom] || a.i - b.i).map(x => x.c);
  const placar = entregas.placarDaSaude(cartoes);
  const plural = (n: number, um: string, varios: string) => n + (n === 1 ? um : varios);

  return {
    carregando: !painel.carregado,
    exemplos: painel.exemplos,
    semPermissao: painel.semPermissao && !painel.pc && !painel.vm,
    cartoes,
    placar,
    /** o texto do placar: "Tudo funcionando", "2 robôs parados · 1 precisa de atenção" */
    resumo: placar.parados + placar.atencao === 0
      ? (placar.ok ? 'Tudo funcionando' : 'Sem informação dos robôs ainda')
      : [placar.parados ? plural(placar.parados, ' robô parado', ' robôs parados') : '', placar.atencao ? plural(placar.atencao, ' precisa de atenção', ' precisam de atenção') : ''].filter(Boolean).join(' · '),
  };
}
