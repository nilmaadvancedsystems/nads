// Só as empresas da pessoa na Área do Cliente (26/11/2026: "a pessoa vai ver apenas as empresas dela"). A mesma regra do
// resto da Tarefas (telas/empresas/andamento.ts, useEmpresasPermitidas): no Fiscal e no Contábil, só as empresas de que a
// pessoa é a responsável no Cadastro (o diretor e o sênior também as dos plenos e júniores; o admin e o DP veem todas).
import { useMemo } from 'react';
import { useRepo } from '../../../dados/repo';
import { useEmpresasPermitidas } from '../../empresas/andamento';

export function useEmpresasDaPessoa() {
  const permitidas = useEmpresasPermitidas();
  const todas = useRepo().listarEmpresas();
  const empresas = useMemo(() => permitidas.filtrar(todas), [permitidas, todas]);
  const codigos = useMemo(() => new Set(empresas.map(e => e.codigo).filter((c): c is number => c != null)), [empresas]);
  /** a empresa (pelo código) é da pessoa; sem filtro, todas são */
  const pode = (codigo: number | null | undefined) => !permitidas.filtra || (codigo != null && codigos.has(codigo));
  return {
    /** a pessoa tem o filtro (Fiscal/Contábil sem ver todas) */
    filtra: permitidas.filtra,
    /** enquanto não chega quem é o responsável, a lista espera (não mostra empresa de outra pessoa) */
    carregada: permitidas.carregada,
    /** as empresas do cadastro que a pessoa vê */
    empresas,
    pode,
    /** a solicitação é de uma empresa da pessoa (alguma das empresas do link) */
    podeAlguma: (cs: readonly number[]) => !permitidas.filtra || cs.some(c => pode(c)),
  };
}
