// Os Documentos da Área do Cliente (Vitor, 16/10/2026): o que o escritório deixou para baixar (com a busca) e, embaixo, o
// enviar um documento ao escritório.
import { Enviar } from './Enviar';
import { useDocumentos } from './useDocumentos';
import type { DaCasca } from './useAreaCliente';

export function Documentos(props: DaCasca) {
  const vm = useDocumentos(props);
  return (
    <>
      <h2 className="cli-secao">Do escritório para você</h2>
      {vm.total > 6 && <input type="text" className="cli-busca" value={vm.busca} onChange={e => vm.mudarBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar documento" />}
      {vm.docs.length ? (
        <ul>
          {vm.docs.map(d => (
            <li key={d.id} className="cli-linha">
              <div className="cli-linha-txt">
                <b>{d.nome}</b>
                <p className={'hint' + (d.novo ? ' cli-novo' : '')}>{vm.sobre(d)}</p>
              </div>
              <button type="button" className="btn" disabled={vm.baixando === d.id} onClick={() => void vm.baixar(d.id)}>Baixar</button>
            </li>
          ))}
        </ul>
      ) : <p className="cli-vazio">{vm.total ? 'Nenhum documento com esse nome.' : 'O escritório ainda não deixou documentos aqui.'}</p>}

      <h2 className="cli-secao">Enviar ao escritório</h2>
      <Enviar {...props} />
    </>
  );
}
