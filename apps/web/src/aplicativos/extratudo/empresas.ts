// A empresa da URL, igual nas três ferramentas: a lista do Extratudo (empresas do escritório + as de
// exemplo, quando é o caso), a mesma da escolha de empresa.
import { empresas } from '@nads/core';
import { useRepo, useVersaoDoRepo } from './ferramentas/extrator/dados/repo';

export function useEmpresaDoExtratudo(param: string): empresas.EmpresaDoEscritorio | null {
  const repo = useRepo();
  useVersaoDoRepo();
  return empresas.empresaPelaRota(repo.listarEmpresas(), param);
}
