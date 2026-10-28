// O correio do pé do menu ☰ (28/10/2026: "vai aparecer um correio ao lado da engrenagem que vai mostrar que tem uma tarefa
// para ela"): só o ícone da caixa de entrada (o envelope ✉ é dos Feedbacks do admin), para toda a equipe, com o número das
// tarefas em aberto da pessoa no cantinho quando tem alguma. O número também vai no título (o leitor de tela lê o título).
import { BotaoIcone } from '@nads/ui';

export function CorreioDeTarefas({ emAberto, titulo, abrir }: { emAberto: number; titulo: string; abrir: () => void }) {
  return (
    <span className="tdl-correio">
      <BotaoIcone icone="caixaEntrada" titulo={titulo} onClick={abrir} />
      {emAberto > 0 && <span className="tdl-correio-qtd" aria-hidden="true">{emAberto > 99 ? '99+' : emAberto}</span>}
    </span>
  );
}
