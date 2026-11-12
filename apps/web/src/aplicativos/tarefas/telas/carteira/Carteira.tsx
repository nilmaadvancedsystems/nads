// A Carteira (12/11/2026: "um dashboard de salário, de finanças, e também um controle de comissões dentro do sistema, para que
// fique resumido para o financeiro fazer o pagamento"). Por enquanto só o Vitor (carteiraLiberada); os outros veem a tela
// "em desenvolvimento". O lado do Financeiro (Comissões da equipe, Enviar holerites) fica no Financeiro (12/11/2026).
import { carteiraLiberada } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { CarteiraEmBreve } from './CarteiraEmBreve';
import { FinancasPessoais } from './FinancasPessoais';
import { HoleritesEPagamentos } from './HoleritesEPagamentos';
import { Insumos } from './Insumos';
import { MinhasComissoes } from './MinhasComissoes';
import { VisaoDaCarteira } from './VisaoDaCarteira';

export function Carteira({ pagina }: { pagina: string }) {
  const { operador } = useOperador();
  // os Insumos são de toda a equipe (12/11/2026)
  if (pagina === 'insumos') return <Insumos />;
  if (!carteiraLiberada(operador)) return <CarteiraEmBreve />;
  switch (pagina) {
    case 'comissoes': return <MinhasComissoes />;
    case 'financas': return <FinancasPessoais />;
    case 'documentos': return <HoleritesEPagamentos />;
    default: return <VisaoDaCarteira />;
  }
}
