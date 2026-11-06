// A etapa Cartões (o cartão de crédito empresarial; Vitor, 06/11/2026: a ferramenta saiu do Extratudo e fica só aqui, na
// etapa dela, depois da Conferência fiscal): a fatura em PDF quebrada no razão do cartão, no período da Tarefa.
import { Compras } from '../../../../etapas/cartoes/telas/compras/Compras';
import { ComExtrator } from '../../../../etapas/Provedores';
import { useEtapaAberta } from '../contexto';

export function CartoesDaEtapa() {
  const e = useEtapaAberta();
  return (
    <ComExtrator>
      <section>
        <header className="topbar"><div><h2 className="page-title">Fatura do cartão empresarial</h2></div></header>
        <Compras empresa={{ nome: e.nome, codigo: e.codigo, regime: '' }} />
      </section>
    </ComExtrator>
  );
}
