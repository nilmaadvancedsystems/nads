// ViewModel da etapa Importação: a empresa da Tarefa no Extrator (já chegou do banco? a rota dela).
import { empresas } from '@nads/core';
import { useCarregando } from '@nads/ui';
import { useRepo, useVersaoDoRepo } from '../../../../etapas/extrator/dados/repo';
import { useEtapaAberta } from '../contexto';

export function useEmpresaDaImportacao() {
  const e = useEtapaAberta();
  const repo = useRepo();
  useVersaoDoRepo();
  const carregada = repo.carregada(e.nome);
  // espera a empresa chegar do banco (antes disso não dá para gravar): só a barra do topo
  useCarregando(!carregada);
  return { carregada, nome: e.nome, codigo: e.codigo, rota: empresas.rotaDaEmpresa({ nome: e.nome, codigo: e.codigo, regime: '' }) };
}
