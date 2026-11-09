// Entrada do nads: o visual, a barrinha de carregamento do topo, o aviso de versão nova, o retorno (toast/modal) e as rotas.
import '@nads/ui/estilo.css';
import { BarraDeCarregamento, DefsMarca, iniciarAnimador, iniciarContinuidade, RetornoProvider, trocarDeTelaComBarra } from '@nads/ui';
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

// trocar de tela: a barrinha do topo aparece já no clique, antes de a tela nova ocupar o navegador (todo navigate do app
// passa por aqui; mudar só a busca da URL, como um filtro, não é trocar de tela)
const navegarNoRoteador = roteador.navigate.bind(roteador);
const eOutraTela = (para: unknown) => {
  if (typeof para === 'number') return true;
  const caminho = typeof para === 'string' ? para : (para as { pathname?: string } | null)?.pathname;
  return !!caminho && new URL(caminho, location.href).pathname !== location.pathname;
};
roteador.navigate = ((para: unknown, opcoes?: unknown) => {
  const seguir = () => (navegarNoRoteador as (a: unknown, b?: unknown) => Promise<void>)(para, opcoes);
  return eOutraTela(para) ? trocarDeTelaComBarra(seguir) : seguir();
}) as typeof roteador.navigate;

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <DefsMarca />
    <BarraDeCarregamento />
    <RetornoProvider>
      <RouterProvider router={roteador} />
    </RetornoProvider>
  </StrictMode>,
);
