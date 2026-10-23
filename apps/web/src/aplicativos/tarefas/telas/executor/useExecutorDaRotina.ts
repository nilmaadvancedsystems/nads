// Qual tela a rota do executor abre (23/10/2026): no Fiscal, a empresa do Simples, do Presumido ou do Real abre o fluxo
// operacional; o resto (o Contábil, o DP, o MEI e os outros regimes, e o período de vários meses) segue no executor de sempre.
import { empresas, tarefas as t } from '@nads/core';
import { useDepartamentoDaTela } from '../../casca/departamento';
import { useRegimesDoEntregas, useRepo } from '../../dados/repo';

export function useAbreOFluxo(rota: string, competencia: string): boolean {
  useRegimesDoEntregas();
  const { dep } = useDepartamentoDaTela();
  const repo = useRepo();
  const empresa = empresas.empresaPelaRota(repo.listarEmpresas(), rota);
  return dep === 'fiscal' && !!empresa && !competencia.includes('..') && !!t.fluxoDoRegime(t.regimeDaEmpresa(empresa.codigo));
}
