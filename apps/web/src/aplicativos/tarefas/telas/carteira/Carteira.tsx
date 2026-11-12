// A Carteira (12/11/2026: "um dashboard de salário, de finanças, e também um controle de comissões dentro do sistema, para que
// fique resumido para o financeiro fazer o pagamento"). Por enquanto só o Vitor (carteiraLiberada); os outros veem a tela
// "em desenvolvimento". O lado do Financeiro (Comissões da equipe, Enviar holerites) fica no Financeiro, e a Visão geral e as
// Finanças pessoais saíram (12/11/2026): ficam as Comissões e os Holerites e pagamentos.
import { carteiraLiberada } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { CarteiraEmBreve } from './CarteiraEmBreve';
import { HoleritesEPagamentos } from './HoleritesEPagamentos';
import { Insumos } from './Insumos';
import { MinhasComissoes } from './MinhasComissoes';

export function Carteira({ pagina }: { pagina: string }) {
  const { operador } = useOperador();
  // os Insumos são de toda a equipe (12/11/2026)
  if (pagina === 'insumos') return <Insumos />;
  if (!carteiraLiberada(operador)) return <CarteiraEmBreve />;
  return pagina === 'documentos' ? <HoleritesEPagamentos /> : <MinhasComissoes />;
}
