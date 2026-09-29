// ViewModel de "Minhas empresas": a barra de cima (competência, situação, busca e "Iniciar", que escolhe
// a empresa) e a lista, que ordena pela coluna clicada, com o botão de iniciar/continuar. Os números por situação ficam nos Insights.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaPagina, caminhoDoExecutor } from '../../casca/navegacao';
import { SITUACOES, useAndamento } from './andamento';

export const LIMITE = 60;
/** Quantas empresas a lista do "Iniciar" mostra de uma vez. */
export const LIMITE_INICIAR = 30;

/** As colunas da tabela que ordenam (clicando no título, como na Consulta da Conferência). */
export type Coluna = 'codigo' | 'nome' | 'etapas' | 'situacao' | 'proxima';
const COLUNAS: readonly Coluna[] = ['codigo', 'nome', 'etapas', 'situacao', 'proxima'];

/** As abas do painel do Iniciar (como Local / Codespaces do botão Code do GitHub). */
export type AbaIniciar = 'escolher' | 'recentes';
/** O filtro rápido da aba Escolher (como HTTPS / SSH / GitHub CLI). */
export const FILTROS_INICIAR = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'nao-iniciada', rotulo: 'Não iniciadas' },
  { valor: 'em-andamento', rotulo: 'Em andamento' },
  { valor: 'concluida', rotulo: 'Concluídas' },
] as const;
type FiltroIniciar = (typeof FILTROS_INICIAR)[number]['valor'];
/** O filtro da aba Minhas recentes: as dos últimos dias ou as minhas paradas. */
export const FILTROS_RECENTES = [
  { valor: 'recentes', rotulo: 'Últimas acessadas' },
  { valor: 'paradas', rotulo: 'Paradas' },
] as const;
type FiltroRecentes = (typeof FILTROS_RECENTES)[number]['valor'];
/** Minhas recentes somem depois de 3 dias sem mexer. */
const RECENTE_MS = 3 * 24 * 60 * 60 * 1000;

type Linha = ReturnType<typeof useAndamento>['linhas'][number];

export function useMinhasEmpresas() {
  const a = useAndamento();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [buscaIniciar, setBuscaIniciar] = useState('');
  const [abaIniciar, setAbaIniciar] = useState<AbaIniciar>('escolher');
  const [filtroIniciar, setFiltroIniciar] = useState<FiltroIniciar>('todas');
  const [filtroRecentes, setFiltroRecentes] = useState<FiltroRecentes>('recentes');
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
    etapas: (x, y) => x.concluidas / x.total - y.concluidas / y.total,
    situacao: (x, y) => x.rotuloSituacao.localeCompare(y.rotuloSituacao, 'pt-BR'),
    proxima: (x, y) => x.proxima.localeCompare(y.proxima, 'pt-BR'),
  };
  // texto em ordem alfabética, número do menor para o maior; sem coluna escolhida fica a ordem de sempre
  if (escolhida) linhas.sort((x, y) => (dir === 'asc' ? 1 : -1) * comparar[coluna](x, y) || x.nome.localeCompare(y.nome, 'pt-BR'));

  // "Iniciar": as empresas (paradas e em andamento primeiro, concluídas no fim), com filtro rápido e busca própria
  const abertas = a.linhas.filter(l => l.situacao !== 'concluida');
  const doFiltro = a.linhas.filter(l => filtroIniciar === 'todas' || l.situacao === filtroIniciar);
  const achadasIniciar = buscaIniciar.trim() ? new Set(empresas.buscarEmpresas(doFiltro.map(l => l.empresa), buscaIniciar)) : null;
  const paraIniciar = doFiltro.filter(l => !achadasIniciar || achadasIniciar.has(l.empresa));

  const abrir = (rota: string) => navegar(caminhoDoExecutor(rota, a.competencia));

  // Minhas recentes: onde quem está trabalhando mexeu nesta competência, a mais recente primeiro. Na lista,
  // só as dos últimos 3 dias; as minhas paradas ficam no filtro Paradas até alguém retomar.
  const minhas = a.linhas.filter(l => l.mexiEm).sort((x, y) => (y.mexiEm as string).localeCompare(x.mexiEm as string));
  const agora = Date.now();
  const recentes = filtroRecentes === 'paradas'
    ? minhas.filter(l => l.situacao === 'parada')
    : minhas.filter(l => agora - Date.parse(l.mexiEm as string) <= RECENTE_MS);
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
    linhas: linhas.slice(0, LIMITE),
    total: linhas.length,
    abrir,
    // Iniciar
    buscaIniciar, setBuscaIniciar,
    paraIniciar: paraIniciar.slice(0, LIMITE_INICIAR),
    totalParaIniciar: paraIniciar.length,
    iniciar: (rota: string) => { setBuscaIniciar(''); abrir(rota); },
    abaIniciar, setAbaIniciar,
    filtroIniciar, filtrosIniciar: FILTROS_INICIAR, setFiltroIniciar,
    recentes: recentes.slice(0, LIMITE_INICIAR),
    filtroRecentes, filtrosRecentes: FILTROS_RECENTES, setFiltroRecentes,
    ultimaAberta, proximaDaFila, paradas,
    verParadas: () => { setBusca(''); a.mudar('situacao', 'parada'); },
    abrirInsights: () => navegar(caminhoDaPagina('minhas-empresas', 'insights') + '?competencia=' + a.competencia),
  };
}
