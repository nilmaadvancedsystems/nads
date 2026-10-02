// A janelinha do "Interromper": por que a etapa vai parar (as objeções comuns dela ou "outro motivo") e uma observação.
// O motivo é o que alimenta a análise do que trava o trabalho. Desenho (Vitor, 02/10/2026: "melhore, tá muito feio"):
// o das outras janelas (centro, × no canto), cada motivo um cartão que se escolhe inteiro e a observação embaixo.
import type { tarefas } from '@nads/core';
import { classeDaJanela, Icone } from '@nads/ui';
import { useState } from 'react';

export function JanelaInterromper({ etapa, onInterromper, onCancelar }: {
  etapa: tarefas.Etapa;
  onInterromper: (objecao: string, observacao: string) => void;
  onCancelar: () => void;
}) {
  const [objecao, setObjecao] = useState('');
  const [obs, setObs] = useState('');
  const podeInterromper = !!objecao && (objecao !== 'outro' || !!obs.trim());
  const motivos = [...etapa.objecoes.filter(o => o.solucao.tipo !== 'nao-se-aplica'), { id: 'outro', texto: 'Outro motivo' }];
  return (
    <div className="modal-overlay" role="presentation" onClick={onCancelar}>
      <div className={classeDaJanela({}) + ' interromper-janela'} role="dialog" aria-modal="true" aria-labelledby="tituloInterromper" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" onClick={onCancelar}><Icone nome="x" /></button>
        <h3 id="tituloInterromper">Por que interromper?</h3>
        <p className="interromper-etapa">{etapa.nome}</p>
        <div className="interromper-opcoes" role="radiogroup" aria-label="Motivo">
          {motivos.map(o => (
            <label key={o.id} className={'interromper-opcao' + (objecao === o.id ? ' on' : '')}>
              <input type="radio" name="objecao" value={o.id} checked={objecao === o.id} onChange={() => setObjecao(o.id)} />
              <span>{o.texto}</span>
            </label>
          ))}
        </div>
        <label className="interromper-obs">
          <span>Observação{objecao === 'outro' ? ' (conte o motivo)' : ' (opcional)'}</span>
          <textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder={objecao === 'outro' ? 'O que aconteceu?' : ''} />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-danger" disabled={!podeInterromper} onClick={() => onInterromper(objecao, obs)}>Interromper</button>
        </div>
      </div>
    </div>
  );
}
