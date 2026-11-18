// O Financeiro só abre em login liberado para quem tem o papel Financeiro sem ser Diretor (Vitor, 09/11/2026): sem isso, a
// senha dessa pessoa abria os dados de qualquer computador. Quem libera é um administrador; o próprio não aprova o seu pedido.
// O Diretor e o Dono entram direto, sem pedir liberação (Vitor, 17/11/2026: "quem é diretor/dono já deve ter acesso"); a
// regra do banco (podeNoFinanceiroNads, no Entregas) decide igual.
import type { ReactNode } from 'react';
import { temNivelDiretor } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { LiberarComputador } from './LiberarComputador';
import { useLiberacao } from './useLiberacao';

export function LoginLiberadoNoFinanceiro({ children }: { children: ReactNode }) {
  const { operador, escolher } = useOperador();
  const diretor = temNivelDiretor(operador);
  const vm = useLiberacao(!!operador?.admin, !diretor);
  if (diretor) return <>{children}</>;
  if (vm.carregando) return null;
  if (vm.precisa) return <LiberarComputador vm={vm} nome={operador?.nome || ''} sair={() => escolher(null)}
    explicacao="O Financeiro só abre em login liberado. Peça para um Diretor aprovar: ninguém aprova o próprio pedido." />;
  return <>{children}</>;
}
