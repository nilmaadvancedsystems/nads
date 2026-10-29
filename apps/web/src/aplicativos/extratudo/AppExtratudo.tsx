// Aplicativo Extratudo: liga o repositório (a lista de empresas e os lançamentos do Extrator; no site
// ligado ao banco, o Firestore da Conferência) e o leitor de PDF, e mostra a rota aberta. As três ferramentas ficam debaixo dele.
// No banco, a trava vem antes (29/10/2026): só quem entrou com a conta do Entregas e pode usar alguma das ferramentas.
import { extrator } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Trava } from '../../comum/trava/Trava';
import { sessaoDoExtratudo } from './dados/trava';
import { avisarErrosDoBanco, repoDoExtrator } from './ferramentas/extrator/dados/fonte';
import { RepoProvider } from './ferramentas/extrator/dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);

export function AppExtratudo() {
  return (
    <Trava porta={sessaoDoExtratudo()} recursos={['extrator', 'cheque-especial', 'creditor']} nome="Extratudo">
      <ExtratudoLiberado />
    </Trava>
  );
}

/** Depois da trava: só aqui o repositório abre (no banco, a conexão com a Conferência). */
function ExtratudoLiberado() {
  const repo = repoDoExtrator();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  return (
    <RepoProvider repo={repo}>
      <Outlet />
    </RepoProvider>
  );
}
