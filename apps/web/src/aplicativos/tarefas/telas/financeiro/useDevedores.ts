// ViewModel de Financeiro › Devedores (22/10/2026, o item 2 da lista do Painel: "inadimplência por cliente"): quem está
// devendo honorários, quantos meses e quanto (financeiro.inadimplencia), a busca e o Receber de cada mês (a mesma janela
// dos Honorários). Sem cobrança daqui: o Cobrar dos Honorários saiu a pedido em 21/10/2026.
import { financeiro } from '@nads/core';
import { useMemo, useState } from 'react';
import { useHonorarios } from '../../dados/repo';
import { hoje } from './formatosDaNota';

export function useDevedores() {
  const repo = useHonorarios();
  const contratos = repo.contratos();
  const recebimentos = repo.recebimentos();
  const [busca, setBusca] = useState('');
  const [recebendo, setRecebendo] = useState<{ contratoId: string; competencia: string } | null>(null);
  const r = useMemo(() => financeiro.inadimplencia(contratos.lista, recebimentos.lista, hoje()), [contratos.lista, recebimentos.lista]);
  const q = busca.trim().toLowerCase();
  const linhas = r.devedores.filter(d => !q || (d.contrato.nome + ' ' + d.contrato.codigo + ' ' + d.contrato.cnpj).toLowerCase().includes(q));
  return {
    carregando: !contratos.carregada || !recebimentos.carregada,
    erro: contratos.erro || recebimentos.erro,
    exemplos: repo.exemplos,
    busca, setBusca,
    desde: financeiro.competenciaBr(r.inicio),
    ate: financeiro.competenciaBr(r.ate),
    numeros: { total: r.total, devendo: r.devedores.length, emDia: r.emDia, meses: r.devedores.reduce((s, d) => s + d.meses.length, 0) },
    linhas: linhas.map(d => ({ ...d, mesesBr: d.meses.map(m => ({ competencia: m, rotulo: financeiro.competenciaBr(m) })) })),
    recebendo,
    receber: (contratoId: string, competencia: string) => setRecebendo({ contratoId, competencia }),
    fecharReceber: () => setRecebendo(null),
  };
}
