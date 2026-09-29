// Rota da empresa aberta no Creditor: /creditor/:empresa/:etapa. Resolve a empresa (código do ERP
// ou nome), monta a sessão e a casca e escolhe a tela da etapa. Etapa ainda travada volta para a
// última liberada.
import { empresas } from '@nads/core';
import { Navigate, useParams } from 'react-router';
import { useEmpresaDoExtratudo } from '../../../empresas';
import { TopoProvider } from '../../../../../comum/topo';
import { Banco } from '../telas/banco/Banco';
import { Competencia } from '../telas/competencia/Competencia';
import { Conferencia } from '../telas/conferencia/Conferencia';
import { Cruzamento } from '../telas/cruzamento/Cruzamento';
import { Fiscal } from '../telas/fiscal/Fiscal';
import { Lancamentos } from '../telas/lancamentos/Lancamentos';
import { Sistema } from '../telas/sistema/Sistema';
import { CascaCreditor } from './Casca';
import { caminho } from './caminho';
import { caminhoDaEtapa, ETAPAS, indiceDaEtapa, type IdEtapa } from './navegacao';
import { SessaoProvider, useSessao } from './sessao';

function Tela() {
  const s = useSessao();
  if (indiceDaEtapa(s.etapa) < 0 || !s.podeAbrir(s.etapa)) {
    const ultima = [...ETAPAS].reverse().find(e => s.podeAbrir(e.id)) || ETAPAS[0];
    return <Navigate to={caminhoDaEtapa(s.rota, ultima.id)} replace />;
  }
  switch (s.etapa) {
    case 'competencia': return <Competencia />;
    case 'banco': return <Banco />;
    case 'conferencia': return <Conferencia />;
    case 'fiscal': return <Fiscal />;
    case 'sistema': return <Sistema />;
    case 'cruzamento': return <Cruzamento />;
    case 'lancamentos': return <Lancamentos />;
  }
}

export function EmpresaAberta() {
  const { empresa: param = '', etapa = '' } = useParams();
  const empresa = useEmpresaDoExtratudo(param);
  if (!empresa) return <Navigate to={caminho()} replace />;
  const rota = empresas.rotaDaEmpresa(empresa);
  if (!etapa || param !== rota) return <Navigate to={caminhoDaEtapa(rota, indiceDaEtapa(etapa) >= 0 ? etapa as IdEtapa : 'competencia')} replace />;
  return (
    // key = empresa: trocar de empresa começa do zero (nada é guardado)
    <SessaoProvider key={rota} empresa={empresa} rota={rota} etapa={etapa as IdEtapa}>
      <TopoProvider>
        <CascaCreditor>
          <Tela />
        </CascaCreditor>
      </TopoProvider>
    </SessaoProvider>
  );
}
