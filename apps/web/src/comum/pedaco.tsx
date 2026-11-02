// Os pedaços do site (revisão da UI, 18/10/2026: "o pacote inicial tinha 4 MB"): cada tela grande vem num arquivo à
// parte, baixado só quando a pessoa abre a tela. Enquanto o pedaço chega, a barra do topo anda e, no primeiro
// carregamento da página, o Esqueleto do catálogo fica no lugar da tela. Se o pedaço não vem (a aba é de antes de uma
// publicação), o erro vai para o ErroDaTela da rota, que recarrega uma vez sozinho (pedacoQueSumiu.ts).
//
// O pedaço que chega vazio (Vitor, 28/10/2026: "Cannot read properties of undefined (reading 'ConfiguracoesDoDp')… logo a tela
// carrega"): um arquivo que a tela precisa não veio, o main.tsx já mandou recarregar a página e cancelou o erro do Vite
// (vite:preloadError com preventDefault), e aí o import() do Vite devolve undefined em vez de falhar. Não é erro: a página
// está recarregando. No lugar da tela, a bolinha, até a página nova chegar.
import { carregandoAte, Esqueleto, useCarregando } from '@nads/ui';
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';

/**
 * A tela `nome` do módulo, carregada só quando aparece pela 1ª vez (React.lazy com o export nomeado).
 * Ex.: const Executor = pedaco(() => import('./telas/executor/Executor'), 'Executor');
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- o mesmo tipo do React.lazy
export function pedaco<M extends Record<K, ComponentType<any>>, K extends keyof M>(carregar: () => Promise<M>, nome: K): LazyExoticComponent<M[K]> {
  // a barra do topo anda enquanto o pedaço chega: indo de uma tela para outra, o React Router segura a tela de antes
  // (transição) e o Esqueleto não aparece; sem a barra, o clique parecia não ter feito nada
  return lazy(() => carregandoAte(carregar()).then(m => ({ default: m ? m[nome] : (Recarregando as unknown as M[K]) })));
}

/** A página está recarregando (o pedaço que chegou vazio; o ErroDaTela que recarrega sozinho): só a bolinha, no meio. */
export function Recarregando() {
  return (
    <main className="main" style={{ display: 'flex', justifyContent: 'center', paddingTop: 96 }} aria-busy="true" aria-label="Carregando">
      <span className="btn-spinner" style={{ width: 28, height: 28 }} />
    </main>
  );
}

/** O que aparece enquanto o pedaço chega: o Esqueleto (na página inteira, dentro de um main) e a barra do topo. */
export function EsperaDoPedaco({ inteira }: { inteira?: boolean }) {
  useCarregando(true);
  const esqueleto = <Esqueleto linhas={6} numeros={3} />;
  return inteira ? <main className="main">{esqueleto}</main> : esqueleto;
}

/** Em volta das telas que são pedaços: o Suspense com a espera. */
export function NaEspera({ children, inteira }: { children: ReactNode; inteira?: boolean }) {
  return <Suspense fallback={<EsperaDoPedaco inteira={inteira} />}>{children}</Suspense>;
}
