// ViewModel da barra da direita do cabeçalho da Tarefas (como a do GitHub): buscar empresa ("/"), Novo ▾
// (iniciar), Continuar (a última em que a pessoa mexeu), Paradas (com o número), Minhas empresas e Você
// (trocar de pessoa, tema). Tudo na competência aberta: a da URL (?competencia=) ou a do executor.
import { empresas, tarefas as t, usuarios } from '@nads/core';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useExecucoes, useRepo } from '../dados/repo';
import { caminhoDaEmpresa, caminhoDaPagina, caminhoDoExecutor } from './navegacao';
import { EQUIPE, useOperador, type Operador } from './operador';

/** Quantas empresas a busca do cabeçalho mostra. */
const LIMITE_BUSCA = 8;

export function useBarraTarefas(competenciaDoExecutor?: string) {
  const repo = useRepo();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const { operador, escolher } = useOperador();
  const op = operador as Operador;
  const recentes = t.competenciasRecentes(new Date(), 12);
  const daUrl = params.get('competencia') || '';
  const competencia = competenciaDoExecutor || (recentes.includes(daUrl) ? daUrl : recentes[0]);
  const rotina = op.departamento === 'contabil' ? t.ROTINA_CONTABIL : null;
  const { execucoes } = useExecucoes(competencia, op.departamento);
  const porNome = new Map(execucoes.map(e => [e.empresa, e]));
  const [busca, setBusca] = useState('');

  const comQs = (caminho: string) => caminho + (caminho.includes('?') ? '&' : '?') + 'competencia=' + competencia;
  function linha(emp: empresas.EmpresaDoEscritorio) {
    const ex = porNome.get(emp.nome) || null;
    const situacao = rotina ? t.situacaoGeral(ex, rotina) : 'nao-iniciada';
    const proxima = rotina ? t.proximaEtapa(ex, rotina) : null;
    return {
      chave: (emp.codigo ?? '') + emp.nome, codigo: emp.codigo, nome: emp.nome, rota: empresas.rotaDaEmpresa(emp),
      situacao, rotuloSituacao: t.ROTULO_SITUACAO_GERAL[situacao],
      etapa: situacao === 'concluida' ? 'Concluída' : proxima ? proxima.nome : '',
    };
  }
  type Linha = ReturnType<typeof linha>;
  /** Abre a empresa: na etapa da vez (concluída: a página dela). */
  const abrir = (l: Linha) => navegar(l.situacao === 'concluida' ? caminhoDaEmpresa(l.rota, competencia) : caminhoDoExecutor(l.rota, competencia));

  const todas = repo.listarEmpresas();
  const achadas = busca.trim() ? empresas.buscarEmpresas(todas, busca).slice(0, LIMITE_BUSCA).map(linha) : [];
  const linhas = rotina ? todas.map(linha) : [];
  const paradas = linhas.filter(l => l.situacao === 'parada').length;
  // Continuar: a empresa (não concluída) em que quem está trabalhando mexeu por último nesta competência
  const minhaUltima = rotina ? execucoes
    .map(ex => ({ ex, em: Object.values(ex.etapas).filter(e => e.por === op.nome).map(e => e.em).sort().pop() || '' }))
    .filter(x => x.em && t.situacaoGeral(x.ex, rotina) !== 'concluida')
    .sort((a, b) => b.em.localeCompare(a.em))[0] : undefined;
  const empresaUltima = minhaUltima ? todas.find(e => e.nome === minhaUltima.ex.empresa) : undefined;
  const continuar = empresaUltima ? linha(empresaUltima) : null;
  const fila = linhas.filter(l => l.situacao === 'parada').concat(linhas.filter(l => l.situacao === 'em-andamento'), linhas.filter(l => l.situacao === 'nao-iniciada'));
  const proximaDaFila = fila[0] || null;
  const listaDeEmpresas = comQs(caminhoDaPagina('minhas-empresas', 'empresas'));

  return {
    temRotina: !!rotina,
    busca, setBusca, achadas,
    abrir: (l: Linha) => { setBusca(''); abrir(l); },
    continuar,
    irContinuar: () => { if (continuar) abrir(continuar); },
    paradas,
    irParadas: () => navegar(comQs(caminhoDaPagina('minhas-empresas', 'empresas') + '?situacao=parada')),
    irMinhasEmpresas: () => navegar(listaDeEmpresas),
    /** Novo ▾ → Iniciar empresa: a lista com o painel "Iniciar" já aberto */
    iniciar: () => navegar(listaDeEmpresas, { state: { iniciar: Date.now() } }),
    proximaDaFila,
    irProximaDaFila: () => { if (proximaDaFila) abrir(proximaDaFila); },
    pessoa: { nome: op.nome, iniciais: usuarios.iniciais(op.nome), cargo: (() => { const u = EQUIPE.find(x => x.nome === op.nome); return u ? usuarios.rotuloDoCargo(u) : ''; })() },
    trocarPessoa: () => escolher(null),
  };
}
