// View da casca da Tarefas (a Casca comum do nads). telaInteira: sem a barra lateral e sem o título (o Drive).
import { Casca, MenuSuspenso, type SecaoCasca } from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { LugarDasAcoes, useTrilhaDoTopo } from '../../../comum/topo';
import { useAvisoDeBloqueio } from '../../../comum/modoDesenvolvedor';
import type { IdAplicacao } from './navegacao';
import { useCascaTarefas } from './useCascaTarefas';
import { JanelaDeFeedback } from '../telas/feedback/JanelaDeFeedback';
import { ItemDosFeedbacks, JanelaDosFeedbacks } from '../telas/feedback/FeedbacksDoNads';

/** O avatar no canto do cabeçalho (como o do Entregas e o do GitHub): as iniciais; aberto, a Minha página e sair. */
function AvatarDaPessoa({ vm, abrirFeedback }: { vm: ReturnType<typeof useCascaTarefas>; abrirFeedback: () => void }) {
  return (
    <MenuSuspenso rotulo={vm.perfil.foto ? <img className="gh-avatar-foto" src={vm.perfil.foto} alt="" /> : vm.perfil.iniciais} className={'gh-avatar' + (vm.naPessoal ? ' ativo' : '')} dica={vm.perfil.nome} titulo={vm.perfil.nome} direita animado
      itens={[
        { rotulo: 'Minha conta', icone: 'usuario', onClick: () => vm.abrirPessoal('conta') },
        // o print e o que melhorar (Vitor, 07/10/2026)
        { rotulo: 'Enviar feedback', icone: 'envelope', onClick: abrirFeedback },
        // só ver tudo, sem alterar nada (Vitor, 06/10/2026)
        { rotulo: 'Modo desenvolvedor', icone: 'settings', marcado: vm.dev, onClick: () => vm.setDev(!vm.dev) },
        'separador',
        { rotulo: vm.perfil.sair, icone: 'logOut', onClick: vm.trocarPessoa },
      ]} />
  );
}

/**
 * As páginas de uma empresa na barra lateral, embaixo das da aplicação (o LCDPR da empresa 62, 16/10/2026: "coloque o
 * lcdpr como parte da empresa 62 de carlos lucas apenas"): com elas, a ativa é a da empresa; o título é o da página dela.
 */
export interface LateralDaEmpresa { secoes: SecaoCasca[]; onSecao: (id: string) => void; titulo?: string }

export function CascaTarefas({ app, pagina, telaInteira, larga, daEmpresa, children }: { app: IdAplicacao; pagina: string; telaInteira?: boolean; larga?: boolean; daEmpresa?: LateralDaEmpresa | null; children: ReactNode }) {
  const vm0 = useCascaTarefas(app, pagina);
  const vm = !daEmpresa ? vm0 : {
    ...vm0, titulo: daEmpresa.titulo ?? vm0.titulo,
    secoes: [...vm0.secoes.map(s => ({ ...s, ativa: false })), ...daEmpresa.secoes],
    onSecao: (id: string) => (daEmpresa.secoes.some(s => s.id === id) ? daEmpresa.onSecao(id) : vm0.onSecao(id)),
  };
  const trilha = useTrilhaDoTopo();
  const [feedback, setFeedback] = useState(false);
  const [feedbacks, setFeedbacks] = useState(false);
  useAvisoDeBloqueio();
  return (
    <Casca sistema="Tarefas" temaNaGaveta={false} empresa={vm.empresa} versao={vm.versao} trilha={trilha} secoes={vm.secoes} paginas={vm.paginas} titulo={telaInteira ? '' : vm.titulo}
      lateral={telaInteira || vm.comAbas ? 'nenhuma' : undefined} larga={telaInteira || larga}
      acoes={telaInteira ? undefined : <LugarDasAcoes />} onSecao={vm.onSecao} onPagina={vm.onPagina} onInicio={vm.inicio} onAplicativos={vm.inicio}
      onEmpresa={vm.trocarPessoa} aplicativos={vm.aplicacoes} onAplicativo={vm.onAplicacao}
      topoDireita={<AvatarDaPessoa vm={vm0} abrirFeedback={() => setFeedback(true)} />}
      peDaGaveta={vm.admin ? fechar => <ItemDosFeedbacks abrir={() => { fechar(); setFeedbacks(true); }} /> : undefined}>
      {feedback && <JanelaDeFeedback fechar={() => setFeedback(false)} />}
      {feedbacks && <JanelaDosFeedbacks fechar={() => setFeedbacks(false)} />}
      {children}
    </Casca>
  );
}
