// O andamento das empresas na competência, usado pela lista (Empresas) e pelos números (Insights):
// a competência escolhida (na URL), e para cada empresa as etapas feitas, a situação e a próxima etapa.
import { empresas, tarefas as t } from '@nads/core';
import { useSearchParams } from 'react-router';
import { useExecucoes, useExecucoesDoPeriodo, useRepo } from '../../dados/repo';
import { useOperador, type Operador } from '../../casca/operador';
import { competenciasDaTela } from '../../casca/navegacao';
import { useDepartamentoDaTela } from '../../casca/departamento';

export const SITUACOES: readonly { valor: t.SituacaoGeral; rotulo: string }[] = [
  { valor: 'parada', rotulo: 'Paradas' },
  { valor: 'em-andamento', rotulo: 'Em andamento' },
  { valor: 'nao-iniciada', rotulo: 'Não iniciadas' },
  { valor: 'concluida', rotulo: 'Concluídas' },
];

const ORDEM: Record<t.SituacaoGeral, number> = { parada: 0, 'em-andamento': 1, 'nao-iniciada': 2, concluida: 3 };
export const ACAO: Record<t.SituacaoGeral, string> = { parada: 'Retomar', 'em-andamento': 'Continuar', 'nao-iniciada': 'Iniciar', concluida: 'Ver' };

/** Quantos meses para trás procurar trabalho em progresso (o que a página da empresa também mostra no histórico). */
export const MESES_EM_PROGRESSO = 6;

export function useAndamento() {
  const repo = useRepo();
  const op = useOperador().operador as Operador;
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  // a rotina da tela: a do Fiscal no módulo Fiscal; senão, a do departamento da pessoa
  const { dep } = useDepartamentoDaTela();
  const rotina = t.rotinaDo(dep);
  // sem competência no endereço, a que tem trabalho em progresso vem primeiro, mesmo com o mês virado (Vitor, 07/10/2026)
  const recentes = useExecucoesDoPeriodo(competencias.slice(0, MESES_EM_PROGRESSO), dep);
  const emProgresso = rotina && recentes.carregada ? t.competenciaEmProgresso(recentes.porMes, rotina) : null;
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : emProgresso || competencias[0];
  const { execucoes, carregada } = useExecucoes(competencia, dep);
  const porNome = new Map(execucoes.map(e => [e.empresa, e]));

  // as empresas da rotina: o DP, os clientes da planilha do DP; o Contábil e o Fiscal, a lista do escritório
  const linhas = rotina ? t.empresasDaRotina(dep, repo.listarEmpresas()).map(emp => {
    const ex = porNome.get(emp.nome) || null;
    const p = t.progresso(ex, rotina);
    const situacao = t.situacaoGeral(ex, rotina);
    const proxima = t.proximaEtapa(ex, rotina);
    // a última vez que quem está trabalhando mexeu nesta empresa (para 'Minhas recentes' do Iniciar)
    const minhas = ex ? Object.values(ex.etapas).filter(e => e.por === op.nome).map(e => e.em) : [];
    const mexiEm = minhas.length ? minhas.reduce((x, y) => (y > x ? y : x)) : null;
    return {
      empresa: emp, chave: (emp.codigo ?? '') + emp.nome, codigo: emp.codigo, nome: emp.nome, rota: empresas.rotaDaEmpresa(emp),
      concluidas: p.concluidas, total: p.total, situacao, rotuloSituacao: t.ROTULO_SITUACAO_GERAL[situacao],
      proxima: proxima ? proxima.nome : '—', acao: ACAO[situacao], mexiEm,
      // a etapa em que a empresa está (em branco se ainda não começou ou já terminou)
      etapaAtual: situacao === 'nao-iniciada' || !proxima ? '' : proxima.nome,
      // a última vez que alguém mexeu nesta empresa na competência (de qualquer pessoa)
      ultimaVez: t.ultimaVez(ex),
    };
  }).sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao]) : [];

  /** Muda um parâmetro da URL mantendo os outros (competência, situação). */
  function mudar(chave: string, valor: string) {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor); else novo.delete(chave);
    setParams(novo);
  }

  return {
    temRotina: !!rotina,
    departamento: op.departamento,
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => mudar('competencia', c),
    /** a competência veio no endereço (voltou de outra tela): não pergunta de novo */
    competenciaEscolhida: params.has('competencia'),
    /** os últimos meses já carregados: dá para saber qual competência está em progresso */
    sabeOEmProgresso: recentes.carregada,
    params, setParams, mudar,
    carregando: !carregada,
    linhas,
    contar: (s: t.SituacaoGeral) => linhas.filter(l => l.situacao === s).length,
  };
}
