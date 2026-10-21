// O valor que se edita na própria linha (19/10/2026, Honorários): um campo discreto que grava ao sair (blur) ou no Enter e
// volta ao que estava no Esc. Sem valor (0), mostra "definir valor" no lugar.
import { useState } from 'react';

export function ValorEditavel({ valor, aoSalvar, rotulo }: { valor: number; aoSalvar: (texto: string) => void; rotulo: string }) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const noCampo = valor > 0 ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const gravar = () => {
    if (rascunho !== null && rascunho.trim() !== noCampo) aoSalvar(rascunho);
    setRascunho(null);
  };
  return (
    <input type="text" inputMode="decimal" className={'fin-valor-edita num' + (valor > 0 ? '' : ' fin-valor-edita-vazio')} aria-label={rotulo}
      value={rascunho ?? noCampo} placeholder="definir valor"
      onChange={e => setRascunho(e.target.value)} onBlur={gravar}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { setRascunho(null); e.currentTarget.blur(); } }} />
  );
}
