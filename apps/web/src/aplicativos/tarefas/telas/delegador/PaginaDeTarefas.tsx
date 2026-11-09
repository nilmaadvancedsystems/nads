// As tarefas delegadas no Início (09/11/2026; antes, o módulo Minhas tarefas do Escritório): a Central de tarefas numa
// página, no lugar da janela. As abas (Minhas tarefas, Delegadas por mim, Concluídas) ficam em cima da lista, na própria
// tela do Início (Vitor, 09/11/2026: "coloque o que está no menu lateral em uma tela só"); no corpo, a mesma lista da Central
// (no jeito do Contas a pagar: os filtros, os números, a busca e a tabela) e, ao clicar numa linha, a tarefa numa janela por
// cima da lista (09/11/2026: "em uma popup, ao invés de abrir uma nova tela").
import { Icone, type NomeIcone } from '@nads/ui';
import { useRef } from 'react';
import { ListaDaCentral } from './CentralDeTarefas';
import { TarefaAberta } from './TarefaAberta';
import { useCentralDeTarefas, type AbaDaCentral } from './useCentralDeTarefas';

const ICONE_DA_ABA: Record<AbaDaCentral, NomeIcone> = { minhas: 'caixaEntrada', delegadas: 'aviao', concluidas: 'checkCircle' };

export function PaginaDeTarefas({ aba }: { aba: AbaDaCentral }) {
  const vm = useCentralDeTarefas(aba);
  // a tarefa aberta pergunta antes de ser largada (o Voltar dela); aqui não há janela para fechar
  const saida = useRef<((depois: () => void) => void) | null>(null);
  return (
    <section className="tdl-pagina">
      <nav className="menu imp-abas" aria-label="Tarefas">
        {vm.abas.map(a => (
          <button key={a.id} type="button" className={'menu-item' + (a.ativa ? ' active' : '')} aria-current={a.ativa ? 'page' : undefined} onClick={() => vm.mudarAba(a.id)}>
            <Icone nome={ICONE_DA_ABA[a.id]} /><span>{a.rotulo}</span>
            {a.qtd > 0 && <span className="tdl-aba-qtd" aria-label={a.qtd + (a.qtd === 1 ? ' tarefa' : ' tarefas')}>{a.qtd}</span>}
          </button>
        ))}
      </nav>
      <ListaDaCentral vm={vm} semTitulo />
      {vm.aberta && <TarefaAberta key={vm.aberta} alvo={vm.aberta} voltar={vm.voltar} criada={vm.criada} saida={saida} />}
    </section>
  );
}
