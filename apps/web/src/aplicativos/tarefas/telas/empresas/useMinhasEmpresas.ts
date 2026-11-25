// ViewModel de "Minhas empresas": a barra de cima (competência, situação, busca e "Iniciar", que escolhe
// a empresa) e a lista, que ordena pela coluna clicada, com o botão de iniciar/continuar. Os números por situação ficam nos Insights.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaEmpresa, caminhoDoExecutor } from '../../casca/navegacao';
import { SITUACOES, useAndamento } from './andamento';
import { useDepartamentoDaTela } from '../../casca/departamento';

export const LIMITE = 60;
/** Quantas empresas a lista do "Iniciar" mostra de uma vez. */
export const LIMITE_INICIAR = 30;

/** As colunas da tabela que ordenam (clicando no título, como na Consulta da Conferência). */
// todas as colunas ordenam no clique (25/11/2026: "coloca a funcao de ordem crescente ou descrescente nas colunas, quando a gente
// clica, ele organiza"): o código, a empresa, o responsável, o progresso, a etapa e a última vez
export type Coluna = 'codigo' | 'nome' | 'situacao' | 'responsavel' | 'progresso' | 'etapa' | 'quando';
const COLUNAS: readonly Coluna[] = ['codigo', 'nome', 'situacao', 'responsavel', 'progresso', 'etapa', 'quando'];

/** As abas do painel do Iniciar (como Local / Codespaces do botão Code do GitHub). */
export type AbaIniciar = 'escolher' | 'recentes' | 'lote';
/**
 * O filtro rápido da aba Empresas (como HTTPS / SSH / GitHub CLI), com os mesmos nomes da coluna Situação.
 * Sem nenhum escolhido = todas; clicar no escolhido de novo tira o filtro.
 */
export const FILTROS_INICIAR = (['nao-iniciada', 'em-andamento', 'parada'] as const).map(v => ({ valor: v, rotulo: t.ROTULO_SITUACAO_GERAL[v] }));
type FiltroIniciar = (typeof FILTROS_INICIAR)[number]['valor'] | 'todas';
/** Minhas recentes somem depois de 3 dias sem mexer. */
const RECENTE_MS = 3 * 24 * 60 * 60 * 1000;

type Linha = ReturnType<typeof useAndamento>['linhas'][number];
/** A aba de Minhas empresas do Contábil: as empresas do Alterdata ou as do SCI. */
export type SistemaContabil = 'alterdata' | 'sci';

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

  // as abas do Contábil (25/11/2026: "Coloca duas abas em minhas empresas de cada contábil, aba de alterdata e aba das empresas do
  // sci"): a do Alterdata, as que não estão no SCI; a do SCI, as com "Está no SCI" no Cadastro. Na URL (?sistema=sci); sem nada,
  // o Alterdata. Os números, a lista, o Iniciar e as recentes seguem a aba
  const { dep, comDep } = useDepartamentoDaTela();
  const comAbas = dep === 'contabil';
  const sistema: SistemaContabil = comAbas && a.params.get('sistema') === 'sci' ? 'sci' : 'alterdata';
  const doSistema = comAbas ? a.linhas.filter(l => l.noSci === (sistema === 'sci')) : a.linhas;
  const achadas = busca.trim() ? new Set(empresas.buscarEmpresas(doSistema.map(l => l.empresa), busca)) : null;
  const linhas = doSistema.filter(l => (!situacao || l.situacao === situacao) && (!achadas || achadas.has(l.empresa)));
  const comparar: Record<Coluna, (x: Linha, y: Linha) => number> = {
    codigo: (x, y) => (x.codigo ?? Infinity) - (y.codigo ?? Infinity),
    nome: (x, y) => x.nome.localeCompare(y.nome, 'pt-BR'),
    situacao: (x, y) => x.rotuloSituacao.localeCompare(y.rotuloSituacao, 'pt-BR'),
    // o responsável: o próprio (em branco) primeiro, depois os outros em ordem alfabética
    responsavel: (x, y) => x.responsavel.localeCompare(y.responsavel, 'pt-BR'),
    // o progresso pela porcentagem feita
    progresso: (x, y) => t.porcentagemDe(x.concluidas, x.total) - t.porcentagemDe(y.concluidas, y.total),
    // a etapa: as sem etapa (não começou ou terminou) no fim
    etapa: (x, y) => (!x.etapaAtual ? 1 : 0) - (!y.etapaAtual ? 1 : 0) || x.etapaAtual.localeCompare(y.etapaAtual, 'pt-BR'),
    // a última vez que mexeram: a mais antiga primeiro; as que ninguém mexeu, no fim
    quando: (x, y) => (!x.ultimaVez ? 1 : 0) - (!y.ultimaVez ? 1 : 0) || (x.ultimaVez || '').localeCompare(y.ultimaVez || ''),
  };
  // texto em ordem alfabética, número do menor para o maior; sem coluna escolhida fica a ordem de sempre
  // no empate, as da pessoa antes das dos outros (25/11/2026: "Priorize as empresas do usuario em primeiro (quando o paramentro e
  // de igual para igual)"), e depois o nome
  if (escolhida) linhas.sort((x, y) => (dir === 'asc' ? 1 : -1) * comparar[coluna](x, y) || Number(x.deOutro) - Number(y.deOutro) || x.nome.localeCompare(y.nome, 'pt-BR'));

  // "Iniciar": as empresas que ainda têm etapa a fazer (não faz sentido iniciar uma concluída), paradas e em
  // andamento primeiro, com filtro rápido e busca própria
  const abertas = doSistema.filter(l => l.situacao !== 'concluida');
  const doFiltro = abertas.filter(l => filtroIniciar === 'todas' || l.situacao === filtroIniciar);
  const achadasIniciar = buscaIniciar.trim() ? new Set(empresas.buscarEmpresas(doFiltro.map(l => l.empresa), buscaIniciar)) : null;
  const paraIniciar = doFiltro.filter(l => !achadasIniciar || achadasIniciar.has(l.empresa));

  const abrir = (rota: string) => navegar(comDep(caminhoDoExecutor(rota, a.competencia)));

  // Minhas recentes: onde quem está trabalhando mexeu nesta competência nos últimos 3 dias, a mais recente primeiro
  const minhas = doSistema.filter(l => l.mexiEm).sort((x, y) => (y.mexiEm as string).localeCompare(x.mexiEm as string));
  const agora = Date.now();
  const recentes = minhas.filter(l => agora - Date.parse(l.mexiEm as string) <= RECENTE_MS);
  const ultimaAberta = minhas.find(l => l.situacao !== 'concluida') || null;
  // a fila: as linhas já vêm paradas → em andamento → não iniciadas
  const proximaDaFila = abertas[0] || null;
  const paradas = doSistema.filter(l => l.situacao === 'parada').length;

  return {
    temRotina: a.temRotina,
    departamento: a.departamento,
    podeVerTodas: a.podeVerTodas, escopo: a.escopo, filtrandoPorResponsavel: a.filtrandoPorResponsavel,
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
    /** a coluna Responsável, para o dono, o diretor e o sênior */
    verResponsavel: a.verResponsavel,
    // quando mexeram por último ("há 5 horas", "ontem"), e a data e hora completas para o título
    linhas: linhas.slice(0, LIMITE).map(l => ({
      ...l,
      quando: l.ultimaVez ? t.quandoFoi(l.ultimaVez, new Date()) : '',
      quandoCompleto: l.ultimaVez ? new Date(l.ultimaVez).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '',
      porcentagem: t.porcentagemDe(l.concluidas, l.total),
    })),
    total: linhas.length,
    /** as empresas por situação: as da pessoa (ou todas), sem a busca e a situação */
    resumo: t.resumoDoProgresso(doSistema),
    /** as abas Alterdata e SCI (só no Contábil), com quantas empresas cada uma tem */
    abasDoSistema: comAbas ? [
      { valor: 'alterdata' as SistemaContabil, rotulo: 'Alterdata', n: a.linhas.filter(l => !l.noSci).length },
      { valor: 'sci' as SistemaContabil, rotulo: 'SCI', n: a.linhas.filter(l => l.noSci).length },
    ] : null,
    sistema,
    setSistema: (s: SistemaContabil) => a.mudar('sistema', s === 'sci' ? 'sci' : ''),
    abrir,
    /** a página da empresa (insights dela) */
    abrirEmpresa: (rota: string) => navegar(comDep(caminhoDaEmpresa(rota, a.competencia))),
    // Iniciar
    buscaIniciar, setBuscaIniciar,
    paraIniciar: paraIniciar.slice(0, LIMITE_INICIAR),
    totalParaIniciar: paraIniciar.length,
    iniciar: (rota: string) => { setBuscaIniciar(''); abrir(rota); },
    /** ao entrar: a janela "Qual competência?" (sem a competência no endereço) */
    perguntarCompetencia: !a.competenciaEscolhida,
    abaIniciar, setAbaIniciar,
    // Iniciar em lote: marca as empresas (a caixinha à esquerda) e abre uma aba para cada uma
    lote, marcadaNoLote: (rota: string) => lote.includes(rota),
    /** as empresas já postas no lote (pelo "+"), na ordem em que entraram */
    loteLinhas: lote.map(rota => a.linhas.find(l => l.rota === rota)).filter((l): l is Linha => !!l),
    tirarDoLote: (rota: string) => setLote(v => v.filter(r => r !== rota)),
    alternarNoLote: (rota: string) => setLote(v => (v.includes(rota) ? v.filter(r => r !== rota) : [...v, rota])),
    podeIniciarEmLote: lote.length >= 2,
    /** as marcadas, com o endereço do executor (a tela abre uma aba para cada); zera a marcação */
    enderecosDoLote: () => {
      const r = lote.map(rota => { const l = a.linhas.find(x => x.rota === rota); return { endereco: caminhoDoExecutor(rota, a.competencia), rotulo: l ? (l.codigo != null ? l.codigo + ' · ' : '') + l.nome : rota }; });
      setLote([]);
      return r;
    },
    filtroIniciar, filtrosIniciar: FILTROS_INICIAR,
    setFiltroIniciar: (f: FiltroIniciar) => setFiltroIniciar(atual => (atual === f ? 'todas' : f)),
    recentes: recentes.slice(0, LIMITE_INICIAR),
    ultimaAberta, proximaDaFila, paradas,
    verParadas: () => { setBusca(''); a.mudar('situacao', 'parada'); },
  };
}
