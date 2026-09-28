// Entrada do Conciliadorzinho: escolher a empresa.
import { EscolherEmpresa } from '@nads/ui';
import { VERSAO } from '../../casca/useCascaConciliador';
import { useEntrada } from './useEntrada';

export function Entrada() {
  const vm = useEntrada();
  return <EscolherEmpresa {...vm} titulo="Entrar no Conciliadorzinho" versao={VERSAO} onAplicativos={vm.aplicativos} />;
}
