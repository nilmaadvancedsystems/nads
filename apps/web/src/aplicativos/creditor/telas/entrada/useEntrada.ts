// ViewModel da entrada do Creditor: a escolha de empresa comum, com as empresas do escritório
// (sem banco: o Creditor não guarda nada).
import { empresas } from '@nads/core';
import { useNavigate } from 'react-router';
import { useEscolherEmpresa } from '../../../../comum/useEscolherEmpresa';
import { caminhoDaEtapa } from '../../casca/navegacao';

export function useEntrada() {
  const navegar = useNavigate();
  return useEscolherEmpresa(empresas.EMPRESAS, x => navegar(caminhoDaEtapa(empresas.rotaDaEmpresa(x), 'banco')));
}
