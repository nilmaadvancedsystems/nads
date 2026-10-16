// A aba Guias da Área do Cliente (Vitor, 16/10/2026): as guias separadas por mês de referência, as mais novas primeiro.
import { formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { CartaoDeGuia } from '../partes/CartaoDeGuia';
import { useGuias } from './useGuias';
import type { DaCasca } from './useAreaCliente';

export function Guias(props: DaCasca) {
  const vm = useGuias(props);
  if (vm.vazio) {
    return (
      <div className="gh-blank">
        <Icone nome="recibo" width={32} height={32} />
        <h4>Nenhuma guia por enquanto</h4>
        <p>Quando o escritório gerar uma guia, ela aparece aqui sozinha.</p>
      </div>
    );
  }
  return (
    <>
      {vm.meses.map(m => (
        <section key={m.competencia} className="card">
          <h3>Referente a {formatos.rot(m.competencia)}</h3>
          <div className="cli-grade">
            {m.guias.map(g => <CartaoDeGuia key={g.id} guia={g} ocupado={vm.baixando === g.id} onBaixar={vm.baixar} />)}
          </div>
        </section>
      ))}
    </>
  );
}
