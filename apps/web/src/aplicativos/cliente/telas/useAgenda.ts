// ViewModel de Vencimentos (Vitor, 16/10/2026): o mês escolhido (o seletor de mês do catálogo) e o que vence nele, em ordem
// de data.
import type { areaCliente as ac } from '@nads/core';
import { useState } from 'react';
import { chaveDoMes } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

export function useAgenda({ area, hoje }: Pick<DaCasca, 'area' | 'hoje'>) {
  const atual = chaveDoMes(hoje);
  const [mes, setMes] = useState(atual);
  // até o mês que vem (o robô monta a agenda um mês na frente)
  const ultimo = chaveDoMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));
  const itens: ac.ItemDaAgenda[] = [...(area.agenda.find(a => a.mes === mes)?.itens ?? [])].sort((a, b) => a.vence.localeCompare(b.vence));
  return {
    mes, ultimo, mudarMes: setMes, itens,
  };
}
