// Aplicativo Concilia aí: liga o repositório da Conferência (banco ou exemplos) e mostra a rota aberta.
// No banco, a trava vem antes (29/10/2026): só quem entrou com a conta do Entregas e pode usar a Conferência.
import { useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { TravaDeAcesso } from '../tarefas/casca/TravaDeAcesso';
import { avisarErrosDoBanco, repoDaConferencia } from './dados/fonte';
import { RepoProvider } from './dados/repo';
import { GravacaoNaNuvem } from './casca/GravacaoNaNuvem';

export function AppConciliaAi() {
  return (
    <TravaDeAcesso recursos={['conferencia']} nome="Concilia aí">
      <ConferenciaLiberada />
    </TravaDeAcesso>
  );
}

/** Depois da trava: só aqui o repositório abre (no banco, a conexão com a Conferência). */
function ConferenciaLiberada() {
  const repo = repoDaConferencia();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  return (
    <RepoProvider repo={repo}>
      <Outlet />
      <GravacaoNaNuvem />
    </RepoProvider>
  );
}
