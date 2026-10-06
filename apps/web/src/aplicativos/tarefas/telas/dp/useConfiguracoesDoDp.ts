// ViewModel das Configurações do DP (Vitor, 06/10/2026: "quero que o dp tenha a própria aba de configurações"): os
// parâmetros de cada cliente do DP — o movimento, as obrigações do mês, a REINF, a entrega e o agrupamento. Começa com
// o da planilha; o que mudar grava no cadastro da empresa e vale no Painel (a tabela) na hora. "Voltar à planilha" tira
// o que foi mudado.
import { empresas } from '@nads/core';
import { useState } from 'react';
import { useClientesDoDp } from './useClientesDoDp';

export function useConfiguracoesDoDp() {
  const dp = useClientesDoDp();
  const [busca, setBusca] = useState('');
  const [movimento, setMovimento] = useState('');
  const [soMudados, setSoMudados] = useState(false);
  const achadas = busca.trim()
    ? new Set(empresas.buscarEmpresas(dp.clientes.map(c => ({ codigo: c.codigo, nome: c.nomeNaTela, regime: c.enquadramento })), busca).map(e => e.codigo))
    : null;
  const linhas = dp.clientes
    .filter(c => (!achadas || achadas.has(c.codigo)) && (!movimento || c.movimento === movimento) && (!soMudados || c.mudado))
    .sort((a, b) => a.nomeNaTela.localeCompare(b.nomeNaTela, 'pt-BR'));
  return {
    carregando: !dp.carregado,
    linhas,
    total: dp.clientes.length,
    mudados: dp.clientes.filter(c => c.mudado).length,
    obrigacoes: empresas.OBRIGACOES_DP,
    movimentos: empresas.MOVIMENTOS_DP,
    entregas: empresas.ENTREGAS_DP,
    agrupamentos: [...new Set(dp.clientes.map(c => c.agrupamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    busca, setBusca, movimento, setMovimento, soMudados, setSoMudados,
    mudarMovimento: (codigo: number, v: string) => dp.mudarDp(codigo, { movimento: v }),
    alternarObrigacao(codigo: number, id: string) {
      const c = dp.clientes.find(x => x.codigo === codigo);
      if (!c) return;
      const atuais: string[] = c.obrigacoes;
      dp.mudarDp(codigo, { obrigacoes: atuais.includes(id) ? atuais.filter(o => o !== id) : [...atuais, id] });
    },
    mudarReinf: (codigo: number, v: boolean) => dp.mudarDp(codigo, { reinfAutorizada: v }),
    mudarEntrega: (codigo: number, v: string) => dp.mudarDp(codigo, { entrega: v }),
    mudarAgrupamento: (codigo: number, v: string) => dp.mudarDp(codigo, { agrupamento: v.trim() }),
    voltarAPlanilha: (codigo: number) => dp.mudarDp(codigo, { movimento: null, obrigacoes: null, reinfAutorizada: null, entrega: null, agrupamento: null }),
  };
}
