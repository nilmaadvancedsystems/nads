// A Carteira (12/11/2026: "um dashboard de salário, de finanças, e também um controle de comissões dentro do sistema, para que
// fique resumido para o financeiro fazer o pagamento"). Por enquanto só o Vitor (carteiraLiberada); os outros veem a tela
// "em desenvolvimento". As páginas do Financeiro (Comissões da equipe, Enviar holerites) só aparecem para o Financeiro.
import { carteiraLiberada, podeVerOFinanceiro } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { CarteiraEmBreve } from './CarteiraEmBreve';
import { ComissoesDaEquipe } from './ComissoesDaEquipe';
import { EnviarHolerites } from './EnviarHolerites';
import { FinancasPessoais } from './FinancasPessoais';
import { HoleritesEPagamentos } from './HoleritesEPagamentos';
import { MinhasComissoes } from './MinhasComissoes';
import { VisaoDaCarteira } from './VisaoDaCarteira';

export function Carteira({ pagina }: { pagina: string }) {
  const { operador } = useOperador();
  if (!carteiraLiberada(operador)) return <CarteiraEmBreve />;
  const financeiro = podeVerOFinanceiro(operador);
  switch (pagina) {
    case 'comissoes': return <MinhasComissoes />;
    case 'financas': return <FinancasPessoais />;
    case 'documentos': return <HoleritesEPagamentos />;
    case 'pagamentos': return financeiro ? <ComissoesDaEquipe /> : <VisaoDaCarteira />;
    case 'enviar': return financeiro ? <EnviarHolerites /> : <VisaoDaCarteira />;
    default: return <VisaoDaCarteira />;
  }
}
