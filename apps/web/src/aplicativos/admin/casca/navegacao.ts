// As páginas do site do admin (Vitor, 21/10/2026: "quero um site específico só para quem é admin, para ter acesso a
// desempenho do robô, uso de sistema, saúde do banco de dados e coisas assim"): /admin/<página>, na barra lateral.
import type { NomeIcone } from '@nads/ui';

export const BASE = '/admin';

export type IdPaginaAdmin = 'visao-geral' | 'robo' | 'saude-robos' | 'arquivador' | 'uso' | 'banco' | 'cota' | 'feedbacks' | 'sistema' | 'registro' | 'sci';

export interface PaginaAdmin { id: IdPaginaAdmin; rotulo: string; titulo: string; icone: NomeIcone }

export const PAGINAS_DO_ADMIN: readonly PaginaAdmin[] = [
  { id: 'visao-geral', rotulo: 'Visão geral', titulo: 'Visão geral', icone: 'painel' },
  { id: 'robo', rotulo: 'Robô', titulo: 'Painel do robô', icone: 'robo' },
  // um cartão por robô com o estado (ok / atenção / parado), 07/11/2026
  { id: 'saude-robos', rotulo: 'Saúde dos robôs', titulo: 'Saúde dos robôs', icone: 'checkCircle' },
  // o arquivador novo (22/10/2026: "quero uma só para ele e bem organizada")
  { id: 'arquivador', rotulo: 'Arquivador', titulo: 'Arquivador', icone: 'arquivo' },
  { id: 'uso', rotulo: 'Uso do sistema', titulo: 'Uso do sistema', icone: 'barChart' },
  { id: 'banco', rotulo: 'Saúde do banco', titulo: 'Saúde do banco', icone: 'escudo' },
  { id: 'cota', rotulo: 'Cota e custos', titulo: 'Cota e custos', icone: 'dinheiro' },
  { id: 'feedbacks', rotulo: 'Feedbacks', titulo: 'Feedbacks', icone: 'mensagem' },
  // quem mudou o quê nos usuários e nos acessos (22/11/2026, ficha E20)
  { id: 'registro', rotulo: 'Registro de alterações', titulo: 'Registro de alterações', icone: 'clock' },
  { id: 'sistema', rotulo: 'Sistema e agentes', titulo: 'Sistema e agentes', icone: 'settings' },
  // as APIs da SCI (24/11/2026: "monta o nads para suportar completamente a integracao do sci"): tudo desligado até ligar aqui
  { id: 'sci', rotulo: 'Integração SCI', titulo: 'Integração SCI', icone: 'link' },
];

/**
 * As que saíram do menu (25/11/2026: "remove isso 'uso do sistema' esses 2 robos e a visao geral", e o "Sistema e agentes"):
 * as telas continuam no código e abrem pelo endereço (os links de dentro, como o "Painel do robô" da Saúde do banco), mas
 * não aparecem no menu do site do admin nem nas Configurações.
 */
export const FORA_DO_MENU: readonly IdPaginaAdmin[] = ['visao-geral', 'robo', 'saude-robos', 'uso', 'sistema'];
/** as páginas do menu (o site do admin e as Configurações da Tarefas) */
export const PAGINAS_NO_MENU: readonly PaginaAdmin[] = PAGINAS_DO_ADMIN.filter(p => !FORA_DO_MENU.includes(p.id));
/** a primeira página do site do admin (era a Visão geral, que saiu do menu) */
export const PAGINA_INICIAL: IdPaginaAdmin = PAGINAS_NO_MENU[0].id;

export const paginaDoAdmin = (id: string) => PAGINAS_DO_ADMIN.find(p => p.id === id);
/**
 * O endereço da página: no site do admin, /admin/<página>; dentro da Tarefas, onde as mesmas telas moram nas Configurações
 * (28/10/2026), /tarefas/cadastro/<página> (os links da Visão geral e da Saúde do banco não saem da Tarefas).
 */
export const caminhoDoAdmin = (id: IdPaginaAdmin) =>
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/tarefas') ? '/tarefas/cadastro/' : BASE + '/') + id;
