// A área de soltar arquivos da Área do Cliente (Vitor, 16/10/2026): arrastar os arquivos para cima dela ou clicar para
// escolher (no celular abre a galeria e os arquivos). Peça do catálogo (Campos).
import { Icone } from '@nads/ui';
import { useId, useState, type DragEvent } from 'react';

export function AreaDeSoltar({ aceitar, dica, desabilitada, onArquivos }: { aceitar: string; dica: string; desabilitada?: boolean; onArquivos: (fs: File[]) => void }) {
  const id = useId();
  const [sobre, setSobre] = useState(false);
  const soltou = (ev: DragEvent<HTMLLabelElement>) => {
    ev.preventDefault();
    setSobre(false);
    if (!desabilitada) onArquivos(Array.from(ev.dataTransfer.files));
  };
  return (
    <label htmlFor={id} className={'cli-soltar' + (sobre ? ' sobre' : '') + (desabilitada ? ' is-locked' : '')}
      onDragOver={ev => { ev.preventDefault(); if (!desabilitada) setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={soltou}>
      <span className="cli-soltar-ico" aria-hidden="true"><Icone nome="upload" width={24} height={24} /></span>
      <b>Arraste os arquivos para cá</b>
      <span>ou clique para escolher no seu aparelho</span>
      <small className="hint">{dica}</small>
      <input id={id} type="file" className="sr-only" multiple accept={aceitar} disabled={desabilitada}
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; if (fs.length) onArquivos(fs); }} />
    </label>
  );
}
