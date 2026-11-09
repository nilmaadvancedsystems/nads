// As tarefas delegadas no Início (09/11/2026; antes, o módulo Minhas tarefas do Escritório): a Central de tarefas numa
// página, no lugar da janela. As abas (Minhas tarefas, Delegadas por mim, Concluídas) são as páginas da
// barra lateral; no corpo, a mesma lista da Central (no jeito do Contas a pagar: os filtros, os números, a busca e a tabela) e, ao clicar
// numa linha, a tarefa numa janela por cima da lista (09/11/2026: "em uma popup, ao invés de abrir uma nova tela").
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
  const criada = (paraMim: boolean) => { vm.criada(paraMim); navegar(caminhoDaPagina('inicio', paraMim ? 'minhas' : 'delegadas')); };
  return (
    <section className="tdl-pagina">
      <ListaDaCentral vm={vm} semTitulo />
      {vm.aberta && <TarefaAberta key={vm.aberta} alvo={vm.aberta} voltar={vm.voltar} criada={criada} saida={saida} />}
    </section>
  );
}
