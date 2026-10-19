// Uma propriedade das janelas do Financeiro, como no Notion (19/10/2026): o ícone e o nome à esquerda, o valor ocupando o
// resto. O mesmo desenho da Nova nota (registro-prop).
import { Icone, type NomeIcone } from '@nads/ui';
import type { ReactNode } from 'react';

export function Propriedade({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <div className="registro-prop">
      <span className="registro-prop-nome"><Icone nome={icone} />{rotulo}</span>
      <div className="registro-prop-valor">{children}</div>
    </div>
  );
}
