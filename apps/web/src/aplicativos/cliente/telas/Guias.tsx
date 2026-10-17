// Guias e obrigações da Área do Cliente (Vitor, 16/10/2026): as guias para pagar, com o mês de referência como subtítulo de
// cada grupo, e embaixo os vencimentos do mês (o que o escritório já fez e o que falta).
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { Agenda } from './Agenda';
import { useGuias } from './useGuias';
import type { DaCasca } from './useAreaCliente';

export function Guias(props: DaCasca) {
  const vm = useGuias(props);
  return (
    <>
      {vm.vazio ? <p className="cli-vazio">Nenhuma guia para pagar agora. Quando o escritório gerar, ela aparece aqui.</p> : vm.meses.map(m => (
        <section key={m.competencia}>
          <h2 className="cli-secao">Guias de {m.rotulo.toLowerCase()}</h2>
          <ul>
            {m.guias.map(g => <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} ocupado={vm.baixando === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} />)}
          </ul>
        </section>
      ))}
      <Agenda area={props.area} hoje={props.hoje} />
    </>
  );
}
