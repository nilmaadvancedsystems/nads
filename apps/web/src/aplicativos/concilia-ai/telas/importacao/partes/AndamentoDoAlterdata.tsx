// O andamento do balancete que o robô gera no Alterdata (Vitor, 14/10/2026): "Na fila…", os passos do robô, o erro dele,
// e o Cancelar enquanto dá tempo. Peça do catálogo (Cartões › Andamento do robô do Alterdata).
import { conferencia as c } from '@nads/core';
import { Icone } from '@nads/ui';
import type { PedidoAlterdata } from '../../../dados/alterdata';

export function AndamentoDoAlterdata({ pedido, onCancelar, onFechar }: { pedido: PedidoAlterdata; onCancelar: () => void; onFechar: () => void }) {
  const t = c.textoDoAndamento(pedido);
  return (
    <div className={'card alt-andamento alt-' + t.tom} role="status" aria-live="polite">
      <div className="alt-topo">
        {t.tom === 'andando' ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome={t.tom === 'ok' ? 'checkCircle' : 'alert'} width={16} height={16} />}
        <div className="alt-texto"><b>{t.titulo}</b>{t.detalhe && <span className="hint"> · {t.detalhe}</span>}</div>
        {t.podeCancelar && <button type="button" className="btn btn-ghost" onClick={onCancelar}><Icone nome="x" width={16} height={16} />Cancelar</button>}
        {t.tom === 'erro' && <button type="button" className="btn btn-ghost" onClick={onFechar}><Icone nome="x" width={16} height={16} />Fechar</button>}
      </div>
      {pedido.passos.length > 0 && (
        <ol className="alt-passos">
          {pedido.passos.map(p => <li key={p.n}><span className="alt-passo-n" aria-hidden="true">{p.n}</span>{p.nome}</li>)}
        </ol>
      )}
    </div>
  );
}
