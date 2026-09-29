// ViewModel de "Minhas empresas": a competência, a busca e, para cada empresa, o andamento das etapas
// e o botão de iniciar/continuar. Quem ainda não está parado ou concluído vem primeiro.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useExecucoes, useRepo } from '../../dados/repo';
import { caminhoDoExecutor } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';

export const LIMITE = 60;

const ORDEM: Record<t.SituacaoGeral, number> = { parada: 0, 'em-andamento': 1, 'nao-iniciada': 2, concluida: 3 };
const ACAO: Record<t.SituacaoGeral, string> = { parada: 'Retomar', 'em-andamento': 'Continuar', 'nao-iniciada': 'Iniciar', concluida: 'Ver' };

export function useMinhasEmpresas() {
  const repo = useRepo();
  const navegar = useNavigate();
  const op = useOperador().operador as Operador;
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const competencias = t.competenciasRecentes(new Date(), 12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const rotina = op.departamento === 'contabil' ? t.ROTINA_CONTABIL : null;
  const { execucoes, carregada } = useExecucoes(competencia, op.departamento);
  const porNome = new Map(execucoes.map(e => [e.empresa, e]));

  const lista = busca.trim() ? empresas.buscarEmpresas(repo.listarEmpresas(), busca) : repo.listarEmpresas();
  const linhas = rotina ? lista.map(emp => {
    const ex = porNome.get(emp.nome) || null;
    const p = t.progresso(ex, rotina);
    const situacao = t.situacaoGeral(ex, rotina);
    const proxima = t.proximaEtapa(ex, rotina);
    return {
      chave: (emp.codigo ?? '') + emp.nome, codigo: emp.codigo, nome: emp.nome, rota: empresas.rotaDaEmpresa(emp),
      concluidas: p.concluidas, total: p.total, situacao, rotuloSituacao: t.ROTULO_SITUACAO_GERAL[situacao],
      proxima: proxima ? proxima.nome : '—', acao: ACAO[situacao],
    };
  }).sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao]) : [];

  const conta = (s: t.SituacaoGeral) => linhas.filter(l => l.situacao === s).length;

  return {
    temRotina: !!rotina,
    departamento: op.departamento,
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => setParams({ competencia: c }),
    busca, setBusca,
    carregando: !carregada,
    linhas: linhas.slice(0, LIMITE),
    total: linhas.length,
    numeros: { paradas: conta('parada'), andamento: conta('em-andamento'), naoIniciadas: conta('nao-iniciada'), concluidas: conta('concluida') },
    abrir: (rota: string) => navegar(caminhoDoExecutor(rota, competencia)),
  };
}
