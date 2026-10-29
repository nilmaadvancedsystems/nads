// ViewModel da REINF (Fiscal › REINF; Vitor, 05/10/2026): a competência, as empresas obrigadas com a situação de cada
// uma, a busca, o filtro (Todas / Pendentes / Transmitidas) e as ações (Transmitir, Desfazer, Retificar), que ficam em
// useAcoesDaReinf (o Relatório geral usa as mesmas).
import { tarefas as t } from '@nads/core';
import { useEmpresasPermitidas } from '../../empresas/andamento';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useRepo } from '../../../dados/repo';
import { mmaaaa, quandoDaReinf, useAcoesDaReinf } from './useAcoesDaReinf';

export { estadosDaReinf } from './useAcoesDaReinf';

type Filtro = 'todas' | 'pendentes' | 'transmitidas';

export function useReinf() {
  const repo = useRepo();
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const acoes = useAcoesDaReinf(competencia);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const nomes = new Map(repo.listarEmpresas().map(e => [e.codigo, e.nome]));
  const permitidas = useEmpresasPermitidas();
  const lista = t.EMPRESAS_REINF.filter(e => permitidas.pode({ codigo: e.codigo, nome: nomes.get(e.codigo) || e.nome })).map(e => ({ ...e, nome: nomes.get(e.codigo) || e.nome, estado: acoes.estados[e.codigo] }));
  const resumo = t.resumoReinf(lista.map(l => l.estado), competencia);
  const q = busca.trim().toLowerCase();
  const linhas = lista
    .filter(l => !q || (l.codigo + ' ' + l.nome).toLowerCase().includes(q))
    .filter(l => filtro === 'todas' || (filtro === 'pendentes') === (t.situacaoReinf(l.estado, competencia) === 'pendente'))
    .map(l => {
      const sit = t.situacaoReinf(l.estado, competencia);
      return {
        codigo: l.codigo, nome: l.nome, transmitida: sit === 'transmitida',
        ate: l.estado.transmitidoAte ? mmaaaa(l.estado.transmitidoAte) : '—',
        ultima: l.estado.ultima ? quandoDaReinf(l.estado.ultima.em) + ' · ' + l.estado.ultima.por : '',
        retificadas: l.estado.retificadas.map(mmaaaa),
        retificadaNaCompetencia: l.estado.retificadas.includes(competencia),
      };
    });

  return {
    competencia, rotuloCompetencia: t.rotuloCompetencia(competencia),
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => setParams({ competencia: c }),
    resumo, linhas, busca, setBusca, filtro, setFiltro,
    transmitir: acoes.transmitir, desfazer: acoes.desfazer, retificar: acoes.retificar,
  };
}
