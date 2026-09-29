// Aplicativo Tarefas: liga o repositório (no site, o Firestore da Conferência, coleção `tarefas`) e
// pede quem está trabalhando antes de mostrar qualquer tela (ainda sem login).
import { useRetorno } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { OperadorProvider, useOperador } from './casca/operador';
import { avisarErrosDoBanco, repoDaTarefas } from './dados/fonte';
import { RepoProvider } from './dados/repo';
import { QuemSouEu } from './telas/quem/QuemSouEu';

function PrecisaDeOperador({ children }: { children: ReactNode }) {
  const { operador } = useOperador();
  return operador ? <>{children}</> : <QuemSouEu />;
}

export function AppTarefas() {
  const repo = repoDaTarefas();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  return (
    <RepoProvider repo={repo}>
      <OperadorProvider>
        <PrecisaDeOperador>
          <Outlet />
        </PrecisaDeOperador>
      </OperadorProvider>
    </RepoProvider>
  );
}
