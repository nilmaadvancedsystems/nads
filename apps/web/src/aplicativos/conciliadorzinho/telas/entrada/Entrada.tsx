// Entrada do Conciliadorzinho: escolher a empresa.
import { EscolherEmpresa } from '@nads/ui';
import { VERSAO_SISTEMA } from '../../../../versao';
import { useEntrada } from './useEntrada';

export function Entrada() {
  const vm = useEntrada();
  return <EscolherEmpresa {...vm} titulo="Entrar no Conciliadorzinho" versao={VERSAO_SISTEMA} onAplicativos={vm.aplicativos} />;
}
