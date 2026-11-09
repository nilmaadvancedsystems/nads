// O Financeiro só abre em login liberado, para todos, Diretor inclusive (Vitor, 09/11/2026): sem isso, a senha de um admin
// abria os dados de qualquer computador. Quem libera é outro administrador; o próprio não aprova o seu pedido.
import type { ReactNode } from 'react';
import { useOperador } from '../../casca/operador';
import { LiberarComputador } from './LiberarComputador';
import { useLiberacao } from './useLiberacao';

export function LoginLiberadoNoFinanceiro({ children }: { children: ReactNode }) {
  const { operador, escolher } = useOperador();
  const vm = useLiberacao(!!operador?.admin, true);
  if (vm.carregando) return null;
  if (vm.precisa) return <LiberarComputador vm={vm} nome={operador?.nome || ''} sair={() => escolher(null)}
    explicacao="O Financeiro só abre em login liberado. Peça para outro Diretor aprovar: ninguém aprova o próprio pedido." />;
  return <>{children}</>;
}
