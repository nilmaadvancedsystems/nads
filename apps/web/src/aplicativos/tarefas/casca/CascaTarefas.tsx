// View da casca da Tarefas (a Casca comum do nads). telaInteira: sem a barra lateral e sem o título (o Drive).
import { BotaoIcone, Casca, MenuSuspenso, type NomeIcone } from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { LugarDasAcoes, useTrilhaDoTopo } from '../../../comum/topo';
import { useAvisoDeBloqueio } from '../../../comum/modoDesenvolvedor';
import type { IdAplicacao } from './navegacao';
import { useCascaTarefas } from './useCascaTarefas';
import { ItemDosFeedbacks, JanelaDosFeedbacks } from '../telas/feedback/FeedbacksDoNads';
import { AvisoDeCertificados } from './AvisoDeCertificados';
import { useAvisoDosMeusFeedbacks } from './useAvisoDosMeusFeedbacks';
import { CartaoDaEmpresa } from './CartaoDaEmpresa';
import { useCorreioDeTarefas } from './useCorreioDeTarefas';

/**
 * O avatar no canto do cabeçalho (como o do Entregas e o do GitHub): as iniciais; aberto, a Minha página e sair. Sem o
 * "Enviar feedback" (Vitor, 28/10/2026: "para enviar, deixe só o balão"; para ver, só o pé do menu lateral). A Central de
 * tarefas (28/10/2026: o delegador "irá estar em perfil"), logo depois da Minha conta.
 */
function AvatarDaPessoa({ vm, abrirCentral }: { vm: ReturnType<typeof useCascaTarefas>; abrirCentral: () => void }) {
  return (
    <MenuSuspenso rotulo={vm.perfil.foto ? <img className="gh-avatar-foto" src={vm.perfil.foto} alt="" /> : vm.perfil.iniciais} className={'gh-avatar' + (vm.naPessoal ? ' ativo' : '')} dica={vm.perfil.nome} titulo={vm.perfil.nome} direita animado
      itens={[
        { rotulo: 'Minha conta', icone: 'usuario', onClick: () => vm.abrirPessoal('conta') },
        { rotulo: 'Minhas tarefas', icone: 'checklist', onClick: abrirCentral },
        // só ver tudo, sem alterar nada (Vitor, 06/10/2026)
        { rotulo: 'Modo desenvolvedor', icone: 'settings', marcado: vm.dev, onClick: () => vm.setDev(!vm.dev) },
        'separador',
        { rotulo: vm.perfil.sair, icone: 'logOut', onClick: vm.trocarPessoa },
      ]} />
  );
}

/**
 * A empresa aberta (27/10/2026): no cabeçalho, o cartão dela; na barra lateral, as páginas dela (Tarefas, Visão geral,
 * Drive e, no Fiscal, as ferramentas) no lugar das de Minhas empresas.
 */
export interface EmpresaDaCasca {
  codigo: number | null; nome: string; rota: string;
  paginas: { id: string; rotulo: string; icone: NomeIcone; titulo: string }[];
  pagina: string;
  onPagina: (id: string) => void;
}

/** semLateral: sem a barra lateral, mas com o título (Minhas empresas, uma tela só; 27/10/2026). */
export function CascaTarefas({ app, pagina, telaInteira, semLateral, larga, empresa, children }: { app: IdAplicacao; pagina: string; telaInteira?: boolean; semLateral?: boolean; larga?: boolean; empresa?: EmpresaDaCasca; children: ReactNode }) {
  const vm = useCascaTarefas(app, pagina);
  const secoes = empresa ? empresa.paginas.map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, grupo: 1, ativa: p.id === empresa.pagina })) : vm.secoes;
  const titulo = empresa ? empresa.paginas.find(p => p.id === empresa.pagina)?.titulo || '' : vm.titulo;
  const trilha = useTrilhaDoTopo();
  const [feedbacks, setFeedbacks] = useState(false);
  // o aviso da tarefa nova (28/10/2026); a Central virou o módulo Minhas tarefas (30/10/2026), sem o correio no pé do menu
  useCorreioDeTarefas();
  useAvisoDeBloqueio();
  // o feedback que o admin pôs em Resolvendo: avisa quem mandou (26/10/2026)
  useAvisoDosMeusFeedbacks();
  return (
    <Casca sistema="Tarefas" temaNaGaveta={false} empresa={vm.empresa} versao={vm.versao} trilha={trilha} secoes={secoes} paginas={vm.paginas} titulo={telaInteira ? '' : titulo}
      lateral={telaInteira || semLateral || vm.comAbas ? 'nenhuma' : undefined} larga={telaInteira || larga}
      acoes={telaInteira || (empresa && !titulo) ? undefined : <LugarDasAcoes />} onSecao={empresa ? empresa.onPagina : vm.onSecao} onPagina={vm.onPagina} onInicio={vm.inicio} onAplicativos={vm.inicio}
      onEmpresa={vm.trocarPessoa} aplicativos={vm.aplicacoes} onAplicativo={vm.onAplicacao}
      cartaoNoTopo={empresa ? <CartaoDaEmpresa empresa={empresa} /> : undefined}
      topoDireita={<AvatarDaPessoa vm={vm} abrirCentral={() => vm.onAplicacao('minhas-tarefas')} />}
      // o pé da gaveta (Vitor, 28/10/2026: "deixe dois ícones, um com o e-mail e outro com a engrenagem, somente com os
      // ícones"): os Feedbacks (só o admin) e as Configurações (quem tem), lado a lado. O correio das tarefas saiu (30/10/2026:
      // as tarefas viraram o módulo Minhas tarefas, no Escritório)
      peDaGaveta={vm.admin || vm.configuracoes ? fechar => (
        <div className="drawer-icones">
          {vm.admin && <ItemDosFeedbacks abrir={() => { fechar(); setFeedbacks(true); }} />}
          {vm.configuracoes && <BotaoIcone icone="settings" titulo="Configurações" aria-pressed={vm.configuracoes.ativa}
            onClick={() => { fechar(); vm.onAplicacao('cadastro'); }} />}
        </div>
      ) : undefined}>
      {feedbacks && <JanelaDosFeedbacks fechar={() => setFeedbacks(false)} />}
      {/* os certificados vencidos ou vencendo (19/10/2026): só o admin */}
      <AvisoDeCertificados ligado={vm.admin} />
      {children}
    </Casca>
  );
}
