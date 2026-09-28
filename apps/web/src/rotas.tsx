// Todas as rotas do nads. Hash (#/…) para a cópia funcionar em qualquer endereço estático.
import { createHashRouter, Navigate } from 'react-router';
import { EmpresaAberta } from './modulos/conferencia/EmpresaAberta';
import { Entrada } from './modulos/conferencia/entrada/Entrada';

export const roteador = createHashRouter([
  { path: '/', element: <Entrada /> },
  { path: '/:empresa/:secao/:pagina', element: <EmpresaAberta /> },
  { path: '/:empresa', element: <EmpresaAberta /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
