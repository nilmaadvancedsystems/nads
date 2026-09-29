// Aplicativo Extrator: liga o repositório e o leitor de PDF e mostra a rota aberta.
import { extrator } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Outlet } from 'react-router';
import { repoDoExtrator } from './dados/fonte';
import { RepoProvider } from './dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);

export function AppExtrator() {
  return (
    <RepoProvider repo={repoDoExtrator()}>
      <Outlet />
    </RepoProvider>
  );
}
