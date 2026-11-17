// A área de soltar arquivos da Área do Cliente (Vitor, 16/10/2026): arrastar os arquivos para cima dela ou clicar para
// escolher (no celular abre a galeria e os arquivos). Peça do catálogo (Campos).
import { Icone } from '@nads/ui';
import { useId, useState, type DragEvent } from 'react';

export function AreaDeSoltar({ aceitar, dica, desabilitada, onArquivos, compacta, titulo }: { aceitar: string; dica: string; desabilitada?: boolean; onArquivos: (fs: File[]) => void; /** numa linha só (12/11/2026: a solicitação) */ compacta?: boolean; titulo?: string }) {
  const id = useId();
  const [sobre, setSobre] = useState(false);
  const soltou = (ev: DragEvent<HTMLLabelElement>) => {
    ev.preventDefault();
    setSobre(false);
    if (!desabilitada) onArquivos(Array.from(ev.dataTransfer.files));
  };
  return (
    <label htmlFor={id} className={'cli-soltar' + (compacta ? ' compacta' : '') + (sobre ? ' sobre' : '') + (desabilitada ? ' is-locked' : '')}
      onDragOver={ev => { ev.preventDefault(); if (!desabilitada) setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={soltou}>
      {compacta ? (
        <>
          <Icone nome="upload" width={18} height={18} />
          <span className="cli-soltar-txt"><b>{titulo ?? 'Enviar arquivos'}</b><small className="hint"><span className="cli-so-pc">Arraste para cá ou clique</span><span className="cli-so-toque">Toque para escolher</span> · {dica}</small></span>
        </>
      ) : (
        <>
          <Icone nome="upload" width={24} height={24} />
          {/* no telefone não dá para arrastar (13/11/2026): lá vira "Toque para escolher os arquivos" */}
          <b className="cli-so-pc">Arraste os arquivos para cá</b>
          <span className="cli-so-pc">ou clique para escolher no seu aparelho</span>
          <b className="cli-so-toque">Toque para escolher os arquivos</b>
          <span className="cli-so-toque">do celular: fotos, PDFs e outros</span>
          <small className="hint">{dica}</small>
        </>
      )}
      <input id={id} type="file" className="sr-only" multiple accept={aceitar} disabled={desabilitada}
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; if (fs.length) onArquivos(fs); }} />
    </label>
  );
}
