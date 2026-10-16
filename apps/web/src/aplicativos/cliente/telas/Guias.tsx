// A aba Guias da Área do Cliente (Vitor, 16/10/2026): as guias separadas por mês de referência, as mais novas primeiro.
// Cada mês tem o cabeçalho do protótipo (bolinha, rótulo em caixa alta, contador e o fio vermelho) e os cartões embaixo.
import { formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { CartaoDeGuia } from '../partes/CartaoDeGuia';
import { useGuias } from './useGuias';
import type { DaCasca } from './useAreaCliente';

export function Guias(props: DaCasca) {
  const vm = useGuias(props);
  if (vm.vazio) {
    return (
      <div className="cli-cartao cli-vazio">
        <span className="cli-vazio-ico"><Icone nome="recibo" width={26} height={26} /></span>
        <h3>Nenhuma guia por enquanto</h3>
        <p>Quando o escritório gerar uma guia, ela aparece aqui sozinha.</p>
      </div>
    );
  }
  return (
    <>
      {vm.meses.map(m => (
        <section key={m.competencia} className="cli-grupo">
          <div className="cli-grupo-topo">
            <h2>Referente a {formatos.rot(m.competencia)}</h2>
            <span className="cli-grupo-conta">{m.guias.length}</span>
          </div>
          <div className="cli-grade">
            {m.guias.map(g => <CartaoDeGuia key={g.id} guia={g} ocupado={vm.baixando === g.id} onBaixar={vm.baixar} />)}
          </div>
        </section>
      ))}
    </>
  );
}
