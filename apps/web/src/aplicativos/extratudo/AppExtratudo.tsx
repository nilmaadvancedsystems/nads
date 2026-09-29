// Aplicativo Extratudo: liga o repositório (a lista de empresas e os lançamentos do Extrator) e o
// leitor de PDF, e mostra a rota aberta. As três ferramentas ficam debaixo dele.
import { extrator } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Outlet } from 'react-router';
import { repoDoExtrator } from './ferramentas/extrator/dados/fonte';
import { RepoProvider } from './ferramentas/extrator/dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);

export function AppExtratudo() {
  return (
    <RepoProvider repo={repoDoExtrator()}>
      <Outlet />
    </RepoProvider>
  );
}
