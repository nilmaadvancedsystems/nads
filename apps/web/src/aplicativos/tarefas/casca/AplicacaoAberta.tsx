// Rota de uma aplicação da Tarefas: /tarefas/:app/:pagina. Monta a casca e escolhe a tela; as
// aplicações que ainda não foram feitas mostram "Em desenvolvimento". O Cadastro tem rota própria (CadastroAberto).
import { Navigate, useParams } from 'react-router';
import { NaEspera, pedaco } from '../../../comum/pedaco';
import { TopoProvider } from '../../../comum/topo';
import { ABAS_DO_PAINEL, type AbaDoPainel } from '../telas/dp/abasDoPainel';
import { NovaEntrega } from '../telas/entregas/NovaEntrega';
import { PainelDeEntregas } from '../telas/entregas/PainelDeEntregas';
import { Solicitacoes } from '../telas/entregas/Solicitacoes';
import { RotaDeEntregas } from '../telas/entregas/RotaDeEntregas';
import { CascaTarefas } from './CascaTarefas';
import { aplicacao, aplicacoesDe, caminhoDaPagina, type IdAplicacao } from './navegacao';
import { useOperador, type Operador } from './operador';

// cada tela é um pedaço à parte (revisão da UI, 18/10/2026: o pacote inicial tinha 4 MB): baixa quando a pessoa abre a
// página, com o Esqueleto no lugar enquanto chega (comum/pedaco.tsx). As da Entregas ainda vêm no pacote inicial.
const PainelDoFiscal = pedaco(() => import('../telas/fiscal/painel/PainelDoFiscal'), 'PainelDoFiscal');
const RobosEAgentes = pedaco(() => import('../telas/cadastro/configuracoes/ConfiguracoesDoNads'), 'RobosEAgentes');
const PainelDoRobo = pedaco(() => import('../telas/cadastro/painel-robo/PainelDoRobo'), 'PainelDoRobo');
const UsuariosDoNads = pedaco(() => import('../telas/cadastro/usuarios/UsuariosDoNads'), 'UsuariosDoNads');
const UsoDoSistema = pedaco(() => import('../telas/uso/UsoDoSistema'), 'UsoDoSistema');
const VisaoContabil = pedaco(() => import('../telas/contabil/VisaoContabil'), 'VisaoContabil');
const ConfiguracoesContabil = pedaco(() => import('../telas/contabil/configuracoes/ConfiguracoesContabil'), 'ConfiguracoesContabil');
const ExploradorDoDrive = pedaco(() => import('../telas/drive/ExploradorDoDrive'), 'ExploradorDoDrive');
const CaixaDoRobo = pedaco(() => import('../telas/gmail/CaixaDoRobo'), 'CaixaDoRobo');
const HistoricoDoRobo = pedaco(() => import('../telas/gmail/HistoricoDoRobo'), 'HistoricoDoRobo');
const MinhasEmpresas = pedaco(() => import('../telas/empresas/MinhasEmpresas'), 'MinhasEmpresas');
const Insights = pedaco(() => import('../telas/insights/Insights'), 'Insights');
const EmDesenvolvimento = pedaco(() => import('../telas/em-desenvolvimento/EmDesenvolvimento'), 'EmDesenvolvimento');
const Reinf = pedaco(() => import('../telas/fiscal/reinf/Reinf'), 'Reinf');
const PainelDoDp = pedaco(() => import('../telas/dp/PainelDoDp'), 'PainelDoDp');
const SenhasDasEmpresas = pedaco(() => import('../telas/senhas/SenhasDasEmpresas'), 'SenhasDasEmpresas');
const AcessoAoCofre = pedaco(() => import('../telas/senhas/AcessoAoCofre'), 'AcessoAoCofre');
const Certificados = pedaco(() => import('../telas/senhas/Certificados'), 'Certificados');
const ContasGov = pedaco(() => import('../telas/senhas/ContasGov'), 'ContasGov');
const FgtsDoDp = pedaco(() => import('../telas/dp/FgtsDoDp'), 'FgtsDoDp');
const LegislacaoDoDp = pedaco(() => import('../telas/dp/LegislacaoDoDp'), 'LegislacaoDoDp');
const PaginaSintegra = pedaco(() => import('../telas/fiscal/sintegra/PaginaSintegra'), 'PaginaSintegra');
const ConfiguracoesDoDp = pedaco(() => import('../telas/dp/ConfiguracoesDoDp'), 'ConfiguracoesDoDp');
const Mandei = pedaco(() => import('../telas/mandei/Mandei'), 'Mandei');
const ChamadosDoCliente = pedaco(() => import('../telas/area-cliente/ChamadosDoCliente'), 'ChamadosDoCliente');
const RecebidosDoCliente = pedaco(() => import('../telas/area-cliente/RecebidosDoCliente'), 'RecebidosDoCliente');
const ConfiguracoesDoFinanceiro = pedaco(() => import('../telas/financeiro/ConfiguracoesDoFinanceiro'), 'ConfiguracoesDoFinanceiro');
const NotasFiscais = pedaco(() => import('../telas/financeiro/NotasFiscais'), 'NotasFiscais');
const Caixa = pedaco(() => import('../telas/financeiro/Caixa'), 'Caixa');
const Honorarios = pedaco(() => import('../telas/financeiro/Honorarios'), 'Honorarios');
const PlanoDeContas = pedaco(() => import('../telas/financeiro/PlanoDeContas'), 'PlanoDeContas');

function Tela({ app, pagina }: { app: IdAplicacao; pagina: string }) {
  switch (app) {
    case 'minhas-empresas': return pagina === 'insights' ? <Insights /> : <MinhasEmpresas />;
    case 'contabil': return pagina === 'configuracoes' ? <ConfiguracoesContabil /> : <VisaoContabil pagina={pagina} />;
    case 'fiscal': return pagina === 'empresas' ? <MinhasEmpresas /> : pagina === 'painel' ? <PainelDoFiscal /> : pagina === 'reinf' ? <Reinf /> : pagina === 'sintegra' ? <PaginaSintegra /> : <VisaoContabil pagina={pagina} dep="fiscal" />;
    case 'dp': return ABAS_DO_PAINEL.includes(pagina as AbaDoPainel) ? <PainelDoDp aba={pagina as AbaDoPainel} /> : pagina === 'configuracoes' ? <ConfiguracoesDoDp /> : pagina === 'fgts' ? <FgtsDoDp /> : pagina === 'legislacao' ? <LegislacaoDoDp /> : <VisaoContabil pagina={pagina} dep="dp" />;
    case 'senhas': return pagina === 'acesso' ? <AcessoAoCofre /> : pagina === 'gov' ? <ContasGov /> : pagina === 'certificados' ? <Certificados /> : <SenhasDasEmpresas />;
    case 'cadastro': return pagina === 'sistema' ? <RobosEAgentes /> : pagina === 'robo' ? <PainelDoRobo /> : pagina === 'uso' ? <UsoDoSistema /> : <UsuariosDoNads />;
    // a Área do Cliente com o Mandei junto (19/10/2026): Chamados, Recebidos, Meus tickets e a Central de tickets
    case 'area-cliente': return pagina === 'recebidos' ? <RecebidosDoCliente /> : pagina === 'meus' || pagina === 'central' ? <Mandei pagina={pagina} /> : <ChamadosDoCliente />;
    case 'financeiro': return pagina === 'configuracoes' ? <ConfiguracoesDoFinanceiro /> : pagina === 'caixa' ? <Caixa /> : pagina === 'honorarios' ? <Honorarios /> : pagina === 'plano' ? <PlanoDeContas /> : <NotasFiscais />;
    // a entrega de documentos aos clientes, trazida do Entregas (16/10/2026)
    case 'entregas': return pagina === 'painel' ? <PainelDeEntregas /> : pagina === 'solicitacoes' ? <Solicitacoes /> : pagina === 'nova' ? <NovaEntrega /> : <RotaDeEntregas />;
    case 'drive': return <ExploradorDoDrive />;
    case 'contato': return pagina === 'historico' ? <HistoricoDoRobo /> : <CaixaDoRobo />;
    default: return <EmDesenvolvimento nome={aplicacao(app)?.nome || app} />;
  }
}

export function AplicacaoAberta() {
  const { app = '', pagina = '' } = useParams();
  const op = useOperador().operador as Operador;
  // o Mandei entrou na Área do Cliente (19/10/2026): os links antigos levam para lá, na mesma página
  if (app === 'mandei') return <Navigate to={caminhoDaPagina('area-cliente', pagina === 'central' ? 'central' : 'meus')} replace />;
  const a = aplicacoesDe(op).find(x => x.id === app);
  if (!a) return <Navigate to={caminhoDaPagina('minhas-empresas', 'empresas')} replace />;
  // os links antigos do Cadastro (Configurações e Agentes viraram Robôs e agentes; 13/10/2026)
  if (a.id === 'cadastro' && (pagina === 'configuracoes' || pagina === 'agentes' || pagina === 'robos')) return <Navigate to={caminhoDaPagina('cadastro', 'sistema')} replace />;
  // a página Links saiu (o link vive no Cadastro, na janela da empresa; 17/10/2026): o link antigo cai em Chamados, pelo redirecionamento abaixo
  // a página que não existe, ou que está em desenvolvimento (o link direto; 21/10/2026), cai na primeira liberada
  if (!a.paginas.some(p => p.id === pagina && !p.emDesenvolvimento)) return <Navigate to={caminhoDaPagina(a.id, (a.paginas.find(p => !p.emDesenvolvimento) || a.paginas[0]).id)} replace />;
  return (
    <TopoProvider>
      <CascaTarefas app={a.id} pagina={pagina} telaInteira={a.id === 'drive'} larga>
        <NaEspera><Tela app={a.id} pagina={pagina} /></NaEspera>
      </CascaTarefas>
    </TopoProvider>
  );
}
