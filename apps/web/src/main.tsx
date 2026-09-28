// Entrada do nads (cópia sem banco): design da Conferência, repositório em memória e rotas.
import '@nads/ui/estilo.css';
import { conferencia } from '@nads/core';
import { DefsMarca, RetornoProvider } from '@nads/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { RepoProvider } from './dados/repo';
import { roteador } from './rotas';

const repo = conferencia.criarRepoConferenciaMemoria();

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <DefsMarca />
    <RepoProvider repo={repo}>
      <RetornoProvider>
        <RouterProvider router={roteador} />
      </RetornoProvider>
    </RepoProvider>
  </StrictMode>,
);
