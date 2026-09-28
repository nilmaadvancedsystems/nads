// Rotas do Conciliei: /conciliei (escolher a empresa) e
// /conciliei/<código da empresa>/<ferramenta>/<seção>/<página>.
// Os links de quando o Cheque especial e o Conciliadorzinho eram aplicativos separados
// (/cheque-especial/292/…, /conciliadorzinho/292/…) vão para a mesma página dentro do Conciliei.
import { Navigate, useParams, type RouteObject } from 'react-router';
import { BASE, caminho, caminhoDaFerramenta } from './casca/caminho';
import { EmpresaAberta } from './casca/EmpresaAberta';
import type { IdFerramenta } from './casca/ferramentas';
import { Entrada } from './telas/entrada/Entrada';

function LinkAntigo({ ferramenta }: { ferramenta: IdFerramenta }) {
  const { '*': resto = '' } = useParams();
  const [empresa, ...pagina] = resto.split('/').filter(Boolean);
  return <Navigate to={empresa ? caminhoDaFerramenta(empresa, ferramenta, pagina.join('/')) : caminho()} replace />;
}

export const rotasConciliei: RouteObject[] = [
  {
    path: BASE,
    children: [
      { index: true, element: <Entrada /> },
      { path: ':empresa/:ferramenta/:secao/:pagina', element: <EmpresaAberta /> },
      { path: ':empresa/:ferramenta', element: <EmpresaAberta /> },
      { path: ':empresa', element: <EmpresaAberta /> },
    ],
  },
  { path: '/cheque-especial/*', element: <LinkAntigo ferramenta="cheque-especial" /> },
  { path: '/conciliadorzinho/*', element: <LinkAntigo ferramenta="conciliadorzinho" /> },
];
