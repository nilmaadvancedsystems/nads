// Entrada do nads: o visual, a barrinha de carregamento do topo, o aviso de versão nova, o retorno (toast/modal) e as rotas.
// O Concilia aí liga os próprios dados em aplicativos/concilia-ai/ (AppConciliaAi).
import '@nads/ui/estilo.css';
import { AvisoDeVersaoNova, BarraDeCarregamento, DefsMarca, RetornoProvider } from '@nads/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { roteador } from './rotas';
import { VERSAO_SISTEMA } from './versao';

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <DefsMarca />
    <BarraDeCarregamento />
    <AvisoDeVersaoNova atual={VERSAO_SISTEMA} />
    <RetornoProvider>
      <RouterProvider router={roteador} />
    </RetornoProvider>
  </StrictMode>,
);
