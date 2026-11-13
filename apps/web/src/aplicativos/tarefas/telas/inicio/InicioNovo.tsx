// O Início novo (Vitor, 13/11/2026: "Quero fazer o tarefas nesse estilo, mas sem ser da interface, claro, só quero o
// posicionamento das coisas e tudo com a UI do nads"): a novidade 'inicio-novo' (comum/novidades.ts), só com o modo
// desenvolvedor ligado "até eu testar tudo". As abas (Painel, Minhas tarefas, Documentos e Notificações) e a saudação no
// lugar do título ficam na casca (useCascaTarefas): as abas na barra logo abaixo do cabeçalho ("Menu superior abaixo do
// cabeçalho!"). Aqui, a busca com as pílulas, o ⚡, o Delegar documentos e o Nova tarefa. A tarefa abre na janela de duas colunas (TarefaAbertaNova), por cima de qualquer aba.
import { Icone, useCarregando } from '@nads/ui';
import { useRef } from 'react';
import { TarefaAbertaNova } from '../delegador/TarefaAbertaNova';
import { BuscaDoInicio } from './partes/BuscaDoInicio';
import { ListaDoInicio } from './partes/ListaDoInicio';
import { NotificacoesDoInicio } from './partes/NotificacoesDoInicio';
import { PainelDoInicio } from './partes/PainelDoInicio';
import { DadosDeTesteDoInicio } from './DadosDeTesteDoInicio';
import { useInicio } from './useInicio';
import { useInicioNovo } from './useInicioNovo';

export function InicioNovo() {
  const vm = useInicioNovo();
  const mural = useInicio();
  useCarregando(vm.carregando);
  // a tarefa aberta pergunta antes de ser largada (se mudou algo)
  const saida = useRef<((depois: () => void) => void) | null>(null);
  return (
    <section className="ini-novo">
      <div className="ini-topo">
        <BuscaDoInicio vm={vm} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        {mural.dev && <DadosDeTesteDoInicio teste={mural.teste} />}
        <button type="button" className="btn btn-outline" onClick={vm.pedirDocumentos} title="Delegar a alguém do escritório: quem recebe anexa os documentos e confirma"><Icone nome="clipe" />Delegar documentos</button>
        <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" />Nova tarefa</button>
      </div>
      {vm.aba === 'painel' && <PainelDoInicio vm={vm} />}
      {/* uma lista só, trocada pela aba (13/11/2026: "Nenhum documento delegado… ta aparecendo em tudo") */}
      {(vm.aba === 'tarefas' || vm.aba === 'documentos') && <ListaDoInicio key={vm.aba} documentos={vm.aba === 'documentos'} abrir={vm.abrir} comFoto={vm.comFoto} />}
      {vm.aba === 'notificacoes' && <NotificacoesDoInicio vm={vm} mural={mural} />}
      {vm.aberta && <TarefaAbertaNova key={vm.aberta} alvo={vm.aberta} voltar={vm.fechar} criada={vm.criada} saida={saida} />}
    </section>
  );
}
