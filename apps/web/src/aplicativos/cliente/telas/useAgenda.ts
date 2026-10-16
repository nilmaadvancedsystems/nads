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
  // as três colunas, como no protótipo: o que o escritório ainda faz, o que já fez e o que não precisa neste mês
  const colunas = [
    { id: 'a-fazer', titulo: 'Ainda por fazer', tom: 'warn', vazio: 'Nada pendente.', itens: itens.filter(i => i.situacao === 'a fazer') },
    { id: 'feito', titulo: 'Já feito', tom: 'ok', vazio: 'Nada feito ainda neste mês.', itens: itens.filter(i => i.situacao === 'feito') },
    { id: 'nao-se-aplica', titulo: 'Não precisa neste mês', tom: 'neutro', vazio: 'Tudo vale para a sua empresa.', itens: itens.filter(i => i.situacao === 'nao se aplica') },
  ] as const;
  return {
    mes, ultimo, mudarMes: setMes, itens, colunas,
    feitos: itens.filter(i => i.situacao === 'feito').length,
    aFazer: ac.pendenciasDaAgenda(itens).length,
  };
}
