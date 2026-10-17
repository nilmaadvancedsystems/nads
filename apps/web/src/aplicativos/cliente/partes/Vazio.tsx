// O estado vazio da Área do Cliente (versão D, Vitor, 16/10/2026): o ícone num círculo suave, a frase curta e, quando faz
// sentido, o que fazer em seguida (um botão secundário).
import { Icone, type NomeIcone } from '@nads/ui';

export function Vazio({ icone, titulo, texto, acao }: { icone: NomeIcone; titulo: string; texto?: string; acao?: { rotulo: string; onClick: () => void } }) {
  return (
    <div className="cli-vazio">
      <span className="cli-vazio-ico" aria-hidden="true"><Icone nome={icone} width={20} height={20} /></span>
      <b>{titulo}</b>
      {texto && <p>{texto}</p>}
      {acao && <button type="button" className="btn" onClick={acao.onClick}>{acao.rotulo}</button>}
    </div>
  );
}
