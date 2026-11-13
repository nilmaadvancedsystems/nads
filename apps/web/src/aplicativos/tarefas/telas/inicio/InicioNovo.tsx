// O Início novo (Vitor, 13/11/2026: "Quero fazer o tarefas nesse estilo, mas sem ser da interface, claro, só quero o
// posicionamento das coisas e tudo com a UI do nads"): a novidade 'inicio-novo' (comum/novidades.ts), só com o modo
// desenvolvedor ligado "até eu testar tudo". As abas (Painel, Minhas tarefas, Documentos e Notificações) e a saudação no
// lugar do título ficam na casca (useCascaTarefas): as abas na barra logo abaixo do cabeçalho ("Menu superior abaixo do
// cabeçalho!"). Aqui, a busca com as pílulas, o ⚡, o Delegar documentos e o Nova tarefa. A tarefa abre na janela de duas colunas (TarefaAbertaNova), por cima de qualquer aba.
import { Icone, useCarregando } from '@nads/ui';
import { useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AcoesDoTopo } from '../../../../comum/topo';
import { listaDaUrl } from './abasDoInicio';
import { TarefaAbertaNova } from '../delegador/TarefaAbertaNova';
import { useLembreteDoRecebimento } from '../delegador/useLembreteDoRecebimento';
import { BuscaDoInicio } from './partes/BuscaDoInicio';
import { ListaDoInicio } from './partes/ListaDoInicio';
import { NotificacoesDoInicio } from './partes/NotificacoesDoInicio';
import { PainelDoInicio } from './partes/PainelDoInicio';
import { BotoesDasNotificacoes } from './partes/ReunioesDoInicio';
import { DadosDeTesteDoInicio } from './DadosDeTesteDoInicio';
import { useInicio } from './useInicio';
import { useInicioNovo } from './useInicioNovo';

export function InicioNovo() {
  const vm = useInicioNovo();
  // o envio de documentos visto e sem confirmar: pede a confirmação de 10 em 10 minutos (13/11/2026)
  useLembreteDoRecebimento(vm.abrir);
  const mural = useInicio();
  // a lista das Tarefas (Minhas, Delegadas por mim, Concluídas) vem da barra lateral padrão da casca (?lista=)
  const [params] = useSearchParams();
  const lista = listaDaUrl(params.get('lista'));
  // nas Notificações, o Sênior, o Diretor e o Dono trocam o Delegar documentos e o Nova tarefa pelas reuniões
  const daSolicitacao = vm.aba === 'notificacoes' && vm.reunioesVm.papel !== 'participa';
  useCarregando(vm.carregando);
  // a tarefa aberta pergunta antes de ser largada (se mudou algo)
  const saida = useRef<((depois: () => void) => void) | null>(null);
  // os dois lugares da fileira do alto onde a lista põe os filtros (começo) e a planilha (antes dos botões)
  const [lugarDosFiltros, setLugarDosFiltros] = useState<HTMLElement | null>(null);
  const [lugarDoFim, setLugarDoFim] = useState<HTMLElement | null>(null);
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
      {/* a fileira na linha do "Bom dia" (o título da casca), em todas as abas (Vitor, 13/11/2026: "Na mesma linha do bom dia, em todo o inicio!") */}
      {/* tudo numa linha só, em todas as abas (Vitor, 13/11/2026: "Da pra deixar todos esses elementos em uma linha so? no inicio
          todo, em todas as paginas"): os filtros da lista (Prioridade, Quem delegou) entram no começo da fileira e a planilha
          antes dos botões, pelos dois lugares abaixo (a ListaDoInicio desenha neles) */}
      <AcoesDoTopo>
      <div className="ini-topo">
        <span ref={setLugarDosFiltros} className="ini-topo-lugar" />
        <span className="tarefas-barra-espaco" />
        {/* a busca na fileira dos botões, à esquerda do ⚡ (Vitor, 13/11/2026: "Coloca a barra de pesquisa nesse regiao") */}
        <BuscaDoInicio vm={vm} />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        {mural.dev && <DadosDeTesteDoInicio teste={mural.teste} />}
        {/* a planilha antes dos botões: o botão principal sempre por último (Vitor, 13/11/2026: "Deixa o excel antes do botao
            principal, sempre botao principal por ultimo") */}
        <span ref={setLugarDoFim} className="ini-topo-lugar" />
        {daSolicitacao ? <BotoesDasNotificacoes vm={vm.reunioesVm} escolher={vm.escolherComunicado} /> : (
          <>
            {/* o Delegar documentos no Painel e nos Documentos; nos Documentos, só ele (Vitor, 13/11/2026: "No documentos nova
                tarefa? cade o botao de documentos, deixa so ele"); nas Tarefas, só o Nova tarefa */}
            {(vm.aba === 'painel' || vm.aba === 'documentos') && <button type="button" className={'btn ' + (vm.aba === 'documentos' ? 'btn-primary' : 'btn-outline')} onClick={vm.pedirDocumentos} title="Delegar a alguém do escritório: quem recebe anexa os documentos e confirma"><Icone nome="clipe" />Delegar documentos</button>}
            {vm.aba !== 'documentos' && <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" />Nova tarefa</button>}
          </>
        )}
      </div>
      </AcoesDoTopo>
      {/* cada aba numa caixa com o nome dela (13/11/2026, "Tem negocio de documento delegado bugando o programa": na conta do
          Vitor, o bloco dos Documentos ficava na tela depois de trocar de aba, um a cada visita; aqui não se repetiu) */}
      <div ref={conteudo} key={vm.aba} className="ini-conteudo" data-aba={vm.aba}>
        {vm.aba === 'painel' && <PainelDoInicio vm={vm} />}
        {(vm.aba === 'tarefas' || vm.aba === 'documentos') && <ListaDoInicio key={vm.aba + lista} lugarDosFiltros={lugarDosFiltros} lugarDoFim={lugarDoFim} documentos={vm.aba === 'documentos'} lista={lista} busca={vm.busca} filtrar={vm.filtrarLista} abrir={vm.abrir} comFoto={vm.comFoto} />}
        {vm.aba === 'notificacoes' && <NotificacoesDoInicio vm={vm} mural={mural} podeMexer={vm.reunioesVm.papel === 'aprova'} />}
      </div>
      {vm.aberta && <TarefaAbertaNova key={vm.aberta} alvo={vm.aberta} voltar={vm.fechar} criada={vm.criada} saida={saida} />}
    </section>
  );
}
