// ViewModel da visão do Contábil (só leitura): na competência, quantas empresas fizeram cada etapa,
// o que está parado e por quê. Mesmos dados que o executor grava.
import { tarefas as t } from '@nads/core';
import { useSearchParams } from 'react-router';
import { useExecucoes, useRepo } from '../../dados/repo';
import { competenciasDaTela, competenciasDoDp } from '../../casca/navegacao';

export function useVisaoContabil(dep: 'contabil' | 'fiscal' | 'dp' = 'contabil') {
  const repo = useRepo();
  const [params, setParams] = useSearchParams();
  const rotina = t.rotinaDo(dep) || t.ROTINA_CONTABIL;
  // no DP, do dia 20 em diante, o mês corrente também (a folha que está fechando)
  const meses = dep === 'dp' ? competenciasDoDp(12) : { lista: competenciasDaTela(12), padrao: competenciasDaTela(1)[0] };
  const competencias = meses.lista;
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : meses.padrao;
  const { execucoes, carregada } = useExecucoes(competencia, dep);
  const daRotina = t.empresasDaRotina(dep, repo.listarEmpresas());
  const totalEmpresas = daRotina.length;
  // a rotina de cada empresa (16/10/2026): no Contábil, a 62 (com o LCDPR) só tem a etapa LCDPR
  const rotinaDe = (codigo: number | null) => t.rotinaDaEmpresa(dep, codigo) || rotina;

  const paradas = execucoes.flatMap(ex => rotinaDe(ex.codigo).etapas.flatMap(e => {
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
    // só as etapas que existem no mês do ano da competência (o Estoque só em dezembro); cada empresa na rotina dela
    etapas: t.resumoPorEtapaDasEmpresas(execucoes, daRotina.map(e => e.codigo), rotinaDe, competencia),
    // os nomes das objeções nas duas rotinas (a do departamento e a do LCDPR)
    objecoes: t.objecoesMaisComuns(execucoes, dep === 'contabil' ? { ...rotina, etapas: [...rotina.etapas, ...t.ROTINA_LCDPR.etapas] } : rotina).slice(0, 8),
    /** quanto cada etapa leva (a mediana, em minutos, na mesma sentada; 16/10/2026): onde as pessoas mais param */
    tempos: t.tempoPorEtapa(execucoes),
    paradas,
  };
}
