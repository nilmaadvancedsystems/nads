// O "?" ao lado do título de cada tela (15/11/2026: "melhora o tutorial", escolhido o "tutorial de cada tela"): mostra só
// os passos daquela tela, sem rodar o tutorial inteiro. A Área diz pelo contexto se a tela aberta tem passos.
import { Icone } from '@nads/ui';
import { createContext, useContext } from 'react';

/** abre o tutorial só da tela aberta; null quando ela não tem passos */
export const AjudaDaTelaContexto = createContext<(() => void) | null>(null);

export function AjudaDaTela() {
  const abrir = useContext(AjudaDaTelaContexto);
  if (!abrir) return null;
  return (
    <button type="button" className="cli-ajuda-tela" onClick={abrir} aria-label="Como usar esta tela" title="Como usar esta tela">
      <Icone nome="ajuda" width={18} height={18} />
    </button>
  );
}
