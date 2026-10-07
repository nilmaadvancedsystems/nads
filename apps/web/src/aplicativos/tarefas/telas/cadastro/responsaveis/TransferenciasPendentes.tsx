// O cartão "Transferências para você responder" (Vitor, 07/10/2026): cada pedido em que você é o emitente ou o
// destinatário, com a empresa, o departamento, de quem para quem e o Aceitar / Recusar. Sem pedidos, não aparece.
import { Icone } from '@nads/ui';
import { useTransferenciasPendentes } from './useTransferenciasPendentes';

export function TransferenciasPendentes() {
  const vm = useTransferenciasPendentes();
  if (!vm.pedidos.length) return null;
  return (
    <section className="card resp-pendentes" aria-label="Transferências para você responder">
      <div className="resp-pendentes-topo">
        <Icone nome="repeat" />
        <b>Transferências para você responder</b>
        <span className="badge badge-neutral">{vm.pedidos.length}</span>
      </div>
      <ul className="resp-pendentes-lista">
        {vm.pedidos.map(p => (
          <li key={p.chave}>
            <div className="resp-pendentes-texto">
              <b>{p.empresa}</b>
              <span className="hint">
                {p.departamento}: {p.papel === 'emitente' ? 'sair de você para ' + p.para : 'passar de ' + p.de + ' para você'}
                {' · pedido por ' + (p.pedidoPor || '—') + (p.quando ? ' em ' + p.quando : '')}
              </span>
            </div>
            <span className="resp-transf-botoes">
              <button type="button" className="btn btn-primary" onClick={() => vm.responder(p.empresa, p.codigo, p.dep, true, p.faltaOutro)}><Icone nome="check" />Aceitar</button>
              <button type="button" className="btn" onClick={() => vm.responder(p.empresa, p.codigo, p.dep, false, p.faltaOutro)}>Recusar</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
