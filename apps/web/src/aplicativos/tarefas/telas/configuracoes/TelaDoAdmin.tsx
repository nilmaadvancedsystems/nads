// As páginas do admin dentro das Configurações da Tarefas (Vitor, 28/10/2026: "Cadastro, esse admin, colocar tudo em um botão
// Configurações"): as MESMAS telas do site do admin (admin/rotas.tsx), cada uma um pedaço à parte, com o CSS de lá.
import { NaEspera, pedaco } from '../../../../comum/pedaco';
import type { IdPaginaAdmin } from '../../../admin/casca/navegacao';
import '../../../admin/admin.css';

const VisaoGeral = pedaco(() => import('../../../admin/telas/visao-geral/VisaoGeral'), 'VisaoGeral');
const Arquivador = pedaco(() => import('../../../admin/telas/arquivador/Arquivador'), 'Arquivador');
const SaudeDoBanco = pedaco(() => import('../../../admin/telas/banco/SaudeDoBanco'), 'SaudeDoBanco');
const CotaECustos = pedaco(() => import('../../../admin/telas/cota/CotaECustos'), 'CotaECustos');
const FeedbacksDoAdmin = pedaco(() => import('../../../admin/telas/feedbacks/FeedbacksDoAdmin'), 'FeedbacksDoAdmin');
const PainelDoRobo = pedaco(() => import('../cadastro/painel-robo/PainelDoRobo'), 'PainelDoRobo');
const UsoDoSistema = pedaco(() => import('../uso/UsoDoSistema'), 'UsoDoSistema');
const RobosEAgentes = pedaco(() => import('../cadastro/configuracoes/ConfiguracoesDoNads'), 'RobosEAgentes');

function Tela({ pagina }: { pagina: IdPaginaAdmin }) {
  switch (pagina) {
    case 'visao-geral': return <VisaoGeral />;
    case 'robo': return <PainelDoRobo />;
    case 'arquivador': return <Arquivador />;
    case 'uso': return <UsoDoSistema />;
    case 'banco': return <SaudeDoBanco />;
    case 'cota': return <CotaECustos />;
    case 'feedbacks': return <FeedbacksDoAdmin />;
    case 'sistema': return <RobosEAgentes />;
  }
}

export function TelaDoAdmin({ pagina }: { pagina: IdPaginaAdmin }) {
  return <NaEspera><Tela pagina={pagina} /></NaEspera>;
}
