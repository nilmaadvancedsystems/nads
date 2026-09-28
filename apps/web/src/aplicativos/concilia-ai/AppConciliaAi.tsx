// Aplicativo Concilia aí: liga o repositório da Conferência (banco ou exemplos) e mostra a rota aberta.
import { useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { avisarErrosDoBanco, repoDaConferencia } from './dados/fonte';
import { RepoProvider } from './dados/repo';

export function AppConciliaAi() {
  const repo = repoDaConferencia();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  return (
    <RepoProvider repo={repo}>
      <Outlet />
    </RepoProvider>
  );
}
