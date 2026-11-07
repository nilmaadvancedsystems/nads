// Rotas da Central dos robôs: tudo em /robos/* (a tela inicial e, por cima dela, a janela aberta; ver casca/Central.tsx).
import type { RouteObject } from 'react-router';
import { AppRobos } from './AppRobos';
import { Central } from './casca/Central';

export const rotasRobos: RouteObject[] = [
  {
    path: '/robos',
    element: <AppRobos />,
    children: [
      { index: true, element: <Central /> },
      { path: '*', element: <Central /> },
    ],
  },
];
