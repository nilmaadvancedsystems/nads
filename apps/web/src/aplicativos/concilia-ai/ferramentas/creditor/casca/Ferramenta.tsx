// O Creditor dentro do Concilia aí: /:empresa/creditor/:etapa.
// Monta a sessão e a casca e escolhe a tela da etapa. Etapa ainda travada volta para a última liberada.
import { Navigate } from 'react-router';
import { Banco } from '../telas/banco/Banco';
import { Conferencia } from '../telas/conferencia/Conferencia';
import { Cruzamento } from '../telas/cruzamento/Cruzamento';
import { Lancamentos } from '../telas/lancamentos/Lancamentos';
import { Sistema } from '../telas/sistema/Sistema';
import { CascaCreditor } from './Casca';
import { caminhoDaEtapa, ETAPAS, indiceDaEtapa, type IdEtapa } from './navegacao';
import { SessaoProvider, useSessao } from './sessao';

function Tela() {
  const s = useSessao();
  if (indiceDaEtapa(s.etapa) < 0 || !s.podeAbrir(s.etapa)) {
    const ultima = [...ETAPAS].reverse().find(e => s.podeAbrir(e.id)) || ETAPAS[0];
    return <Navigate to={caminhoDaEtapa(s.rota, ultima.id)} replace />;
  }
  switch (s.etapa) {
    case 'banco': return <Banco />;
    case 'conferencia': return <Conferencia />;
    case 'sistema': return <Sistema />;
    case 'cruzamento': return <Cruzamento />;
    case 'lancamentos': return <Lancamentos />;
  }
}

export function FerramentaCreditor({ empresa, rota, pagina }: { empresa: { nome: string; codigo: number | null }; rota: string; pagina: string }) {
  if (!pagina) return <Navigate to={caminhoDaEtapa(rota, 'banco')} replace />;
  return (
    <SessaoProvider empresa={empresa} rota={rota} etapa={pagina as IdEtapa}>
      <CascaCreditor>
        <Tela />
      </CascaCreditor>
    </SessaoProvider>
  );
}
