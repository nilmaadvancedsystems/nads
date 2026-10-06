// ViewModel das Configurações do DP (Vitor, 06/10/2026: "quero que o dp tenha a própria aba de configurações"; "faça no
// estilo do cadastro"): a lista dos clientes do DP com os parâmetros de cada um (o movimento, as obrigações do mês, a
// REINF, a entrega e o agrupamento); clicar abre a janela do cliente, onde se muda. Começa com o da planilha; o que mudar
// grava no cadastro da empresa e vale nas abas do DP na hora. "Voltar à planilha" tira o que foi mudado.
import { empresas } from '@nads/core';
import { useState } from 'react';
import { useClientesDoDp } from './useClientesDoDp';

export type TopicoDoClienteDp = 'obrigacoes' | 'entrega';

export function useConfiguracoesDoDp() {
  const dp = useClientesDoDp();
  const [busca, setBusca] = useState('');
  const [movimento, setMovimento] = useState('');
  const [soMudados, setSoMudados] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);
  const [topico, setTopico] = useState<TopicoDoClienteDp>('obrigacoes');
  const achadas = busca.trim()
    ? new Set(empresas.buscarEmpresas(dp.clientes.map(c => ({ codigo: c.codigo, nome: c.nomeNaTela, regime: c.enquadramento })), busca).map(e => e.codigo))
    : null;
  const rotuloDe = (id: string) => empresas.OBRIGACOES_DP.find(o => o.id === id)?.rotulo || id;
  const linhas = dp.clientes
    .filter(c => (!achadas || achadas.has(c.codigo)) && (!movimento || c.movimento === movimento) && (!soMudados || c.mudado))
    .sort((a, b) => a.nomeNaTela.localeCompare(b.nomeNaTela, 'pt-BR'))
    .map(c => ({ ...c, obrigacoesTexto: c.obrigacoes.length ? (c.obrigacoes as string[]).map(rotuloDe).join(' · ') : 'Nenhuma' }));
  const cliente = aberto != null ? dp.clientes.find(c => c.codigo === aberto) || null : null;
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
    /** a janela do cliente (como a da empresa no Cadastro) */
    cliente,
    topico, setTopico,
    abrir: (codigo: number) => { setAberto(codigo); setTopico('obrigacoes'); },
    fechar: () => setAberto(null),
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
