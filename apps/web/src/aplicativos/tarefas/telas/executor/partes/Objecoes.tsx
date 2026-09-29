// As objeções comuns da etapa, no meio da tela, cada uma com o que a tela oferece para resolver:
// pedir ao cliente (Contato), buscar no Drive, uma orientação, ou "não se aplica".
import type { tarefas } from '@nads/core';
import { Icone } from '@nads/ui';
import { useState } from 'react';

export function Objecoes({ etapa, destacar, onResolver }: { etapa: tarefas.Etapa; destacar: boolean; onResolver: (o: tarefas.Objecao) => void }) {
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <aside className={'executor-objecoes' + (destacar ? ' destaque' : '')} aria-label="Se não der para concluir">
      <h3>Se não der para concluir</h3>
      <ul>
        {etapa.objecoes.map(o => (
          <li key={o.id}>
            <p className="executor-objecao-texto">{o.texto}</p>
            {o.solucao.tipo === 'orientacao' ? (
              <>
                <button type="button" className="link-btn" aria-expanded={aberta === o.id} onClick={() => setAberta(aberta === o.id ? null : o.id)}>
                  {o.solucao.rotulo}
                </button>
                {aberta === o.id && <p className="hint">{o.solucao.texto}</p>}
              </>
            ) : (
              <button type="button" className="btn btn-sm btn-outline" onClick={() => onResolver(o)}>
                <Icone nome={o.solucao.tipo === 'contato' ? 'link' : o.solucao.tipo === 'drive' ? 'fileDown' : 'checkCircle'} />
                {o.solucao.rotulo}
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
