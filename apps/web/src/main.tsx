// Entrada do nads: o visual, o retorno (toast/modal) e as rotas.
// O Concilia aí liga os próprios dados em aplicativos/concilia-ai/ (AppConciliaAi).
import '@nads/ui/estilo.css';
import { DefsMarca, RetornoProvider } from '@nads/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { roteador } from './rotas';

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <DefsMarca />
    <RetornoProvider>
      <RouterProvider router={roteador} />
    </RetornoProvider>
  </StrictMode>,
);
