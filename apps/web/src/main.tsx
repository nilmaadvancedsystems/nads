// Entrada do nads: o visual, a barrinha de carregamento do topo, o aviso de versão nova, o retorno (toast/modal) e as rotas.
// O Concilia aí liga os próprios dados em aplicativos/concilia-ai/ (AppConciliaAi).
import '@nads/ui/estilo.css';
import { BarraDeCarregamento, DefsMarca, iniciarAnimador, RetornoProvider } from '@nads/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { roteador } from './rotas';

// as entradas animadas (janelas, menus, avisos, gaveta) e o toque nos botões: o animador do @nads/ui (animejs)
iniciarAnimador();

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <DefsMarca />
    <BarraDeCarregamento />
    <RetornoProvider>
      <RouterProvider router={roteador} />
    </RetornoProvider>
  </StrictMode>,
);
