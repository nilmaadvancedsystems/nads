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
import { useMes } from './comum';
import { JanelaDeMateriais } from './JanelaDeMateriais';
import { Icone } from '@nads/ui';
import { useState } from 'react';

export function Carteira({ pagina }: { pagina: string }) {
  const { operador } = useOperador();
  const [materiais, setMateriais] = useState(false);
  // um mês só para a tela (19/11/2026: "repetindo referencia"): o das comissões vale também para os holerites
  const m = useMes('comecar');
  // os Insumos são de toda a equipe (12/11/2026)
  if (pagina === 'insumos') return <Insumos />;
  if (!carteiraLiberada(operador)) return <CarteiraEmBreve />;
  // o Financeiro (19/11/2026): as comissões em cima e, embaixo, os holerites e pagamentos, numa tela só
  return (
    <div className="carteira-financeiro">
      {/* as impressões e os materiais (os Insumos) numa janela, daqui mesmo (19/11/2026) */}
      {materiais && <JanelaDeMateriais fechar={() => setMateriais(false)} />}
      {/* sem o título Comissões (Vitor, 19/11/2026: "remove esse titulo"): a página já se chama Financeiro */}
      {/* o mês, o Impressões e materiais e o Registrar comissão na mesma linha (19/11/2026) */}
      <MinhasComissoes m={m} extra={(
        <button type="button" className="btn btn-outline" onClick={() => setMateriais(true)} title="Registrar as impressões, pastas, envelopes e caixas de cada cliente, e ver os do mês">
          <Icone nome="impressora" />Impressões e materiais
        </button>
      )} />
      <h3 className="carteira-secao">Holerites e pagamentos</h3>
      <HoleritesEPagamentos m={m} />
    </div>
  );
}
