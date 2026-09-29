// ViewModel dos Insights de "Minhas empresas": quantas empresas estão paradas, em andamento, não
// iniciadas e concluídas na competência. Clicar num número abre a lista já filtrada.
import { useNavigate } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { SITUACOES, useAndamento } from '../empresas/andamento';

export function useInsights() {
  const a = useAndamento();
  const navegar = useNavigate();
  return {
    temRotina: a.temRotina,
    departamento: a.departamento,
    competencia: a.competencia,
    competencias: a.competencias,
    setCompetencia: a.setCompetencia,
    carregando: a.carregando,
    total: a.linhas.length,
    numeros: SITUACOES.map(s => ({ ...s, qtd: a.contar(s.valor) })),
    abrirLista: (situacao: string) => navegar(caminhoDaPagina('minhas-empresas', 'empresas') + '?competencia=' + a.competencia + '&situacao=' + situacao),
  };
}
