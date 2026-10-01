// Prévia da abertura (/tarefas/previa/abertura): a animação da logo inteira, sem precisar esperar o app carregar,
// com "Ver de novo" (remonta a abertura e a linha do tempo recomeça). Não pede login: só mostra a animação.
import { AberturaN } from '@nads/ui';
import { useState } from 'react';

export function PreviaAbertura() {
  const [vez, setVez] = useState(0);
  const [vidro, setVidro] = useState(false);
  return (
    <>
      <AberturaN key={vez + (vidro ? '-v' : '')} vidro={vidro} />
      <div className="previa-abertura-botoes">
        <button type="button" className="btn btn-primary" onClick={() => setVez(v => v + 1)}>Ver de novo</button>
        <button type="button" className="btn btn-outline" onClick={() => { setVidro(x => !x); setVez(v => v + 1); }}>{vidro ? 'Abertura do app' : 'Carregando uma área (vidro)'}</button>
      </div>
    </>
  );
}
