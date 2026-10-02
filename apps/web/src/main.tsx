// Entrada do nads: o visual, a barrinha de carregamento do topo, o aviso de versão nova, o retorno (toast/modal) e as rotas.
// O Concilia aí liga os próprios dados em aplicativos/concilia-ai/ (AppConciliaAi).
import '@nads/ui/estilo.css';
import { BarraDeCarregamento, DefsMarca, iniciarAnimador, iniciarContinuidade, RetornoProvider, TravaDeVersaoNova } from '@nads/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { roteador } from './rotas';
import { VERSAO_SISTEMA } from './versao';

// as entradas animadas (janelas, menus, avisos, gaveta) e o toque nos botões: o animador do @nads/ui (animejs)
iniciarAnimador();
// depois de "Atualizar" (versão nova), o que estava digitado e marcado na tela volta (continuidade.ts)
iniciarContinuidade();

// uma aba aberta antes de uma publicação pede um pedaço do app que o site já não tem ("Failed to fetch dynamically
// imported module", ao ler um PDF): recarrega uma vez, pegando a versão nova, em vez de mostrar o erro. Só uma vez a
// cada 30 s (se o pedaço faltar de verdade, o erro aparece, sem ficar recarregando sem parar).
window.addEventListener('vite:preloadError', ev => {
  try {
    const ultima = Number(sessionStorage.getItem('nads-recarregou') || 0);
    if (Date.now() - ultima < 30000) return;
    sessionStorage.setItem('nads-recarregou', String(Date.now()));
  } catch { return; }
  ev.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <DefsMarca />
    <BarraDeCarregamento />
    <TravaDeVersaoNova atual={VERSAO_SISTEMA} />
    <RetornoProvider>
      <RouterProvider router={roteador} />
    </RetornoProvider>
  </StrictMode>,
);
