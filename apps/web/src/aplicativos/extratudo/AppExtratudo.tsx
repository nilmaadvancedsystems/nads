// Aplicativo Extratudo: liga o repositório (a lista de empresas e os lançamentos do Extrator; no site
// ligado ao banco, o Firestore da Conferência) e o leitor de PDF, e mostra a rota aberta. As três ferramentas ficam debaixo dele.
import { extrator } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { avisarErrosDoBanco, repoDoExtrator } from './ferramentas/extrator/dados/fonte';
import { RepoProvider } from './ferramentas/extrator/dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);

export function AppExtratudo() {
  const repo = repoDoExtrator();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  return (
    <RepoProvider repo={repo}>
      <Outlet />
    </RepoProvider>
  );
}
