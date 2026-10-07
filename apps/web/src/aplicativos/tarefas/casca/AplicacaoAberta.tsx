// Rota de uma aplicação da Tarefas: /tarefas/:app/:pagina. Monta a casca e escolhe a tela; as
// aplicações que ainda não foram feitas mostram "Em desenvolvimento". O Cadastro tem rota própria (CadastroAberto).
import { Navigate, useParams } from 'react-router';
import { TopoProvider } from '../../../comum/topo';
import { ConfiguracoesDoNads } from '../telas/cadastro/configuracoes/ConfiguracoesDoNads';
import { UsuariosDoNads } from '../telas/cadastro/usuarios/UsuariosDoNads';
import { VisaoContabil } from '../telas/contabil/VisaoContabil';
import { ConfiguracoesContabil } from '../telas/contabil/configuracoes/ConfiguracoesContabil';
import { ExploradorDoDrive } from '../telas/drive/ExploradorDoDrive';
import { CaixaDoRobo } from '../telas/gmail/CaixaDoRobo';
import { HistoricoDoRobo } from '../telas/gmail/HistoricoDoRobo';
import { MinhasEmpresas } from '../telas/empresas/MinhasEmpresas';
import { Insights } from '../telas/insights/Insights';
import { EmDesenvolvimento } from '../telas/em-desenvolvimento/EmDesenvolvimento';
import { Reinf } from '../telas/fiscal/reinf/Reinf';
import { PainelDoDp } from '../telas/dp/PainelDoDp';
import { SenhasDasEmpresas } from '../telas/senhas/SenhasDasEmpresas';
import { AcessoAoCofre } from '../telas/senhas/AcessoAoCofre';
import { Certificados } from '../telas/senhas/Certificados';
import { ContasGov } from '../telas/senhas/ContasGov';
import { ABAS_DO_PAINEL, type AbaDoPainel } from '../telas/dp/usePainelDoDp';
import { ConfiguracoesDoDp } from '../telas/dp/ConfiguracoesDoDp';
import { Mandei } from '../telas/mandei/Mandei';
import { CascaTarefas } from './CascaTarefas';
import { aplicacao, aplicacoesDe, caminhoDaPagina, type IdAplicacao } from './navegacao';
import { useOperador, type Operador } from './operador';

function Tela({ app, pagina }: { app: IdAplicacao; pagina: string }) {
  switch (app) {
    case 'minhas-empresas': return pagina === 'insights' ? <Insights /> : <MinhasEmpresas />;
    case 'contabil': return pagina === 'configuracoes' ? <ConfiguracoesContabil /> : <VisaoContabil pagina={pagina} />;
    case 'fiscal': return pagina === 'empresas' ? <MinhasEmpresas /> : pagina === 'reinf' ? <Reinf /> : <VisaoContabil pagina={pagina} dep="fiscal" />;
    case 'dp': return ABAS_DO_PAINEL.includes(pagina as AbaDoPainel) ? <PainelDoDp aba={pagina as AbaDoPainel} /> : pagina === 'configuracoes' ? <ConfiguracoesDoDp /> : <VisaoContabil pagina={pagina} dep="dp" />;
    case 'senhas': return pagina === 'acesso' ? <AcessoAoCofre /> : pagina === 'gov' ? <ContasGov /> : pagina === 'certificados' ? <Certificados /> : <SenhasDasEmpresas />;
    case 'cadastro': return pagina === 'configuracoes' ? <ConfiguracoesDoNads /> : <UsuariosDoNads />;
    case 'mandei': return <Mandei pagina={pagina === 'central' ? 'central' : 'meus'} />;
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
      <CascaTarefas app={a.id} pagina={pagina} telaInteira={a.id === 'drive'} larga={a.id === 'dp' && pagina === 'obrigacoes'}>
        <Tela app={a.id} pagina={pagina} />
      </CascaTarefas>
    </TopoProvider>
  );
}
