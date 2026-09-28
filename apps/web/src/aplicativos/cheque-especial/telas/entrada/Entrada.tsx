// Entrada do Cheque especial: escolher a empresa.
import { EscolherEmpresa } from '@nads/ui';
import { VERSAO } from '../../casca/useCascaCheque';
import { useEntrada } from './useEntrada';

export function Entrada() {
  const vm = useEntrada();
  return <EscolherEmpresa {...vm} titulo="Entrar no Cheque especial" versao={VERSAO} onAplicativos={vm.aplicativos} />;
}
