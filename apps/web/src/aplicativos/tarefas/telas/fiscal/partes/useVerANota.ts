// Como a nota abre no "Ver" (11/11/2026: "quero que todas as maneiras de puxar danfe saia igual"): a regra é a do core
// (tarefas.sieg.comoVerANota): a NF-e e a NFC-e na DANFE idêntica à original; o CT-e, a NFS-e e a nota sem chave, no espelho.
import { tarefas as t } from '@nads/core';
import { useSieg } from '../../../dados/repo';

export function useVerANota(nota: t.sieg.NotaDoSieg): 'danfe' | 'espelho' {
  return t.sieg.comoVerANota(nota, useSieg().exemplos);
}
