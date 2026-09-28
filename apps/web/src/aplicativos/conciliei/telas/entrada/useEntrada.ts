// ViewModel da entrada do Conciliei: a escolha de empresa comum, com as empresas do escritório.
// Entrar abre a primeira ferramenta da caixa.
import { empresas } from '@nads/core';
import { useNavigate } from 'react-router';
import { useEscolherEmpresa } from '../../../../comum/useEscolherEmpresa';
import { caminhoDaFerramenta } from '../../casca/caminho';
import { FERRAMENTAS } from '../../casca/ferramentas';

export function useEntrada() {
  const navegar = useNavigate();
  const primeira = FERRAMENTAS[0];
  const busca = useEscolherEmpresa(empresas.EMPRESAS, x => navegar(caminhoDaFerramenta(empresas.rotaDaEmpresa(x), primeira.id, primeira.inicial)));
  return { ...busca, aplicativos: () => navegar('/') };
}
