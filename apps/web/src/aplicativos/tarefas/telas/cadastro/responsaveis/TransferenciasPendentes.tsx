// O cartão "Trocas para você responder" (Vitor, 07/10/2026): cada troca com a outra pessoa, as empresas que saem e as que
// entram, e o Aceitar / Recusar. Sem pedidos, não aparece.
import { Icone } from '@nads/ui';
import { useTransferenciasPendentes } from './useTransferenciasPendentes';

export function TransferenciasPendentes() {
  const vm = useTransferenciasPendentes();
  if (!vm.trocas.length) return null;
  return (
    <section className="card resp-pendentes" aria-label="Trocas para você responder">
      <div className="resp-pendentes-topo">
        <Icone nome="repeat" />
        <b>Trocas para você responder</b>
        <span className="badge badge-neutral">{vm.trocas.length}</span>
      </div>
      <ul className="resp-pendentes-lista">
        {vm.trocas.map(t => (
          <li key={t.chave}>
            <div className="resp-pendentes-texto">
              <b>Com {t.outro}</b>
              {t.saem.length > 0 && <span><span className="fraco">Saem: </span>{t.saem.join(', ')}</span>}
              {t.entram.length > 0 && <span><span className="fraco">Entram: </span>{t.entram.join(', ')}</span>}
            </div>
            <span className="resp-transf-botoes">
              <button type="button" className="btn btn-primary" onClick={() => t.responder(true)}><Icone nome="check" />Aceitar</button>
              <button type="button" className="btn" onClick={() => t.responder(false)}>Recusar</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
