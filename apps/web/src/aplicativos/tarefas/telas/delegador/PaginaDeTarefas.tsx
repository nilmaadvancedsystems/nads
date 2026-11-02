// O módulo Minhas tarefas (30/10/2026: "quero que o minhas tarefas vire um modulo do escritorio"): a Central de tarefas
// numa página do Escritório, no lugar da janela. As abas (Minhas tarefas, Delegadas por mim, Concluídas) são as páginas da
// barra lateral; no corpo, a mesma lista da Central (Nova tarefa, a busca, o status, o Exportar e a tabela) e, ao clicar
// numa linha, a tarefa no lugar da lista, com "‹ Voltar".
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { ListaDaCentral } from './CentralDeTarefas';
import { TarefaAberta } from './TarefaAberta';
import { useCentralDeTarefas, type AbaDaCentral } from './useCentralDeTarefas';

export function PaginaDeTarefas({ aba }: { aba: AbaDaCentral }) {
  const vm = useCentralDeTarefas(aba);
  const navegar = useNavigate();
  // a tarefa aberta pergunta antes de ser largada (o Voltar dela); aqui não há janela para fechar
  const saida = useRef<((depois: () => void) => void) | null>(null);
  // criou: vai para a página onde a tarefa ficou (a sua, ou as delegadas por você)
  const criada = (paraMim: boolean) => { vm.criada(paraMim); navegar(caminhoDaPagina('minhas-tarefas', paraMim ? 'minhas' : 'delegadas')); };
  return (
    <section className="tdl-pagina">
      {vm.aberta ? <TarefaAberta key={vm.aberta} alvo={vm.aberta} voltar={vm.voltar} criada={criada} saida={saida} /> : <ListaDaCentral vm={vm} semTitulo />}
    </section>
  );
}
