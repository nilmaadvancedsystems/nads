// Rotas do Cheque especial dentro do Extratudo: /extratudo/<empresa>/cheque-especial/<seção>/<página>.
import type { RouteObject } from 'react-router';
import { EmpresaAberta } from './casca/EmpresaAberta';

export const rotasDoChequeEspecial: RouteObject[] = [
  { path: ':empresa/cheque-especial/:secao/:pagina', element: <EmpresaAberta /> },
  { path: ':empresa/cheque-especial', element: <EmpresaAberta /> },
];
