// ViewModel da entrada do Conciliadorzinho: a escolha de empresa comum, com as empresas do escritório.
import { empresas } from '@nads/core';
import { useNavigate } from 'react-router';
import { useEscolherEmpresa } from '../../../../comum/useEscolherEmpresa';
import { useEmpresasDaConta } from '../../../tarefas/casca/useEmpresasDaConta';
import { caminho } from '../../casca/caminho';
import { idDaPagina } from '../../casca/navegacao';

export function useEntrada() {
  const navegar = useNavigate();
  // só as empresas de quem é o responsável (o admin e o diretor, todas; 29/10/2026)
  const permitidas = useEmpresasDaConta();
  const busca = useEscolherEmpresa(permitidas.filtrar(empresas.EMPRESAS), x => navegar(caminho(empresas.rotaDaEmpresa(x) + '/' + idDaPagina('bandeiras'))));
  return busca;
}
