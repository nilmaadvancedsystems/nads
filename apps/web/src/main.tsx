// Entrada do nads: o visual, a barrinha de carregamento do topo, o aviso de versão nova, o retorno (toast/modal) e as rotas.
// O Concilia aí liga os próprios dados em aplicativos/concilia-ai/ (AppConciliaAi).
import '@nads/ui/estilo.css';
import { BarraDeCarregamento, DefsMarca, iniciarAnimador, iniciarContinuidade, RetornoProvider } from '@nads/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { recarregarUmaVez } from './comum/pedacoQueSumiu';
import { roteador } from './rotas';

// as entradas animadas (janelas, menus, avisos, gaveta) e o toque nos botões: o animador do @nads/ui (animejs)
iniciarAnimador();
// depois de "Atualizar" (versão nova), o que estava digitado e marcado na tela volta (continuidade.ts)
iniciarContinuidade();

// uma aba aberta antes de uma publicação pede um pedaço do app que o site já não tem ("Failed to fetch dynamically
// imported module", ao ler um PDF): recarrega uma vez, pegando a versão nova, em vez de mostrar o erro. Só uma vez a
// cada 30 s (se o pedaço faltar de verdade, o erro aparece, sem ficar recarregando sem parar). A regra fica em
// comum/pedacoQueSumiu.ts, a mesma do ErroDaTela.
window.addEventListener('vite:preloadError', ev => {
  if (recarregarUmaVez()) ev.preventDefault();
});

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <DefsMarca />
    <BarraDeCarregamento />
    <RetornoProvider>
      <RouterProvider router={roteador} />
    </RetornoProvider>
  </StrictMode>,
);
