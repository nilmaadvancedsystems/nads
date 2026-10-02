// Rotas do catálogo de componentes: /componentes/<tipo>?tela=<tela>.
// O catálogo é exclusivo do site de Componentes (Vitor, 02/10/2026: "não é para colocar na aplicação oficial"): ele
// carrega à parte (lazy) e só entra no build do site componentes (ou no local, sem VITE_APLICATIVO). Nos outros sites
// a condição vira falso na compilação e o código do catálogo, com as peças que saíram, nem é gerado.
import { Navigate, type RouteObject } from 'react-router';

const COM_CATALOGO = !import.meta.env.VITE_APLICATIVO || import.meta.env.VITE_APLICATIVO === 'componentes';

export const rotasComponentes: RouteObject[] = COM_CATALOGO ? [
  { path: '/componentes', element: <Navigate to="/componentes/botoes" replace /> },
  { path: '/componentes/:tipo', lazy: () => import('./telas/Catalogo').then(m => ({ Component: m.Catalogo })) },
] : [];
