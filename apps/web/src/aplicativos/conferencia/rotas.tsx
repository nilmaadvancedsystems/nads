// Rotas da Conferência: /conferencia/<código da empresa>/<seção>/<página>
// (ex.: /conferencia/292/movimento/relatorio). Os links antigos sem o /conferencia
// (/292/movimento/relatorio) são redirecionados em apps/web/src/rotas.tsx.
import type { RouteObject } from 'react-router';
import { AppConferencia } from './AppConferencia';
import { BASE } from './casca/caminho';
import { EmpresaAberta } from './casca/EmpresaAberta';
import { Entrada } from './telas/entrada/Entrada';

export const rotasConferencia: RouteObject[] = [
  {
    path: BASE,
    element: <AppConferencia />,
    children: [
      { index: true, element: <Entrada /> },
      { path: ':empresa/:secao/:pagina', element: <EmpresaAberta /> },
      { path: ':empresa', element: <EmpresaAberta /> },
    ],
  },
];
