// A etapa Conciliação caixa (Vitor, 10/11/2026: "deixa no check separado"): o que saiu do caixa e também do banco, o mesmo valor, até 5 dias.
import { TabelaCaixaNoBanco } from './CaixaNoBanco';
import { useConciliacaoCaixa } from './useConciliacaoCaixa';

export function ConciliacaoCaixa() {
  const vm = useConciliacaoCaixa();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Conciliação caixa</h2></div></header>
      <div className="card">
        <h3>Pago pelo banco e lançado no caixa <span className="gh-counter">{vm.pendentes}</span></h3>
        <div className="imp-mov-caixa"><TabelaCaixaNoBanco vm={vm} /></div>
      </div>
    </section>
  );
}
