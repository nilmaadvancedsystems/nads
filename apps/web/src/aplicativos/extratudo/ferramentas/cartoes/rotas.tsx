// Rotas do Cartões dentro do Extratudo: /extratudo/<empresa>/cartoes/<seção>/<página>.
import type { RouteObject } from 'react-router';
import { EmpresaAberta } from './casca/EmpresaAberta';

export const rotasDosCartoes: RouteObject[] = [
  { path: ':empresa/cartoes/:secao/:pagina', element: <EmpresaAberta /> },
  { path: ':empresa/cartoes', element: <EmpresaAberta /> },
];
