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
import { aplicacao, aplicacoesDe, BASE, caminhoDaPagina, type IdAplicacao } from './navegacao';
import { useOperador, type Operador } from './operador';
import type { IdPaginaAdmin } from '../../admin/casca/navegacao';

// cada tela é um pedaço à parte (revisão da UI, 18/10/2026: o pacote inicial tinha 4 MB): baixa quando a pessoa abre a
// página, com o Esqueleto no lugar enquanto chega (comum/pedaco.tsx). As da Entregas ainda vêm no pacote inicial.
const UsuariosDoNads = pedaco(() => import('../telas/cadastro/usuarios/UsuariosDoNads'), 'UsuariosDoNads');
const TelaDoAdmin = pedaco(() => import('../telas/configuracoes/TelaDoAdmin'), 'TelaDoAdmin');
const VisaoContabil = pedaco(() => import('../telas/contabil/VisaoContabil'), 'VisaoContabil');
const ExploradorDoDrive = pedaco(() => import('../telas/drive/ExploradorDoDrive'), 'ExploradorDoDrive');
const CaixaDoRobo = pedaco(() => import('../telas/gmail/CaixaDoRobo'), 'CaixaDoRobo');
const HistoricoDoRobo = pedaco(() => import('../telas/gmail/HistoricoDoRobo'), 'HistoricoDoRobo');
const MinhasEmpresas = pedaco(() => import('../telas/empresas/MinhasEmpresas'), 'MinhasEmpresas');
const Justificativas = pedaco(() => import('../telas/empresas/Justificativas'), 'Justificativas');
const ConfiguracoesContabil = pedaco(() => import('../telas/contabil/configuracoes/ConfiguracoesContabil'), 'ConfiguracoesContabil');
const Inicio = pedaco(() => import('../telas/inicio/Inicio'), 'Inicio');
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
const FaturamentoDosClientes = pedaco(() => import('../telas/fiscal/faturamento/FaturamentoDosClientes'), 'FaturamentoDosClientes');
const AntecipacaoIcms = pedaco(() => import('../telas/fiscal/antecipacao/AntecipacaoIcms'), 'AntecipacaoIcms');
const ControleDeTributos = pedaco(() => import('../telas/fiscal/controle/ControleDeTributos'), 'ControleDeTributos');
const RateioDeFrete = pedaco(() => import('../telas/fiscal/rateio/RateioDeFrete'), 'RateioDeFrete');
const CalculadoraDoSimples = pedaco(() => import('../telas/fiscal/simples/CalculadoraDoSimples'), 'CalculadoraDoSimples');
const ConfiguracoesDoDp = pedaco(() => import('../telas/dp/ConfiguracoesDoDp'), 'ConfiguracoesDoDp');
const Mandei = pedaco(() => import('../telas/mandei/Mandei'), 'Mandei');
const ChamadosDoCliente = pedaco(() => import('../telas/area-cliente/ChamadosDoCliente'), 'ChamadosDoCliente');
const RecebidosDoCliente = pedaco(() => import('../telas/area-cliente/RecebidosDoCliente'), 'RecebidosDoCliente');
const ConfiguracoesDoFinanceiro = pedaco(() => import('../telas/financeiro/ConfiguracoesDoFinanceiro'), 'ConfiguracoesDoFinanceiro');
const NotasFiscais = pedaco(() => import('../telas/financeiro/NotasFiscais'), 'NotasFiscais');
const Caixa = pedaco(() => import('../telas/financeiro/Caixa'), 'Caixa');
const Honorarios = pedaco(() => import('../telas/financeiro/Honorarios'), 'Honorarios');
const PlanoDeContas = pedaco(() => import('../telas/financeiro/PlanoDeContas'), 'PlanoDeContas');
const PainelFinanceiro = pedaco(() => import('../telas/financeiro/PainelFinanceiro'), 'PainelFinanceiro');
const Devedores = pedaco(() => import('../telas/financeiro/Devedores'), 'Devedores');
const ImportarExtrato = pedaco(() => import('../telas/financeiro/ImportarExtrato'), 'ImportarExtrato');

function Tela({ app, pagina }: { app: IdAplicacao; pagina: string }) {
  switch (app) {
    case 'inicio': return <Inicio />;
    case 'minhas-empresas': return pagina === 'justificativas' ? <Justificativas /> : pagina === 'configuracoes' ? <ConfiguracoesContabil /> : <MinhasEmpresas />;
    // as Empresas, o Painel, a Visão geral e as Paradas do Fiscal saíram (27/10/2026): ficam as ferramentas
    case 'fiscal': return pagina === 'sintegra' ? <PaginaSintegra /> : pagina === 'faturamento' ? <FaturamentoDosClientes /> : pagina === 'simples' ? <CalculadoraDoSimples /> : pagina === 'rateio-frete' ? <RateioDeFrete /> : pagina === 'antecipacao-es' ? <AntecipacaoIcms /> : pagina === 'controle-tributos' ? <ControleDeTributos /> : <Reinf />;
    case 'dp': return ABAS_DO_PAINEL.includes(pagina as AbaDoPainel) ? <PainelDoDp aba={pagina as AbaDoPainel} /> : pagina === 'configuracoes' ? <ConfiguracoesDoDp /> : pagina === 'fgts' ? <FgtsDoDp /> : pagina === 'legislacao' ? <LegislacaoDoDp /> : <VisaoContabil pagina={pagina} dep="dp" />;
    case 'senhas': return pagina === 'acesso' ? <AcessoAoCofre /> : pagina === 'gov' ? <ContasGov /> : pagina === 'certificados' ? <Certificados /> : <SenhasDasEmpresas />;
    // as Configurações (28/10/2026): a Equipe e as páginas do admin (as Empresas têm rota própria, CadastroAberto)
    case 'cadastro': return pagina === 'usuarios' ? <UsuariosDoNads /> : <TelaDoAdmin pagina={pagina as IdPaginaAdmin} />;
    // a Área do Cliente com o Mandei junto (19/10/2026): Chamados, Recebidos, Meus tickets e a Central de tickets
    case 'area-cliente': return pagina === 'recebidos' ? <RecebidosDoCliente /> : pagina === 'meus' || pagina === 'central' ? <Mandei pagina={pagina} /> : <ChamadosDoCliente />;
    case 'financeiro': return pagina === 'painel' ? <PainelFinanceiro /> : pagina === 'devedores' ? <Devedores /> : pagina === 'resultado' ? <PainelFinanceiro comResultado /> : pagina === 'extrato' || pagina === 'conciliacao' ? <ImportarExtrato /> : pagina === 'configuracoes' ? <ConfiguracoesDoFinanceiro /> : pagina === 'caixa' ? <Caixa /> : pagina === 'honorarios' ? <Honorarios /> : pagina === 'plano' ? <PlanoDeContas /> : <NotasFiscais />;
    // a entrega de documentos aos clientes, trazida do Entregas (16/10/2026)
    case 'entregas': return pagina === 'painel' ? <PainelDeEntregas /> : pagina === 'solicitacoes' ? <Solicitacoes /> : pagina === 'nova' ? <NovaEntrega /> : <RotaDeEntregas />;
    case 'drive': return <ExploradorDoDrive />;
    case 'contato': return pagina === 'historico' ? <HistoricoDoRobo /> : <CaixaDoRobo />;
    default: return <EmDesenvolvimento nome={aplicacao(app)?.nome || app} />;
  }
}

export function AplicacaoAberta() {
  const { app = '', pagina: naUrl = '' } = useParams();
  // o Início é /tarefas/inicio (sem página no endereço); o endereço de antes (minhas-empresas/inicio) leva para lá
  const pagina = app === 'inicio' && !naUrl ? 'inicio' : naUrl;
  const op = useOperador().operador as Operador;
  // o Mandei entrou na Área do Cliente (19/10/2026): os links antigos levam para lá, na mesma página
  if (app === 'minhas-empresas' && pagina === 'inicio') return <Navigate to={BASE + '/inicio'} replace />;
  if (app === 'mandei') return <Navigate to={caminhoDaPagina('area-cliente', pagina === 'central' ? 'central' : 'meus')} replace />;
  const a = aplicacoesDe(op).find(x => x.id === app);
  if (!a) return <Navigate to={caminhoDaPagina('minhas-empresas', 'empresas')} replace />;
  // os links antigos do Cadastro (Sistema e agentes, Painel do robô e Uso do sistema foram para o site do admin; 22/10/2026) e
  // qualquer página que não existe caem, sem erro, na primeira página liberada, pelo redirecionamento abaixo (Empresas)
  // a página Links saiu (o link vive no Cadastro, na janela da empresa; 17/10/2026): o link antigo cai em Chamados, pelo redirecionamento abaixo
  // a página que não existe, ou que está em desenvolvimento (o link direto; 21/10/2026), cai na primeira liberada
  if (!a.paginas.some(p => p.id === pagina && !p.emDesenvolvimento)) return <Navigate to={caminhoDaPagina(a.id, (a.paginas.find(p => !p.emDesenvolvimento) || a.paginas[0]).id)} replace />;
  return (
    <TopoProvider>
      <CascaTarefas app={a.id} pagina={pagina} telaInteira={a.id === 'drive'} semLateral={a.id === 'minhas-empresas'} larga>
        <NaEspera><Tela app={a.id} pagina={pagina} /></NaEspera>
      </CascaTarefas>
    </TopoProvider>
  );
}
