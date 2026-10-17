// ViewModel da agenda do mês (Vitor, 16/10/2026; hoje dentro de Guias e obrigações): o mês que vence (o seletor de mês do
// catálogo) e o que o escritório faz nele.
import { areaCliente as ac } from '@nads/core';
import { useState } from 'react';
import { chaveDoMes } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

export function useAgenda({ area, hoje }: Pick<DaCasca, 'area' | 'hoje'>) {
  const atual = chaveDoMes(hoje);
  const [mes, setMes] = useState(atual);
  // até o mês que vem (o robô monta a agenda um mês na frente)
  const ultimo = chaveDoMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));
  const itens = [...(area.agenda.find(a => a.mes === mes)?.itens ?? [])].sort((a, b) => a.vence.localeCompare(b.vence));
  return {
    mes, ultimo, mudarMes: setMes, itens,
    feitos: itens.filter(i => i.situacao === 'feito').length,
    aFazer: ac.pendenciasDaAgenda(itens).length,
  };
}
