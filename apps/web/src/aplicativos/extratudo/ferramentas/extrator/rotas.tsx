// Rotas do Extrator dentro do Extratudo: /extratudo/<empresa>/extrator/<seção>/<página>
// (ex.: /extratudo/292/extrator/conferencia/resultado).
import type { RouteObject } from 'react-router';
import { EmpresaAberta } from './casca/EmpresaAberta';

export const rotasDoExtrator: RouteObject[] = [
  { path: ':empresa/extrator/:secao/:pagina', element: <EmpresaAberta /> },
  { path: ':empresa/extrator', element: <EmpresaAberta /> },
];
