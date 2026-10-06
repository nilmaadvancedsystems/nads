// ViewModel do Painel do DP (Vitor, 06/10/2026: o Checklist Folha "no nads, de maneira que entrasse no visual"): os
// clientes da planilha do DP na competência — os números do topo, as barras (por responsável, enquadramento e
// movimento), o progresso de cada responsável e a tabela com as obrigações de cada cliente. O status sai da rotina do
// DP (o que foi feito em cada etapa), não de um tique no navegador: todo mundo vê o mesmo, mês a mês.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { caminhoDoExecutor, competenciasDaTela } from '../../casca/navegacao';
import { useDepartamentoDaTela } from '../../casca/departamento';
import { useExecucoes, useRepo } from '../../dados/repo';

/** Como cada obrigação está no mês: não tem, a fazer, feita, parada. */
export type EstadoDaObrigacao = 'nao-tem' | 'a-fazer' | 'feita' | 'parada';
export type Agrupar = 'nenhum' | 'responsavel' | 'agrupamento';

const SEM_RESPONSAVEL = 'Sem responsável';
const contar = (xs: readonly string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].map(([rotulo, qtd]) => ({ rotulo, qtd })).sort((a, b) => b.qtd - a.qtd || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
};
const nomeDe = (r: string) => (r ? r.charAt(0) + r.slice(1).toLowerCase() : SEM_RESPONSAVEL);

export function usePainelDoDp() {
  const repo = useRepo();
  const navegar = useNavigate();
  const { comDep } = useDepartamentoDaTela();
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const { execucoes, carregada } = useExecucoes(competencia, 'dp');
  const rotina = t.ROTINA_DP;
  const porNome = new Map(execucoes.map(e => [e.empresa, e]));
  const daLista = new Map(repo.listarEmpresas().filter(e => e.codigo != null).map(e => [e.codigo as number, e]));

  const [busca, setBusca] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [movimento, setMovimento] = useState('');
  const [enquadramento, setEnquadramento] = useState('');
  const [status, setStatus] = useState<'' | 'concluidas' | 'pendentes'>('');
  const [agrupamento, setAgrupamento] = useState('');
  const [agrupar, setAgrupar] = useState<Agrupar>('nenhum');

  const todas = empresas.CLIENTES_DO_DP.map(c => {
    const emp = daLista.get(c.codigo) || { codigo: c.codigo, nome: c.nome, regime: c.enquadramento };
    const ex = porNome.get(emp.nome) || null;
    const obrigacoes = empresas.OBRIGACOES_DP.map(o => {
      if (!c.obrigacoes.includes(o.id)) return { id: o.id, estado: 'nao-tem' as EstadoDaObrigacao };
      const s = t.estadoDa(ex, 'dp-' + o.id)?.situacao;
      return { id: o.id, estado: (s === 'feita' || s === 'dispensada' ? 'feita' : s === 'interrompida' ? 'parada' : 'a-fazer') as EstadoDaObrigacao };
    });
    const temAlguma = c.obrigacoes.length > 0;
    const situacao = t.situacaoGeral(ex, rotina);
    // concluída: a rotina do mês fechada (quem não tem nenhuma obrigação não tem o que fazer)
    const concluida = !temAlguma || situacao === 'concluida';
    return {
      ...c, chave: String(c.codigo), nomeNaTela: emp.nome, rota: empresas.rotaDaEmpresa(emp), responsavelNome: nomeDe(c.responsavel),
      obrigacoes, concluida, temAlguma,
      situacao: !temAlguma ? 'Nada no mês' : t.ROTULO_SITUACAO_GERAL[situacao], parada: situacao === 'parada',
    };
  });

  const achadas = busca.trim() ? new Set(empresas.buscarEmpresas(todas.map(c => ({ codigo: c.codigo, nome: c.nomeNaTela, regime: c.enquadramento })), busca).map(e => e.codigo)) : null;
  const filtradas = todas.filter(c => (!achadas || achadas.has(c.codigo)) && (!responsavel || c.responsavelNome === responsavel)
    && (!movimento || c.movimento === movimento) && (!enquadramento || c.enquadramento === enquadramento)
    && (!agrupamento || c.agrupamento === agrupamento) && (!status || (status === 'concluidas') === c.concluida))
    .sort((a, b) => a.nomeNaTela.localeCompare(b.nomeNaTela, 'pt-BR'));

  // a tabela em grupos (por responsável ou agrupamento), cada um com quantos já fecharam
  const chaveDoGrupo = (c: (typeof todas)[number]) => (agrupar === 'responsavel' ? c.responsavelNome : agrupar === 'agrupamento' ? c.agrupamento || 'Sem agrupamento' : '');
  const grupos = agrupar === 'nenhum'
    ? [{ nome: '', linhas: filtradas, feitas: 0 }]
    : [...new Set(filtradas.map(chaveDoGrupo))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(nome => {
      const linhas = filtradas.filter(c => chaveDoGrupo(c) === nome);
      return { nome, linhas, feitas: linhas.filter(c => c.concluida).length };
    });

  const concluidas = filtradas.filter(c => c.concluida).length;
  const responsaveis = contar(todas.map(c => c.responsavelNome)).map(r => r.rotulo);

  return {
    carregando: !carregada,
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => setParams({ competencia: c }),
    numeros: [
      { rotulo: 'Clientes', valor: filtradas.length, dica: '' },
      { rotulo: 'Concluídos', valor: concluidas, dica: filtradas.length ? Math.round((concluidas / filtradas.length) * 100) + '% do mês' : '' },
      { rotulo: 'Pendentes', valor: filtradas.length - concluidas, dica: '' },
      { rotulo: 'Com folha', valor: filtradas.filter(c => c.movimento === 'Folha').length, dica: '' },
      { rotulo: 'Pró-labore', valor: filtradas.filter(c => c.movimento === 'Pró-Labore').length, dica: '' },
      { rotulo: 'Sem movimento', valor: filtradas.filter(c => c.movimento === 'Sem Movimento').length, dica: '' },
      { rotulo: 'REINF autorizada', valor: filtradas.filter(c => c.reinfAutorizada).length, dica: '' },
    ],
    barras: [
      { titulo: 'Por responsável', linhas: contar(filtradas.map(c => c.responsavelNome)) },
      { titulo: 'Enquadramento', linhas: contar(filtradas.map(c => c.enquadramento)) },
      { titulo: 'Movimento', linhas: contar(filtradas.map(c => c.movimento)) },
    ],
    progresso: responsaveis.map(r => {
      const deles = filtradas.filter(c => c.responsavelNome === r);
      const feitos = deles.filter(c => c.concluida).length;
      return { nome: r, total: deles.length, feitos, pct: deles.length ? Math.round((feitos / deles.length) * 100) : 0, parados: deles.filter(c => c.parada).length };
    }).filter(r => r.total > 0),
    obrigacoesDp: empresas.OBRIGACOES_DP,
    grupos,
    quantas: filtradas.length,
    filtros: {
      busca, setBusca, responsavel, setResponsavel, movimento, setMovimento, enquadramento, setEnquadramento,
      status, setStatus, agrupamento, setAgrupamento, agrupar, setAgrupar,
      responsaveis,
      movimentos: contar(todas.map(c => c.movimento)).map(x => x.rotulo),
      enquadramentos: contar(todas.map(c => c.enquadramento)).map(x => x.rotulo),
      agrupamentos: contar(todas.map(c => c.agrupamento).filter(Boolean)).map(x => x.rotulo).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      algum: !!(busca || responsavel || movimento || enquadramento || status || agrupamento),
      limpar: () => { setBusca(''); setResponsavel(''); setMovimento(''); setEnquadramento(''); setStatus(''); setAgrupamento(''); },
    },
    /** abre a rotina do DP da empresa na competência */
    abrir: (rota: string) => navegar(comDep(caminhoDoExecutor(rota, competencia))),
  };
}

export type VmPainelDoDp = ReturnType<typeof usePainelDoDp>;
