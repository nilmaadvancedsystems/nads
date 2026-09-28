// O Conciliadorzinho dentro do Concilia aí: /:empresa/conciliadorzinho/:etapa.
// Monta a sessão e a casca e escolhe a tela da etapa. Etapa que ainda não foi alcançada
// (ou de bandeira não escolhida) volta para a última possível.
import { Navigate } from 'react-router';
import { Arquivos } from '../telas/arquivos/Arquivos';
import { Bandeiras } from '../telas/bandeiras/Bandeiras';
import { Contas } from '../telas/contas/Contas';
import { Extrato } from '../telas/extrato/Extrato';
import { Notas } from '../telas/notas/Notas';
import { Totais } from '../telas/totais/Totais';
import { CascaConciliador } from './Casca';
import { caminhoDaEtapa, type IdEtapa } from './navegacao';
import { SessaoProvider, useSessao } from './sessao';

function Tela() {
  const s = useSessao();
  const atual = s.lista.find(x => x.id === s.etapa);
  if (!atual || !s.podeAbrir(s.etapa)) {
    const ultima = s.lista[Math.min(s.estado.alcancada, s.lista.length - 1)];
    return <Navigate to={caminhoDaEtapa(s.rota, ultima.id)} replace />;
  }
  if (atual.bandeira) return <Extrato key={atual.bandeira} bandeira={atual.bandeira} />;
  switch (atual.id) {
    case 'bandeiras': return <Bandeiras />;
    case 'notas': return <Notas />;
    case 'contas': return <Contas />;
    case 'totais': return <Totais />;
    case 'arquivos': return <Arquivos />;
    default: return null;
  }
}

export function FerramentaConciliador({ empresa, rota, pagina }: { empresa: { nome: string; codigo: number | null }; rota: string; pagina: string }) {
  if (!pagina) return <Navigate to={caminhoDaEtapa(rota, 'bandeiras')} replace />;
  return (
    <SessaoProvider empresa={empresa} rota={rota} etapa={pagina as IdEtapa}>
      <CascaConciliador>
        <Tela />
      </CascaConciliador>
    </SessaoProvider>
  );
}
