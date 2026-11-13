// O Início novo (Vitor, 13/11/2026: "Quero fazer o tarefas nesse estilo, mas sem ser da interface, claro, só quero o
// posicionamento das coisas e tudo com a UI do nads"): a novidade 'inicio-novo' (comum/novidades.ts), só com o modo
// desenvolvedor ligado "até eu testar tudo". As abas (Painel, Minhas tarefas, Documentos e Notificações) e a saudação no
// lugar do título ficam na casca (useCascaTarefas): as abas na barra logo abaixo do cabeçalho ("Menu superior abaixo do
// cabeçalho!"). Aqui, a busca com as pílulas, o ⚡, o Delegar documentos e o Nova tarefa. A tarefa abre na janela de duas colunas (TarefaAbertaNova), por cima de qualquer aba.
import { Icone, useCarregando } from '@nads/ui';
import { useLayoutEffect, useRef } from 'react';
import { TarefaAbertaNova } from '../delegador/TarefaAbertaNova';
import { BuscaDoInicio } from './partes/BuscaDoInicio';
import { ListaDoInicio } from './partes/ListaDoInicio';
import { NotificacoesDoInicio } from './partes/NotificacoesDoInicio';
import { PainelDoInicio } from './partes/PainelDoInicio';
import { BotoesDasNotificacoes } from './partes/SolicitacoesDoInicio';
import { useSolicitacoesDoInicio } from './useSolicitacoesDoInicio';
import { DadosDeTesteDoInicio } from './DadosDeTesteDoInicio';
import { useInicio } from './useInicio';
import { useInicioNovo } from './useInicioNovo';

export function InicioNovo() {
  const vm = useInicioNovo();
  const mural = useInicio();
  const solicitacoes = useSolicitacoesDoInicio();
  // nas Notificações, o Sênior, o Diretor e o Dono trocam o Delegar documentos e o Nova tarefa pelas solicitações de reunião
  const daSolicitacao = vm.aba === 'notificacoes' && solicitacoes.papel !== 'nenhum';
  useCarregando(vm.carregando);
  // a tarefa aberta pergunta antes de ser largada (se mudou algo)
  const saida = useRef<((depois: () => void) => void) | null>(null);
  // a proteção: trocou de aba, a caixa de outra aba que ficou na tela (sem o React saber dela) sai, com o aviso no console
  const conteudo = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const atual = conteudo.current;
    const pai = atual?.parentElement;
    if (!atual || !pai) return;
    // o que é do React aqui: o alto, a caixa da aba aberta e a janela da tarefa; o resto é sobra
    for (const el of Array.from(pai.children) as HTMLElement[]) {
      if (el === atual || el.classList.contains('ini-topo') || el.classList.contains('modal-overlay')) continue;
      console.warn('[nads] Início novo: sobrou a aba "' + (el.dataset.aba || '?') + '" na tela; tirei (aba aberta: ' + vm.aba + ')', el.hasAttribute('data-fantasma') ? '(fantasma do animador)' : '');
      el.remove();
    }
  }, [vm.aba]);
  return (
    <section className="ini-novo">
      <div className="ini-topo">
        <span className="tarefas-barra-espaco" />
        {/* a busca na fileira dos botões, à esquerda do ⚡ (Vitor, 13/11/2026: "Coloca a barra de pesquisa nesse regiao") */}
        <BuscaDoInicio vm={vm} />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        {mural.dev && <DadosDeTesteDoInicio teste={mural.teste} />}
        {daSolicitacao ? <BotoesDasNotificacoes vm={solicitacoes} /> : (
          <>
            <button type="button" className="btn btn-outline" onClick={vm.pedirDocumentos} title="Delegar a alguém do escritório: quem recebe anexa os documentos e confirma"><Icone nome="clipe" />Delegar documentos</button>
            <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" />Nova tarefa</button>
          </>
        )}
      </div>
      {/* cada aba numa caixa com o nome dela (13/11/2026, "Tem negocio de documento delegado bugando o programa": na conta do
          Vitor, o bloco dos Documentos ficava na tela depois de trocar de aba, um a cada visita; aqui não se repetiu) */}
      <div ref={conteudo} key={vm.aba} className="ini-conteudo" data-aba={vm.aba}>
        {vm.aba === 'painel' && <PainelDoInicio vm={vm} />}
        {(vm.aba === 'tarefas' || vm.aba === 'documentos') && <ListaDoInicio documentos={vm.aba === 'documentos'} abrir={vm.abrir} comFoto={vm.comFoto} />}
        {vm.aba === 'notificacoes' && <NotificacoesDoInicio vm={vm} mural={mural} />}
      </div>
      {vm.aberta && <TarefaAbertaNova key={vm.aberta} alvo={vm.aberta} voltar={vm.fechar} criada={vm.criada} saida={saida} />}
    </section>
  );
}
