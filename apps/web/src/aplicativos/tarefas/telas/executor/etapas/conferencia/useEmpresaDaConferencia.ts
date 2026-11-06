// ViewModel da etapa Conferência fiscal: a empresa da Tarefa na Conferência (pelo código; o nome lá pode ser outro).
import { empresas } from '@nads/core';
import { useCarregando } from '@nads/ui';
import { useRepo, useVersaoDoRepo } from '../../../../etapas/conferencia/dados/repo';
import { useEtapaAberta } from '../contexto';

export function useEmpresaDaConferencia() {
  const e = useEtapaAberta();
  const repo = useRepo();
  useVersaoDoRepo();
  const pronto = repo.pronto();
  useCarregando(!pronto);
  const rotaDaTarefa = empresas.rotaDaEmpresa({ nome: e.nome, codigo: e.codigo, regime: '' });
  // sem ela na lista da Conferência, a da Tarefa
  const achada = pronto ? repo.empresaPelaRota(rotaDaTarefa) : null;
  return { pronto, nome: achada?.nome || e.nome, rota: achada?.rota || rotaDaTarefa, codigo: e.codigo };
}
