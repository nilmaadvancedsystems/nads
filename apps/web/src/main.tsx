// Entrada do nads: o visual, a barrinha de carregamento do topo, o aviso de versão nova, o retorno (toast/modal) e as rotas.
import '@nads/ui/estilo.css';
import { BarraDeCarregamento, DefsMarca, iniciarAnimador, iniciarAtualizacaoPorInatividade, iniciarContinuidade, RetornoProvider, trocarDeTelaComBarra } from '@nads/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { recarregarUmaVez } from './comum/pedacoQueSumiu';
import { roteador } from './rotas';
import { VERSAO_SISTEMA } from './versao';

// as entradas animadas (janelas, menus, avisos, gaveta) e o toque nos botões: o animador do @nads/ui (animejs)
iniciarAnimador();
// depois de "Atualizar" (versão nova), o que estava digitado e marcado na tela volta (continuidade.ts)
iniciarContinuidade();
// saiu versão nova e a tela ficou 10 min sem uso: atualiza sozinha (versaoNova.tsx)
iniciarAtualizacaoPorInatividade(VERSAO_SISTEMA);

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
// a Área do Cliente troca de aba na hora, com tudo já carregado (13/11/2026: "ao trocar de tela roda a animação de
// carregamento"): entre as abas da mesma empresa (/cliente/<token>/…) não mostra o N de vidro nem a barra
const tokenDaArea = (caminho: string) => /^\/cliente\/([^/]+)/.exec(caminho)?.[1] ?? '';
const eOutraTela = (para: unknown) => {
  if (typeof para === 'number') return true;
  const caminho = typeof para === 'string' ? para : (para as { pathname?: string } | null)?.pathname;
  if (!caminho) return false;
  const destino = new URL(caminho, location.href).pathname;
  const token = tokenDaArea(location.pathname);
  if (token && token === tokenDaArea(destino)) return false;
  return destino !== location.pathname;
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
