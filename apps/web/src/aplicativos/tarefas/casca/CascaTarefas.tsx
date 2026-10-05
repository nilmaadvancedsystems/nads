// View da casca da Tarefas (a Casca comum do nads). telaInteira: sem a barra lateral e sem o título (o Drive).
import { Casca, MenuSuspenso } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes, useTrilhaDoTopo } from '../../../comum/topo';
import type { IdAplicacao } from './navegacao';
import { useCascaTarefas } from './useCascaTarefas';

/** A ajuda ao lado do avatar (Vitor, 02/10/2026: "quero que a IA/FAQ fique do lado do perfil"): a IA e o FAQ. */
export function BotaoDeAjuda({ abrir }: { abrir: (topico: string) => void }) {
  return (
    <MenuSuspenso rotulo="" icone="ajuda" className="gh-topo-btn gh-topo-menu ajuda-btn" dica="Ajuda: perguntar à IA e perguntas frequentes" titulo="Ajuda" direita
      itens={[
        { rotulo: 'Perguntar à IA', icone: 'robo', onClick: () => abrir('ia') },
        { rotulo: 'Perguntas frequentes', icone: 'ajuda', onClick: () => abrir('faq') },
      ]} />
  );
}

/** O avatar no canto do cabeçalho (como o do Entregas e o do GitHub): as iniciais; aberto, a Minha página e sair. */
function AvatarDaPessoa({ vm }: { vm: ReturnType<typeof useCascaTarefas> }) {
  return (
    <MenuSuspenso rotulo={vm.perfil.foto ? <img className="gh-avatar-foto" src={vm.perfil.foto} alt="" /> : vm.perfil.iniciais} className={'gh-avatar' + (vm.naPessoal ? ' ativo' : '')} dica={vm.perfil.nome} titulo={vm.perfil.nome} direita
      itens={[
        { rotulo: 'Minha conta', icone: 'usuario', onClick: () => vm.abrirPessoal('conta') },
        'separador',
        { rotulo: vm.perfil.sair, icone: 'logOut', onClick: vm.trocarPessoa },
      ]} />
  );
}

export function CascaTarefas({ app, pagina, telaInteira, children }: { app: IdAplicacao; pagina: string; telaInteira?: boolean; children: ReactNode }) {
  const vm = useCascaTarefas(app, pagina);
  const trilha = useTrilhaDoTopo();
  return (
    <Casca sistema="Tarefas" empresa={vm.empresa} versao={vm.versao} trilha={trilha} secoes={vm.secoes} paginas={vm.paginas} titulo={telaInteira ? '' : vm.titulo}
      lateral={telaInteira || vm.comAbas ? 'nenhuma' : undefined} larga={telaInteira}
      acoes={telaInteira ? undefined : <LugarDasAcoes />} onSecao={vm.onSecao} onPagina={vm.onSecao} onInicio={vm.inicio} onAplicativos={vm.inicio}
      onEmpresa={vm.trocarPessoa} aplicativos={vm.aplicacoes} onAplicativo={vm.onAplicacao}
      topoDireita={<><BotaoDeAjuda abrir={vm.abrirPessoal} /><AvatarDaPessoa vm={vm} /></>}>
      {children}
    </Casca>
  );
}
