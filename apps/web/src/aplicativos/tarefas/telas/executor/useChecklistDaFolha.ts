// ViewModel do checklist da Contabilização da Folha (Vitor, 01/10/2026): os itens saem do balancete importado na
// Conferência (core: tarefas.checklistDaFolha) e a pessoa marca cada um ao fazer e conferir. O avançar da etapa só
// aparece com todos marcados (o "?" lista os que faltam). Os tiques ficam neste navegador, por empresa e período.
import { tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useContasDoBalancete } from '../../../concilia-ai/importadosNaEtapa';

const chaveDe = (empresa: string, meses: readonly string[]) => 'nads-folha:' + empresa + ':' + meses.join(',');

function ler(chave: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(chave) || '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}

/** ativo: a etapa da vez é a da folha; null nos itens = o balancete ainda não carregou */
export function useChecklistDaFolha(ativo: boolean, empresa: string, meses: readonly string[]) {
  const contas = useContasDoBalancete(ativo ? empresa : '');
  const chave = chaveDe(empresa, meses);
  const [marcados, setMarcados] = useState<{ chave: string; ids: string[] }>(() => ({ chave, ids: ler(chave) }));
  const ids = marcados.chave === chave ? marcados.ids : ler(chave);
  const itens = ativo && contas ? t.checklistDaFolha(contas, meses) : null;
  function alternar(id: string) {
    const novos = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    setMarcados({ chave, ids: novos });
    try { localStorage.setItem(chave, JSON.stringify(novos)); } catch { /* sem armazenamento: só nesta tela */ }
  }
  return {
    /** null = carregando o balancete; [] = pelo balancete, a empresa não tem folha */
    itens: itens ? itens.map(i => ({ ...i, marcado: ids.includes(i.id) })) : null,
    alternar,
    /** o que falta marcar (null = ainda não dá para saber) */
    faltam: itens ? itens.filter(i => !ids.includes(i.id)).map(i => i.nome) : null,
  };
}
