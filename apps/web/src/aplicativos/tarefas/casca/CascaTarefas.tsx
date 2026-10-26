// View da casca da Tarefas (a Casca comum do nads). telaInteira: sem a barra lateral e sem o título (o Drive).
import { Casca, Icone, MenuSuspenso } from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { LugarDasAcoes, useTrilhaDoTopo } from '../../../comum/topo';
import { useAvisoDeBloqueio } from '../../../comum/modoDesenvolvedor';
import { URL_DO_ADMIN, type IdAplicacao } from './navegacao';
import { useCascaTarefas } from './useCascaTarefas';
import { JanelaDeFeedback } from '../telas/feedback/JanelaDeFeedback';
import { ItemDosFeedbacks, JanelaDosFeedbacks } from '../telas/feedback/FeedbacksDoNads';
import { AvisoDeCertificados } from './AvisoDeCertificados';

/** O link discreto "Admin" no pé da gaveta ☰ (só o admin): abre o site do admin numa aba nova (os Feedbacks, o Painel do robô, o Uso e o Sistema moraram aqui; 22/10/2026). */
function ItemDoAdmin({ fechar }: { fechar: () => void }) {
  return (
    <button type="button" className="drawer-item" onClick={() => { fechar(); window.open(URL_DO_ADMIN, '_blank', 'noopener'); }}>
      <Icone nome="escudo" />Admin
    </button>
  );
}

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

export function CascaTarefas({ app, pagina, telaInteira, larga, children }: { app: IdAplicacao; pagina: string; telaInteira?: boolean; larga?: boolean; children: ReactNode }) {
  const vm = useCascaTarefas(app, pagina);
  const trilha = useTrilhaDoTopo();
  const [feedback, setFeedback] = useState(false);
  const [feedbacks, setFeedbacks] = useState(false);
  useAvisoDeBloqueio();
  return (
    <Casca sistema="Tarefas" temaNaGaveta={false} empresa={vm.empresa} versao={vm.versao} trilha={trilha} secoes={vm.secoes} paginas={vm.paginas} titulo={telaInteira ? '' : vm.titulo}
      lateral={telaInteira || vm.comAbas ? 'nenhuma' : undefined} larga={telaInteira || larga}
      acoes={telaInteira ? undefined : <LugarDasAcoes />} onSecao={vm.onSecao} onPagina={vm.onPagina} onInicio={vm.inicio} onAplicativos={vm.inicio}
      onEmpresa={vm.trocarPessoa} aplicativos={vm.aplicacoes} onAplicativo={vm.onAplicacao}
      topoDireita={<AvatarDaPessoa vm={vm} abrirFeedback={() => setFeedback(true)} />}
      // os Feedbacks de volta na gaveta, junto do Admin (Vitor, 26/10/2026: "coloque a aba de feedbacks no meu usuário")
      peDaGaveta={vm.admin ? fechar => <><ItemDosFeedbacks abrir={() => { fechar(); setFeedbacks(true); }} /><ItemDoAdmin fechar={fechar} /></> : undefined}>
      {feedback && <JanelaDeFeedback fechar={() => setFeedback(false)} />}
      {feedbacks && <JanelaDosFeedbacks fechar={() => setFeedbacks(false)} />}
      {/* os certificados vencidos ou vencendo (19/10/2026): só o admin */}
      <AvisoDeCertificados ligado={vm.admin} />
      {children}
    </Casca>
  );
}
