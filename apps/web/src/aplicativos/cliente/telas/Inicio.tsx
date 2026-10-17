// A Visão geral da Área do Cliente (Vitor, 16/10/2026): o que pagar primeiro e, embaixo, os avisos que pedem uma ação.
// Sem números, sem cartões, sem saudação.
import { LinhaDeGuia } from '../partes/LinhaDeGuia';
import { useInicio } from './useInicio';
import type { DaCasca } from './useAreaCliente';

export function Inicio(props: DaCasca) {
  const vm = useInicio(props);
  return (
    <>
      <h2 className="cli-secao">Para pagar</h2>
      {vm.guias.length ? (
        <ul>
          {vm.guias.map(g => <LinhaDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} ocupado={vm.baixando === g.id} onBaixar={id => void vm.baixar(id)} onCopiar={vm.copiarCodigo} />)}
        </ul>
      ) : <p className="cli-vazio">Nada para pagar agora.</p>}
      {vm.maisGuias && <button type="button" className="btn btn-ghost cli-mais" onClick={() => vm.irPara('guias')}>Ver todas as guias</button>}

      {vm.avisos.length > 0 && (
        <>
          <h2 className="cli-secao">Avisos</h2>
          <ul>
            {vm.avisos.map(a => (
              <li key={a.id} className="cli-linha">
                <div className="cli-linha-txt">{a.texto}</div>
                <button type="button" className="btn btn-ghost" onClick={() => vm.irPara(a.ir)}>Abrir</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
