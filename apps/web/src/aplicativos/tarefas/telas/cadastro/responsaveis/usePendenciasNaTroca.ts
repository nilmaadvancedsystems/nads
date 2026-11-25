// As pendências de cada empresa na troca de responsável (plano do Acessórias, ficha M02): na competência de trabalho (o
// mês passado, cujos prazos vencem neste mês), as etapas atrasadas, no prazo interno ou paradas. Lê as execuções do
// Fiscal e do Contábil daquele mês só onde é usado (a janela de troca aberta e o cartão de aceite com pedidos).
import { tarefas } from '@nads/core';
import { useRepo, useVersaoDoRepo } from '../../../dados/repo';
import type { Dep } from './useEmpresasPorResponsavel';

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** ligado: false = não lê nada (o cartão de aceite sem pedidos não gasta leitura do banco) */
export function usePendenciasNaTroca(ligado = true, agora = new Date()) {
  const repo = useRepo();
  useVersaoDoRepo();
  const passado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const competencia = passado.getFullYear() + '-' + doisDigitos(passado.getMonth() + 1);
  const hoje = agora.getFullYear() + '-' + doisDigitos(agora.getMonth() + 1) + '-' + doisDigitos(agora.getDate());
  const ler = (dep: Dep) => (ligado ? { execucoes: repo.execucoes(competencia, dep), carregada: repo.carregada(competencia, dep) } : { execucoes: [], carregada: false });
  const porDep = { fiscal: ler('fiscal'), contabil: ler('contabil') };
  return {
    competencia,
    /** as pendências da empresa no departamento ([] enquanto as execuções não chegam) */
    de(nome: string, codigo: number | null, dep: Dep): tarefas.PendenciaDaEmpresa[] {
      const d = porDep[dep];
      const rotina = tarefas.rotinaDaEmpresa(dep, codigo);
      if (!d.carregada || !rotina) return [];
      const ex = d.execucoes.find(e => (codigo != null && e.codigo === codigo) || e.empresa === nome) || null;
      return tarefas.pendenciasDaEmpresa(ex, { nome, codigo }, rotina, competencia, hoje);
    },
    resumo: tarefas.resumoDasPendencias,
  };
}
