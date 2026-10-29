// ViewModel de Financeiro › Fornecedores (28/10/2026: "o cadastro de fornecedores do Toriba, no nads"): a busca, o filtro
// (Ativos, Todos), as linhas (com a conta contábil que o fornecedor traz e quantas contas a pagar ele tem) e a janela do
// fornecedor (novo ou aberto para alterar).
import { financeiro } from '@nads/core';
import { useMemo, useState } from 'react';
import { useCaixa, useContasPagar } from '../../dados/repo';

export type FiltroDeFornecedores = 'ativos' | 'todos';
export const FILTROS_DE_FORNECEDORES: { valor: FiltroDeFornecedores; rotulo: string }[] = [
  { valor: 'ativos', rotulo: 'Ativos' },
  { valor: 'todos', rotulo: 'Todos' },
];

/** a janela do fornecedor: sem id é novo */
export interface FornecedorAberto { id?: string }

export function useFornecedores() {
  const repo = useContasPagar();
  const plano = useCaixa().plano();
  const fornecedores = repo.fornecedores();
  const contas = repo.contas();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDeFornecedores>('ativos');
  const [aberto, setAberto] = useState<FornecedorAberto | null>(null);
  const quantas = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contas.lista) m.set(c.fornecedorId, (m.get(c.fornecedorId) || 0) + 1);
    return m;
  }, [contas.lista]);

  const q = busca.trim().toLowerCase();
  const qd = busca.replace(/\D/g, '');
  const linhas = fornecedores.lista
    .filter(f => (filtro === 'todos' || f.ativo) && (!q || (f.razaoSocial + ' ' + f.nomeFantasia).toLowerCase().includes(q) || (qd.length >= 3 && f.documento.includes(qd))))
    .map(f => {
      const conta = plano.lista.find(c => c.id === financeiro.contaPadraoDoFornecedor(f, plano.lista));
      return { fornecedor: f, nome: financeiro.nomeDoFornecedor(f), conta, contas: quantas.get(f.id) || 0 };
    });

  return {
    carregando: !fornecedores.carregada || !plano.carregada,
    erro: fornecedores.erro,
    exemplos: repo.exemplos,
    total: fornecedores.lista.length,
    busca, setBusca, filtro, setFiltro, linhas,
    aberto, abrir: (a: FornecedorAberto) => setAberto(a), fechar: () => setAberto(null),
  };
}
