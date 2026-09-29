// ViewModel da entrada do Conciliadorzinho: a escolha de empresa comum, com as empresas do escritório.
import { empresas } from '@nads/core';
import { useNavigate } from 'react-router';
import { useEscolherEmpresa } from '../../../../comum/useEscolherEmpresa';
import { caminho } from '../../casca/caminho';
import { idDaPagina } from '../../casca/navegacao';

export function useEntrada() {
  const navegar = useNavigate();
  const busca = useEscolherEmpresa(empresas.EMPRESAS, x => navegar(caminho(empresas.rotaDaEmpresa(x) + '/' + idDaPagina('bandeiras'))));
  return busca;
}
