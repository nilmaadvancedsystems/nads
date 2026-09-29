// ViewModel de "Minhas empresas": a competência, o filtro de situação, a busca e a lista com o botão
// de iniciar/continuar. Os números por situação ficam nos Insights.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDoExecutor } from '../../casca/navegacao';
import { SITUACOES, useAndamento } from './andamento';

export const LIMITE = 60;

export function useMinhasEmpresas() {
  const a = useAndamento();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const situacao = SITUACOES.some(s => s.valor === a.params.get('situacao')) ? (a.params.get('situacao') as t.SituacaoGeral) : '';

  const achadas = busca.trim() ? new Set(empresas.buscarEmpresas(a.linhas.map(l => l.empresa), busca)) : null;
  const linhas = a.linhas.filter(l => (!situacao || l.situacao === situacao) && (!achadas || achadas.has(l.empresa)));

  return {
    temRotina: a.temRotina,
    departamento: a.departamento,
    competencia: a.competencia,
    competencias: a.competencias,
    setCompetencia: a.setCompetencia,
    situacao,
    situacoes: SITUACOES,
    setSituacao: (s: string) => a.mudar('situacao', s),
    busca, setBusca,
    carregando: a.carregando,
    linhas: linhas.slice(0, LIMITE),
    total: linhas.length,
    abrir: (rota: string) => navegar(caminhoDoExecutor(rota, a.competencia)),
  };
}
