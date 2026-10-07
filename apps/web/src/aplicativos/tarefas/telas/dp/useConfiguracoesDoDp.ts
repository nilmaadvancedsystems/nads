// ViewModel das Configurações do DP (Vitor, 06/10/2026: "quero que o dp tenha a própria aba de configurações"; "faça no
// estilo do cadastro"): a lista dos clientes do DP com os parâmetros de cada um (o movimento, as obrigações do mês, a
// entrega e o agrupamento; a REINF é do Fiscal); clicar abre a janela do cliente, onde se muda. Começa com o da planilha; o que mudar
// grava no cadastro da empresa e vale nas abas do DP na hora. "Voltar à planilha" tira o que foi mudado.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../casca/navegacao';
import { useGmailDoEntregas } from '../../dados/repo';
import { useClientesDoDp } from './useClientesDoDp';

export type TopicoDoClienteDp = 'obrigacoes' | 'entrega';

/** as competências para escolher: as 3 próximas e as recentes (a mais nova primeiro) */
function competenciasDasConfiguracoes(): string[] {
  const d = new Date();
  const futuras = [3, 2, 1].map(n => { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); });
  return [...new Set([...futuras, ...competenciasDaTela(12)])].sort().reverse();
}

export function useConfiguracoesDoDp() {
  // a competência (Vitor, 07/10/2026: "configurações por competência"): o que mudar vale dela em diante; a mesma do Painel (na URL)
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDasConfiguracoes();
  const atual = competenciasDaTela(1)[0];
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : atual;
  const dp = useClientesDoDp(competencia);
  // o CNPJ/CPF de cada cliente (Sávio, 07/10/2026: "copiar o CNPJ ou CPF de cada cliente sem pontos ou traços para acesso
  // aos sites do governo"): do cadastro do Entregas, pelo código; só os dígitos
  const gmail = useGmailDoEntregas();
  const documentoDoCodigo = new Map(gmail.clientes().lista.filter(c => c.documento).map(c => [Number(c.codigo), c.documento as string]));
  // nos exemplos não há cadastro do Entregas: um CNPJ inventado pelo código, para a coluna aparecer
  if (gmail.exemplos) for (const c of dp.clientes) if (!documentoDoCodigo.has(c.codigo)) documentoDoCodigo.set(c.codigo, String(c.codigo).padStart(8, '0') + '000100');
  const [busca, setBusca] = useState('');
  const [movimento, setMovimento] = useState('');
  const [soMudados, setSoMudados] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);
  const [topico, setTopico] = useState<TopicoDoClienteDp>('obrigacoes');
  const buscaDigitos = busca.replace(/\D/g, '');
  const achadas = busca.trim()
    ? new Set([
      ...empresas.buscarEmpresas(dp.clientes.map(c => ({ codigo: c.codigo, nome: c.nomeNaTela, regime: c.enquadramento })), busca).map(e => e.codigo),
      // a busca pelo CNPJ/CPF (com ou sem pontos)
      ...(buscaDigitos.length >= 5 ? dp.clientes.filter(c => (documentoDoCodigo.get(c.codigo) || '').includes(buscaDigitos)).map(c => c.codigo) : []),
    ])
    : null;
  const rotuloDe = (id: string) => empresas.OBRIGACOES_DP.find(o => o.id === id)?.rotulo || id;
  const linhas = dp.clientes
    .filter(c => (!achadas || achadas.has(c.codigo)) && (!movimento || c.movimento === movimento) && (!soMudados || c.mudado))
    .sort((a, b) => a.nomeNaTela.localeCompare(b.nomeNaTela, 'pt-BR'))
    .map(c => ({ ...c, documento: documentoDoCodigo.get(c.codigo) || '', obrigacoesTexto: c.obrigacoes.length ? (c.obrigacoes as string[]).map(rotuloDe).join(' · ') : 'Nenhuma' }));
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
    competencia,
    rotuloCompetencia: t.rotuloCompetencia(competencia),
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia(c: string) { const n = new URLSearchParams(params); n.set('competencia', c); setParams(n); },
    mudadosNoMes: dp.clientes.filter(c => c.mudadoNoMes).length,
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
    mudarEntrega: (codigo: number, v: string) => dp.mudarDp(codigo, { entrega: v }),
    mudarAgrupamento: (codigo: number, v: string) => dp.mudarDp(codigo, { agrupamento: v.trim() }),
    voltarAPlanilha: (codigo: number) => dp.voltar(codigo, false),
    /** tira só o que foi mudado nesta competência */
    desfazerMes: (codigo: number) => dp.voltar(codigo, true),
  };
}
