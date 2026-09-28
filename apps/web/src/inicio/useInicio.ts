// ViewModel do início do nads: a lista de aplicativos e abrir um deles (vai para a escolha de empresa).
import { useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../versao';
import { APLICATIVOS, type Aplicativo } from './aplicativos';


export function useInicio() {
  const navegar = useNavigate();
  return {
    aplicativos: APLICATIVOS,
    abrir: (a: Aplicativo) => navegar(a.rota),
    versao: VERSAO_SISTEMA,
  };
}
