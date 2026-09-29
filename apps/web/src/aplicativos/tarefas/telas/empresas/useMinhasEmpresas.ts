// ViewModel de "Minhas empresas": a barra de cima (competência, situação, busca e "Iniciar", que escolhe
// a empresa) e a lista, que ordena pela coluna clicada, com o botão de iniciar/continuar. Os números por situação ficam nos Insights.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaEmpresa, caminhoDaPagina, caminhoDoExecutor } from '../../casca/navegacao';
import { SITUACOES, useAndamento } from './andamento';

export const LIMITE = 60;
/** Quantas empresas a lista do "Iniciar" mostra de uma vez. */
export const LIMITE_INICIAR = 30;

/** As colunas da tabela que ordenam (clicando no título, como na Consulta da Conferência). */
export type Coluna = 'codigo' | 'nome' | 'situacao';
const COLUNAS: readonly Coluna[] = ['codigo', 'nome', 'situacao'];

/** As abas do painel do Iniciar (como Local / Codespaces do botão Code do GitHub). */
export type AbaIniciar = 'escolher' | 'recentes';
/**
 * O filtro rápido da aba Empresas (como HTTPS / SSH / GitHub CLI), com os mesmos nomes da coluna Situação.
 * Sem nenhum escolhido = todas; clicar no escolhido de novo tira o filtro.
 */
export const FILTROS_INICIAR = (['nao-iniciada', 'em-andamento', 'parada'] as const).map(v => ({ valor: v, rotulo: t.ROTULO_SITUACAO_GERAL[v] }));
type FiltroIniciar = (typeof FILTROS_INICIAR)[number]['valor'] | 'todas';
/** Minhas recentes somem depois de 3 dias sem mexer. */
const RECENTE_MS = 3 * 24 * 60 * 60 * 1000;

type Linha = ReturnType<typeof useAndamento>['linhas'][number];

export function useMinhasEmpresas() {
  const a = useAndamento();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [buscaIniciar, setBuscaIniciar] = useState('');
  const [abaIniciar, setAbaIniciar] = useState<AbaIniciar>('escolher');
  /** as empresas marcadas para "Iniciar em lote" (a rota de cada uma) */
  const [lote, setLote] = useState<string[]>([]);
  const [filtroIniciar, setFiltroIniciar] = useState<FiltroIniciar>('todas');
  const situacao = SITUACOES.some(s => s.valor === a.params.get('situacao')) ? (a.params.get('situacao') as t.SituacaoGeral) : '';
  // ordem na URL (?ordem=codigo&dir=desc); sem nada = situação (paradas primeiro), sem seta no título
  const escolhida = COLUNAS.includes(a.params.get('ordem') as Coluna);
  const coluna: Coluna = escolhida ? (a.params.get('ordem') as Coluna) : 'situacao';
  const dir: 'asc' | 'desc' = a.params.get('dir') === 'desc' ? 'desc' : 'asc';

  const achadas = busca.trim() ? new Set(empresas.buscarEmpresas(a.linhas.map(l => l.empresa), busca)) : null;
  const linhas = a.linhas.filter(l => (!situacao || l.situacao === situacao) && (!achadas || achadas.has(l.empresa)));
  const comparar: Record<Coluna, (x: Linha, y: Linha) => number> = {
    codigo: (x, y) => (x.codigo ?? Infinity) - (y.codigo ?? Infinity),
    nome: (x, y) => x.nome.localeCompare(y.nome, 'pt-BR'),
    situacao: (x, y) => x.rotuloSituacao.localeCompare(y.rotuloSituacao, 'pt-BR'),
  };
  // texto em ordem alfabética, número do menor para o maior; sem coluna escolhida fica a ordem de sempre
  if (escolhida) linhas.sort((x, y) => (dir === 'asc' ? 1 : -1) * comparar[coluna](x, y) || x.nome.localeCompare(y.nome, 'pt-BR'));

  // "Iniciar": as empresas que ainda têm etapa a fazer (não faz sentido iniciar uma concluída), paradas e em
  // andamento primeiro, com filtro rápido e busca própria
  const abertas = a.linhas.filter(l => l.situacao !== 'concluida');
  const doFiltro = abertas.filter(l => filtroIniciar === 'todas' || l.situacao === filtroIniciar);
  const achadasIniciar = buscaIniciar.trim() ? new Set(empresas.buscarEmpresas(doFiltro.map(l => l.empresa), buscaIniciar)) : null;
  const paraIniciar = doFiltro.filter(l => !achadasIniciar || achadasIniciar.has(l.empresa));

  const abrir = (rota: string) => navegar(caminhoDoExecutor(rota, a.competencia));

  // Minhas recentes: onde quem está trabalhando mexeu nesta competência nos últimos 3 dias, a mais recente primeiro
  const minhas = a.linhas.filter(l => l.mexiEm).sort((x, y) => (y.mexiEm as string).localeCompare(x.mexiEm as string));
  const agora = Date.now();
  const recentes = minhas.filter(l => agora - Date.parse(l.mexiEm as string) <= RECENTE_MS);
  const ultimaAberta = minhas.find(l => l.situacao !== 'concluida') || null;
  // a fila: as linhas já vêm paradas → em andamento → não iniciadas
  const proximaDaFila = abertas[0] || null;
  const paradas = a.linhas.filter(l => l.situacao === 'parada').length;

  return {
    temRotina: a.temRotina,
    departamento: a.departamento,
    competencia: a.competencia,
    rotuloCompetencia: t.rotuloCompetencia(a.competencia),
    competencias: a.competencias,
    setCompetencia: a.setCompetencia,
    situacao,
    rotuloSituacao: SITUACOES.find(s => s.valor === situacao)?.rotulo || 'Todas',
    situacoes: SITUACOES,
    setSituacao: (s: string) => a.mudar('situacao', s),
    /** a coluna que a pessoa escolheu (null = a ordem de sempre, sem seta) */
    ordem: escolhida ? { coluna, dir } : null,
    /** clicar no título: ordena por ela em ordem crescente (A→Z, menor primeiro); clicar de novo inverte */
    ordenar: (c: Coluna) => {
      const novoDir = escolhida && c === coluna && dir === 'asc' ? 'desc' : 'asc';
      const novo = new URLSearchParams(a.params);
      novo.set('ordem', c);
      if (novoDir === 'desc') novo.set('dir', 'desc'); else novo.delete('dir');
      a.setParams(novo);
    },
    busca, setBusca,
    filtrando: !!situacao || !!busca.trim(),
    limparFiltros: () => { setBusca(''); a.mudar('situacao', ''); },
    carregando: a.carregando,
    // quando mexeram por último ("há 5 horas", "ontem"), e a data e hora completas para o título
    linhas: linhas.slice(0, LIMITE).map(l => ({
      ...l,
      quando: l.ultimaVez ? t.quandoFoi(l.ultimaVez, new Date()) : '',
      quandoCompleto: l.ultimaVez ? new Date(l.ultimaVez).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '',
    })),
    total: linhas.length,
    abrir,
    /** a página da empresa (insights dela) */
    abrirEmpresa: (rota: string) => navegar(caminhoDaEmpresa(rota, a.competencia)),
    // Iniciar
    buscaIniciar, setBuscaIniciar,
    paraIniciar: paraIniciar.slice(0, LIMITE_INICIAR),
    totalParaIniciar: paraIniciar.length,
    iniciar: (rota: string) => { setBuscaIniciar(''); abrir(rota); },
    abaIniciar, setAbaIniciar,
    // Iniciar em lote: marca as empresas (a caixinha à esquerda) e abre uma aba para cada uma
    lote, marcadaNoLote: (rota: string) => lote.includes(rota),
    alternarNoLote: (rota: string) => setLote(v => (v.includes(rota) ? v.filter(r => r !== rota) : [...v, rota])),
    podeIniciarEmLote: lote.length >= 2,
    /** os endereços do executor das marcadas (a tela abre uma aba para cada); zera a marcação */
    enderecosDoLote: () => { const r = lote.map(rota => caminhoDoExecutor(rota, a.competencia)); setLote([]); return r; },
    filtroIniciar, filtrosIniciar: FILTROS_INICIAR,
    setFiltroIniciar: (f: FiltroIniciar) => setFiltroIniciar(atual => (atual === f ? 'todas' : f)),
    recentes: recentes.slice(0, LIMITE_INICIAR),
    ultimaAberta, proximaDaFila, paradas,
    verParadas: () => { setBusca(''); a.mudar('situacao', 'parada'); },
    abrirInsights: () => navegar(caminhoDaPagina('minhas-empresas', 'insights') + '?competencia=' + a.competencia),
  };
}
