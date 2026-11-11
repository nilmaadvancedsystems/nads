// O pé da gaveta (Vitor, 28/10/2026: "deixe dois ícones, um com o e-mail e outro com a engrenagem, somente com os ícones"):
// os Feedbacks (só o admin), as Ferramentas e as Configurações (quem tem), lado a lado. Igual em toda casca, também dentro da
// Tarefa (Vitor, 11/11/2026: "deixa o botão de configurações e feedbacks disponíveis mesmo eu estando dentro da tarefa").
import { BotaoIcone } from '@nads/ui';
import { ItemDosFeedbacks } from '../telas/feedback/FeedbacksDoNads';
import type { useCascaTarefas } from './useCascaTarefas';

type VmDaCasca = ReturnType<typeof useCascaTarefas>;

/** null quando a pessoa não tem nenhum dos ícones */
export function peDaGaveta(vm: VmDaCasca, abrirFeedbacks: () => void): ((fechar: () => void) => React.ReactNode) | undefined {
  if (!vm.admin && !vm.configuracoes) return undefined;
  return fechar => (
    <div className="drawer-icones">
      {vm.admin && <ItemDosFeedbacks abrir={() => { fechar(); abrirFeedbacks(); }} />}
      <BotaoIcone icone="wrench" titulo="Ferramentas" aria-pressed={vm.ferramentas.ativa}
        onClick={() => { fechar(); vm.onAplicacao('ferramentas'); }} />
      {vm.configuracoes && <BotaoIcone icone="settings" titulo="Configurações" aria-pressed={vm.configuracoes.ativa}
        onClick={() => { fechar(); vm.onAplicacao('cadastro'); }} />}
    </div>
  );
}
