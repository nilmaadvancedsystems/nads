// Rotas do Conversor: /conversor/<etapa> (Arquivo → Conferência → Baixar). Sem empresa e sem banco de dados: o
// extrato é lido no navegador e o .xls é gerado na hora. Etapa ainda travada volta para a última liberada.
import { extrator } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Navigate, Outlet, useParams, type RouteObject } from 'react-router';
import { BASE } from './casca/caminho';
import { CascaConversor } from './casca/Casca';
import { caminhoDaEtapa, ETAPAS, indiceDaEtapa, type IdEtapa } from './casca/navegacao';
import { SessaoProvider, useSessao } from './casca/sessao';
import { Arquivo } from './telas/arquivo/Arquivo';
import { Baixar } from './telas/baixar/Baixar';
import { Conferencia } from './telas/conferencia/Conferencia';

extrator.definirWorkerDoPdf(workerDoPdf);

function AppConversor() {
  const { etapa = '' } = useParams();
  return (
    <SessaoProvider etapa={(indiceDaEtapa(etapa) >= 0 ? etapa : 'arquivo') as IdEtapa}>
      <CascaConversor>
        <Outlet />
      </CascaConversor>
    </SessaoProvider>
  );
}

function Tela() {
  const s = useSessao();
  const { etapa = '' } = useParams();
  if (indiceDaEtapa(etapa) < 0 || !s.podeAbrir(s.etapa)) {
    const ultima = [...ETAPAS].reverse().find(e => s.podeAbrir(e.id)) || ETAPAS[0];
    return <Navigate to={caminhoDaEtapa(ultima.id)} replace />;
  }
  switch (s.etapa) {
    case 'arquivo': return <Arquivo />;
    case 'conferencia': return <Conferencia />;
    case 'baixar': return <Baixar />;
  }
}

export const rotasConversor: RouteObject[] = [
  {
    path: BASE,
    element: <AppConversor />,
    children: [
      { index: true, element: <Navigate to={caminhoDaEtapa('arquivo')} replace /> },
      { path: ':etapa', element: <Tela /> },
    ],
  },
];
