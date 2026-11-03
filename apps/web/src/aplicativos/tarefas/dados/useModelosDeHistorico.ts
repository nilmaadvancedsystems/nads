// Os textos e códigos dos históricos do Contábil (Contábil › Configurações), ao vivo, para as etapas que exportam Excel.
// Enquanto o documento não chega do banco, vale o padrão: a tela não espera.
import { tarefas as tf } from '@nads/core';
import { useEffect, useSyncExternalStore } from 'react';
import { repoDoHistoricosContabil } from './historicosContabil.firestore';

export function useModelosDeHistorico(): tf.ModelosDoHistorico {
  const repo = repoDoHistoricosContabil();
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return repo.modelos();
}

/** Para a tela de configurações: os modelos, se já chegaram, o salvar (só depois de chegarem) e o aviso de erro. */
export function useHistoricosDoContabil(aviso: (mensagem: string) => void) {
  const repo = repoDoHistoricosContabil();
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  useEffect(() => { repo.definirAviso(aviso); }, [repo, aviso]);
  return {
    modelos: repo.modelos(),
    carregados: repo.carregados(),
    salvar: (m: tf.ModelosDoHistorico) => repo.salvar(m),
  };
}
