// Rotas do Creditor dentro do Extratudo: /extratudo/<empresa>/creditor/<etapa>.
import type { RouteObject } from 'react-router';
import { EmpresaAberta } from './casca/EmpresaAberta';

export const rotasDoCreditor: RouteObject[] = [
  { path: ':empresa/creditor/:etapa', element: <EmpresaAberta /> },
  { path: ':empresa/creditor', element: <EmpresaAberta /> },
];
