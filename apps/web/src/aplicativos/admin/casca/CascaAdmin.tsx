// View da casca do site do admin: a Casca comum do nads (o cabeçalho, a barra lateral com as páginas, a gaveta ☰ com as
// mesmas páginas e o tema) e o avatar no canto (o nome e sair da conta), como o da Tarefas.
import { Casca, MenuSuspenso } from '@nads/ui';
import type { ReactNode } from 'react';
import type { IdPaginaAdmin } from './navegacao';
import { useCascaAdmin } from './useCascaAdmin';

export function CascaAdmin({ pagina, children }: { pagina: IdPaginaAdmin; children: ReactNode }) {
  const vm = useCascaAdmin(pagina);
  return (
    <Casca sistema="Admin" empresa={null} versao={vm.versao} secoes={vm.secoes} paginas={[]} titulo={vm.titulo} larga rotuloLateral="Páginas do admin"
      onSecao={vm.onSecao} onPagina={vm.onSecao} onInicio={vm.inicio} onEmpresa={vm.sair} aplicativos={vm.paginasNaGaveta} onAplicativo={vm.onSecao}
      topoDireita={
        <MenuSuspenso rotulo={vm.perfil.iniciais} className="gh-avatar" dica={vm.perfil.nome} titulo={vm.perfil.nome} direita animado
          itens={[{ rotulo: vm.perfil.sair, icone: 'logOut', onClick: vm.sair }]} />
      }>
      {children}
    </Casca>
  );
}
