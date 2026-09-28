// Rotas do Concilia aí: / (escolher a empresa) e /<código da empresa>/<seção>/<página>
// (ex.: /292/movimento/relatorio, /292/conciliadorzinho/bandeiras, /292/cheque-especial/saldo-negativo).
// Os links de antes da junção continuam funcionando:
//   /conferencia/292/movimento/relatorio            → /292/movimento/relatorio
//   /conciliei/292/conciliadorzinho/conciliacao/notas → /292/conciliadorzinho/notas
//   /conciliadorzinho/292/conciliacao/notas          → /292/conciliadorzinho/notas
//   /cheque-especial/292/ajuste/saldo-negativo       → /292/cheque-especial/saldo-negativo
import { Navigate, useLocation, useParams, type RouteObject } from 'react-router';
import { AppConciliaAi } from './AppConciliaAi';
import { caminho } from './casca/caminho';
import { EmpresaAberta } from './casca/EmpresaAberta';
import type { IdFerramenta } from './casca/navegacao';
import { Entrada } from './telas/entrada/Entrada';

/** /conferencia/… → o mesmo caminho sem o /conferencia. */
function LinkConferencia() {
  const { '*': resto = '' } = useParams();
  const { search } = useLocation();
  return <Navigate to={caminho(resto) + search} replace />;
}

/** /conciliadorzinho/292/…, /cheque-especial/292/… e /conciliei/292/<ferramenta>/… → /292/<ferramenta>/<última parte>. */
function LinkFerramenta({ ferramenta }: { ferramenta?: IdFerramenta }) {
  const { '*': resto = '' } = useParams();
  const partes = resto.split('/').filter(Boolean);
  const empresa = partes.shift();
  const f = ferramenta || partes.shift();
  if (!empresa) return <Navigate to={caminho()} replace />;
  // a página antiga era "<seção>/<página>" (conciliacao/notas, ajuste/saldo-negativo): fica a última parte
  const pagina = partes.length > 1 ? partes[partes.length - 1] : '';
  return <Navigate to={caminho(empresa + (f ? '/' + f + (pagina ? '/' + pagina : '') : ''))} replace />;
}

export const rotasConciliaAi: RouteObject[] = [
  {
    path: '/',
    element: <AppConciliaAi />,
    children: [
      { index: true, element: <Entrada /> },
      { path: ':empresa/:secao/:pagina', element: <EmpresaAberta /> },
      { path: ':empresa/:secao', element: <EmpresaAberta /> },
      { path: ':empresa', element: <EmpresaAberta /> },
    ],
  },
  { path: '/conferencia/*', element: <LinkConferencia /> },
  { path: '/conciliei/*', element: <LinkFerramenta /> },
  { path: '/conciliadorzinho/*', element: <LinkFerramenta ferramenta="conciliadorzinho" /> },
  { path: '/cheque-especial/*', element: <LinkFerramenta ferramenta="cheque-especial" /> },
];
