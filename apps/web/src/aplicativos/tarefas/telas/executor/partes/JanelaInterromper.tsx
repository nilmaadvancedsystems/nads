// A janelinha do "Interromper": por que a etapa vai parar (as objeções comuns dela ou "outro
// motivo") e uma observação. O motivo é o que alimenta a análise do que trava o trabalho.
import type { tarefas } from '@nads/core';
import { useState } from 'react';

export function JanelaInterromper({ etapa, onInterromper, onCancelar }: {
  etapa: tarefas.Etapa;
  onInterromper: (objecao: string, observacao: string) => void;
  onCancelar: () => void;
}) {
  const [objecao, setObjecao] = useState('');
  const [obs, setObs] = useState('');
  const podeInterromper = !!objecao && (objecao !== 'outro' || !!obs.trim());
  return (
    <div className="modal-overlay" role="presentation" onClick={onCancelar}>
      <div className="modal tarefas-janela" role="dialog" aria-modal="true" aria-labelledby="tituloInterromper" onClick={e => e.stopPropagation()}>
        <h3 id="tituloInterromper">Por que interromper?</h3>
        <p className="hint" style={{ marginTop: 0 }}>{etapa.nome}</p>
        <div className="tarefas-opcoes" role="radiogroup">
          {[...etapa.objecoes.filter(o => o.solucao.tipo !== 'nao-se-aplica'), { id: 'outro', texto: 'Outro motivo' }].map(o => (
            <label key={o.id} className={'tarefas-opcao' + (objecao === o.id ? ' on' : '')}>
              <input type="radio" name="objecao" value={o.id} checked={objecao === o.id} onChange={() => setObjecao(o.id)} />
              <span>{o.texto}</span>
            </label>
          ))}
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span className="hint">Observação{objecao === 'outro' ? ' (conte o motivo)' : ' (opcional)'}</span>
          <textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancelar}>Voltar</button>
          <button type="button" className="btn btn-danger" disabled={!podeInterromper} onClick={() => onInterromper(objecao, obs)}>Interromper</button>
        </div>
      </div>
    </div>
  );
}
