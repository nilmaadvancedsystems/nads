// A faixa grudada no bloco que abre e fecha (▸ Título  N): os Lançamentos e as Pendências da Importação do banco e, no
// Caixa da Tarefas, os Lançamentos e os Pontos de atenção (o número em laranja quando é aviso).
import { Icone } from '@nads/ui';
import { useState, type ReactNode } from 'react';

export function FaixaQueAbre({ titulo, qtd, aviso, children }: { titulo: string; qtd: number; aviso?: boolean; children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className={'imp-faixa' + (aviso ? ' aviso' : '') + (aberta ? ' aberta' : '')}>
      <button type="button" className="imp-faixa-barra" aria-expanded={aberta} onClick={() => setAberta(a => !a)}>
        <Icone nome="caretDown" className="imp-faixa-seta" />
        <b>{titulo}</b>
        <span className="imp-faixa-qtd">{qtd}</span>
      </button>
      {aberta && <div className="imp-faixa-corpo">{children}</div>}
    </div>
  );
}
