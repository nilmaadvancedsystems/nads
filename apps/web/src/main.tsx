// Entrada do nads: o visual, o retorno (toast/modal) e as rotas, comuns a todos os aplicativos.
// Cada aplicativo liga os próprios dados em aplicativos/<app>/ (ex.: AppConferencia).
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
