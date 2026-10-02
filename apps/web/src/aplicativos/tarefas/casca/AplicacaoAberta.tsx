// Rota de uma aplicação da Tarefas: /tarefas/:app/:pagina. Monta a casca e escolhe a tela; as
// aplicações que ainda não foram feitas mostram "Em desenvolvimento". O Cadastro tem rota própria (CadastroAberto).
import { Navigate, useParams } from 'react-router';
import { TopoProvider } from '../../../comum/topo';
import { ConfiguracoesDoNads } from '../telas/cadastro/configuracoes/ConfiguracoesDoNads';
import { UsuariosDoNads } from '../telas/cadastro/usuarios/UsuariosDoNads';
import { VisaoContabil } from '../telas/contabil/VisaoContabil';
import { ExploradorDoDrive } from '../telas/drive/ExploradorDoDrive';
import { CaixaDoRobo } from '../telas/gmail/CaixaDoRobo';
import { HistoricoDoRobo } from '../telas/gmail/HistoricoDoRobo';
import { MinhasEmpresas } from '../telas/empresas/MinhasEmpresas';
import { Insights } from '../telas/insights/Insights';
import { EmDesenvolvimento } from '../telas/em-desenvolvimento/EmDesenvolvimento';
import { CascaTarefas } from './CascaTarefas';
import { aplicacao, aplicacoesDe, caminhoDaPagina, type IdAplicacao } from './navegacao';
import { useOperador, type Operador } from './operador';

function Tela({ app, pagina }: { app: IdAplicacao; pagina: string }) {
  switch (app) {
    case 'minhas-empresas': return pagina === 'insights' ? <Insights /> : <MinhasEmpresas />;
    case 'contabil': return <VisaoContabil pagina={pagina} />;
    case 'cadastro': return pagina === 'configuracoes' ? <ConfiguracoesDoNads /> : <UsuariosDoNads />;
    case 'drive': return <ExploradorDoDrive />;
    case 'contato': return pagina === 'historico' ? <HistoricoDoRobo /> : <CaixaDoRobo />;
    default: return <EmDesenvolvimento nome={aplicacao(app)?.nome || app} />;
  }
}

export function AplicacaoAberta() {
  const { app = '', pagina = '' } = useParams();
  const op = useOperador().operador as Operador;
  const a = aplicacoesDe(op).find(x => x.id === app);
  if (!a) return <Navigate to={caminhoDaPagina('minhas-empresas', 'empresas')} replace />;
  if (!a.paginas.some(p => p.id === pagina)) return <Navigate to={caminhoDaPagina(a.id, a.paginas[0].id)} replace />;
  return (
    <TopoProvider>
      <CascaTarefas app={a.id} pagina={pagina} telaInteira={a.id === 'drive'}>
        <Tela app={a.id} pagina={pagina} />
      </CascaTarefas>
    </TopoProvider>
  );
}
