// Aplicativo Concilia aí: liga o repositório da Conferência (banco ou exemplos) e mostra a rota aberta.
import { useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { avisarErrosDoBanco, repoDaConferencia } from './dados/fonte';
import { RepoProvider } from './dados/repo';

export function AppConciliaAi() {
  const repo = repoDaConferencia();
  const { aviso } = useRetorno();
  // os erros do banco ficam na tela (o toast sumia em 3,6 s e ninguém via que a gravação tinha sido recusada)
  useEffect(() => { avisarErrosDoBanco(repo, (texto, tom) => aviso({ tom: tom === 'ok' ? 'ok' : 'erro', titulo: tom === 'ok' ? 'Salvo na nuvem' : 'Banco da Conferência', texto })); }, [repo, aviso]);
  return (
    <RepoProvider repo={repo}>
      <Outlet />
    </RepoProvider>
  );
}
