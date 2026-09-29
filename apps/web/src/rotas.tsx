// Rotas do nads: o início (escolher o aplicativo) e a soma das rotas de cada aplicativo
// (aplicativos/<app>/rotas.tsx). São caminhos de verdade na URL; a hospedagem (firebase.json)
// reescreve qualquer caminho para index.html, então acessar ou recarregar um link direto funciona.
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { rotasChequeEspecial } from './aplicativos/cheque-especial/rotas';
import { rotasConciliadorzinho } from './aplicativos/conciliadorzinho/rotas';
import { rotasConferencia } from './aplicativos/conferencia/rotas';
import { rotasExtrator } from './aplicativos/extrator/rotas';
import { ehRotaDeAplicativo } from './inicio/aplicativos';
import { Inicio } from './inicio/Inicio';

/**
 * Caminho que não é de nenhum aplicativo: é link antigo da Conferência, de quando ela era a raiz
 * (/292/movimento/relatorio → /conferencia/292/movimento/relatorio). O resto vai para o início.
 */
function LinkAntigo() {
  const { pathname, search } = useLocation();
  const primeiro = pathname.split('/').filter(Boolean)[0] || '';
  if (!primeiro || ehRotaDeAplicativo(primeiro)) return <Navigate to="/" replace />;
  return <Navigate to={'/conferencia' + pathname + search} replace />;
}

export const roteador = createBrowserRouter([
  { path: '/', element: <Inicio /> },
  ...rotasConferencia,
  ...rotasChequeEspecial,
  ...rotasConciliadorzinho,
  ...rotasExtrator,
  { path: '*', element: <LinkAntigo /> },
]);
