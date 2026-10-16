// ViewModel da aba Agenda (Vitor, 16/10/2026): o mês que vence (o seletor de mês do catálogo) e o que o escritório faz nele.
import { areaCliente as ac } from '@nads/core';
import { useState } from 'react';
import type { DaCasca } from './useAreaCliente';

const chaveDoMes = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

export function useAgenda({ area, hoje }: DaCasca) {
  const atual = chaveDoMes(hoje);
  const [mes, setMes] = useState(atual);
  // até o mês que vem (o robô monta a agenda um mês na frente)
  const ultimo = chaveDoMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));
  const itens = area.agenda.find(a => a.mes === mes)?.itens ?? [];
  return {
    mes, ultimo, mudarMes: setMes, itens,
    feitos: itens.filter(i => i.situacao === 'feito').length,
    aFazer: ac.pendenciasDaAgenda(itens).length,
  };
}
