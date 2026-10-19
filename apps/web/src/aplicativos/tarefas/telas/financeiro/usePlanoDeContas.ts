// ViewModel de Financeiro › Plano de contas (19/10/2026: "o Plano de Contas do Toriba, no nads"): a árvore em linhas (a
// ordem de desenhar, com a fundura), a busca e qual conta está aberta na janela (nova, ou aberta para alterar).
import { financeiro } from '@nads/core';
import { useMemo, useState } from 'react';
import { useCaixa } from '../../dados/repo';

/** a janela da conta: id vazio é nova; `pai` já vem escolhido (o "Nova subconta") */
export interface ContaAberta { id?: string; pai?: string }

export function usePlanoDeContas() {
  const repo = useCaixa();
  const plano = repo.plano();
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<ContaAberta | null>(null);
  const todas = useMemo(() => financeiro.planoEmLinhas(plano.lista), [plano.lista]);
  const q = busca.trim().toLowerCase();
  // com busca, a lista fica reta (as contas que batem, sem recuo); sem busca, a árvore
  const linhas = q ? plano.lista.filter(c => (c.codigo + ' ' + c.descricao).toLowerCase().includes(q)).map(c => ({ conta: c, fundo: 0 })) : todas;
  return {
    carregando: !plano.carregada, erro: plano.erro, exemplos: repo.exemplos,
    total: plano.lista.length, linhas, busca, setBusca,
    aberta, abrir: (c: ContaAberta) => setAberta(c), fechar: () => setAberta(null),
  };
}
