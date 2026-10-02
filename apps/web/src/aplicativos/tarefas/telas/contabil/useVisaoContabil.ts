// ViewModel da visão do Contábil (só leitura): na competência, quantas empresas fizeram cada etapa,
// o que está parado e por quê. Mesmos dados que o executor grava.
import { tarefas as t } from '@nads/core';
import { useSearchParams } from 'react-router';
import { useExecucoes, useRepo } from '../../dados/repo';
import { competenciasDaTela } from '../../casca/navegacao';

export function useVisaoContabil() {
  const repo = useRepo();
  const [params, setParams] = useSearchParams();
  const rotina = t.ROTINA_CONTABIL;
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const { execucoes, carregada } = useExecucoes(competencia, 'contabil');
  const totalEmpresas = repo.listarEmpresas().length;

  const paradas = execucoes.flatMap(ex => rotina.etapas.flatMap(e => {
    const est = t.estadoDa(ex, e.id);
    if (!est || est.situacao !== 'interrompida') return [];
    return [{
      chave: ex.empresa + e.id, empresa: ex.empresa, codigo: ex.codigo, etapa: e.nome,
      motivo: e.objecoes.find(o => o.id === est.objecao)?.texto || (est.objecao === 'outro' ? 'Outro motivo' : est.objecao || ''),
      observacao: est.observacao || '', por: est.por, em: new Date(est.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    }];
  })).sort((a, b) => a.empresa.localeCompare(b.empresa));

  return {
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => setParams({ competencia: c }),
    carregando: !carregada,
    totalEmpresas,
    etapas: t.resumoPorEtapa(execucoes, rotina, totalEmpresas),
    objecoes: t.objecoesMaisComuns(execucoes, rotina).slice(0, 8),
    paradas,
  };
}
