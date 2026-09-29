// ViewModel de "Minhas empresas": a barra de cima (competência, situação, ordem, busca e "Iniciar", que
// escolhe a empresa) e a lista com o botão de iniciar/continuar. Os números por situação ficam nos Insights.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaPagina, caminhoDoExecutor } from '../../casca/navegacao';
import { SITUACOES, useAndamento } from './andamento';

export const LIMITE = 60;
/** Quantas empresas a lista do "Iniciar" mostra de uma vez. */
export const LIMITE_INICIAR = 30;

export const ORDENS = [
  { valor: 'situacao', rotulo: 'Situação (paradas primeiro)' },
  { valor: 'codigo', rotulo: 'Código' },
  { valor: 'nome', rotulo: 'Nome' },
] as const;
type Ordem = (typeof ORDENS)[number]['valor'];

export function useMinhasEmpresas() {
  const a = useAndamento();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [buscaIniciar, setBuscaIniciar] = useState('');
  const situacao = SITUACOES.some(s => s.valor === a.params.get('situacao')) ? (a.params.get('situacao') as t.SituacaoGeral) : '';
  const ordem: Ordem = ORDENS.some(o => o.valor === a.params.get('ordem')) ? (a.params.get('ordem') as Ordem) : 'situacao';

  const achadas = busca.trim() ? new Set(empresas.buscarEmpresas(a.linhas.map(l => l.empresa), busca)) : null;
  const linhas = a.linhas.filter(l => (!situacao || l.situacao === situacao) && (!achadas || achadas.has(l.empresa)));
  if (ordem === 'codigo') linhas.sort((x, y) => (x.codigo ?? Infinity) - (y.codigo ?? Infinity));
  if (ordem === 'nome') linhas.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));

  // "Iniciar": as empresas que ainda têm etapa a fazer (paradas e em andamento primeiro), com busca própria
  const abertas = a.linhas.filter(l => l.situacao !== 'concluida');
  const achadasIniciar = buscaIniciar.trim() ? new Set(empresas.buscarEmpresas(abertas.map(l => l.empresa), buscaIniciar)) : null;
  const paraIniciar = abertas.filter(l => !achadasIniciar || achadasIniciar.has(l.empresa));

  const abrir = (rota: string) => navegar(caminhoDoExecutor(rota, a.competencia));

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
    ordem, ordens: ORDENS,
    setOrdem: (o: string) => a.mudar('ordem', o === 'situacao' ? '' : o),
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
    abrirInsights: () => navegar(caminhoDaPagina('minhas-empresas', 'insights') + '?competencia=' + a.competencia),
  };
}
