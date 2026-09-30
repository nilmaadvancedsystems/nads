// Aplicativo Tarefas: liga o repositório (no site, o Firestore da Conferência, coleção `tarefas`) e
// pede quem está trabalhando antes de mostrar qualquer tela: no banco, o login com a conta do Entregas
// (30/09/2026); nos exemplos, a escolha do nome na lista da equipe.
import { useRetorno } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { OperadorProvider, operadorDaConta, useOperador } from './casca/operador';
import { avisarErrosDoBanco, repoDaTarefas } from './dados/fonte';
import { RepoProvider } from './dados/repo';
import { useSessao } from './dados/sessao';
import { Entrar } from './telas/entrar/Entrar';
import { QuemSouEu } from './telas/quem/QuemSouEu';

function PrecisaDeOperador({ children }: { children: ReactNode }) {
  const { operador } = useOperador();
  return operador ? <>{children}</> : <QuemSouEu />;
}

export function AppTarefas() {
  const repo = repoDaTarefas();
  const sessao = useSessao();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);

  // no banco: sem conta (ou conta sem departamento), só a entrada
  const operador = sessao?.usuario ? operadorDaConta(sessao.usuario) : null;
  if (sessao && !operador) return <Entrar sessao={sessao} />;

  return (
    <RepoProvider repo={repo}>
      <OperadorProvider daConta={sessao && operador ? { operador, sair: sessao.sair } : undefined}>
        <PrecisaDeOperador>
          <Outlet />
        </PrecisaDeOperador>
      </OperadorProvider>
    </RepoProvider>
  );
}
