// Rota da empresa aberta no Creditor: /creditor/:empresa/:etapa. Resolve a empresa (código do ERP
// ou nome), monta a sessão e a casca e escolhe a tela da etapa. Etapa ainda travada volta para a
// última liberada.
import { empresas } from '@nads/core';
import { Navigate, useLocation, useParams } from 'react-router';
import { useEmpresaDoExtratudo } from '../../../empresas';
import { TopoProvider } from '../../../../../comum/topo';
import { Competencia } from '../telas/competencia/Competencia';
import { Cruzamento } from '../telas/cruzamento/Cruzamento';
import { Lancamentos } from '../telas/lancamentos/Lancamentos';
import { CascaCreditor } from './Casca';
import { caminho } from './caminho';
import { caminhoDaEtapa, ETAPAS, indiceDaEtapa, type IdEtapa } from './navegacao';
import { SessaoProvider, useSessao } from './sessao';

function Tela() {
  const s = useSessao();
  // o ?competencia=&meses= da Tarefa vai junto em toda troca de etapa (sem ele, o Creditor esquecia os meses do caixa)
  const { search } = useLocation();
  if (indiceDaEtapa(s.etapa) < 0 || !s.podeAbrir(s.etapa)) {
    const ultima = [...ETAPAS].reverse().find(e => s.podeAbrir(e.id)) || ETAPAS[0];
    return <Navigate to={caminhoDaEtapa(s.rota, ultima.id) + search} replace />;
  }
  switch (s.etapa) {
    case 'competencia': return <Competencia />;
    case 'cruzamento': return <Cruzamento />;
    case 'lancamentos': return <Lancamentos />;
  }
}

export function EmpresaAberta() {
  const { empresa: param = '', etapa = '' } = useParams();
  const empresa = useEmpresaDoExtratudo(param);
  const { search } = useLocation();
  if (!empresa) return <Navigate to={caminho()} replace />;
  const rota = empresas.rotaDaEmpresa(empresa);
  if (!etapa || param !== rota) return <Navigate to={caminhoDaEtapa(rota, indiceDaEtapa(etapa) >= 0 ? etapa as IdEtapa : 'competencia') + search} replace />;
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
