// Todas as rotas do nads: caminhos de verdade na URL (ex.: /901/movimento/relatorio).
// A hospedagem (firebase.json) reescreve qualquer caminho para index.html, então acessar
// ou recarregar um link direto continua funcionando.
import { createBrowserRouter, Navigate } from 'react-router';
import { EmpresaAberta } from './modulos/conferencia/EmpresaAberta';
import { Entrada } from './modulos/conferencia/entrada/Entrada';

export const roteador = createBrowserRouter([
  { path: '/', element: <Entrada /> },
  { path: '/:empresa/:secao/:pagina', element: <EmpresaAberta /> },
  { path: '/:empresa', element: <EmpresaAberta /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
