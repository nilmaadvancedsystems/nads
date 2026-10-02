// ViewModel do checklist da Contabilização da Folha (Vitor, 01/10/2026): os itens saem do balancete importado na
// Conferência (core: tarefas.checklistDaFolha) e a pessoa marca cada um ao fazer e conferir, em ordem (Vitor, 02/10/2026:
// "enquanto não concluir, não libere os próximos, começando por folha de pagamento"): só o próximo fica liberado e só
// o último marcado pode ser desmarcado. O avançar da etapa só
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
  // em ordem: o próximo depois dos marcados fica liberado; dos marcados, só o último pode ser desmarcado
  const feitos = itens ? itens.findIndex(i => !ids.includes(i.id)) : -1;
  const ateOnde = feitos < 0 ? (itens ? itens.length : 0) : feitos;
  const liberado = (i: number) => (i === ateOnde) || (i === ateOnde - 1);
  function alternar(id: string) {
    const pos = itens ? itens.findIndex(i => i.id === id) : -1;
    if (pos < 0 || !liberado(pos)) return;
    const novos = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    setMarcados({ chave, ids: novos });
    try { localStorage.setItem(chave, JSON.stringify(novos)); } catch { /* sem armazenamento: só nesta tela */ }
  }
  return {
    /** null = carregando o balancete; [] = pelo balancete, a empresa não tem folha */
    itens: itens ? itens.map((i, k) => ({ ...i, marcado: k < ateOnde, liberado: liberado(k) })) : null,
    alternar,
    /** o que falta marcar (null = ainda não dá para saber) */
    faltam: itens ? itens.slice(ateOnde).map(i => i.nome) : null,
  };
}
