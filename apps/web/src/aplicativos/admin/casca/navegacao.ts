// As páginas do site do admin (Vitor, 21/10/2026: "quero um site específico só para quem é admin, para ter acesso a
// desempenho do robô, uso de sistema, saúde do banco de dados e coisas assim"): /admin/<página>, na barra lateral.
import type { NomeIcone } from '@nads/ui';

export const BASE = '/admin';

export type IdPaginaAdmin = 'visao-geral' | 'robo' | 'uso' | 'banco' | 'cota' | 'feedbacks' | 'sistema';

export interface PaginaAdmin { id: IdPaginaAdmin; rotulo: string; titulo: string; icone: NomeIcone }

export const PAGINAS_DO_ADMIN: readonly PaginaAdmin[] = [
  { id: 'visao-geral', rotulo: 'Visão geral', titulo: 'Visão geral', icone: 'painel' },
  { id: 'robo', rotulo: 'Robô', titulo: 'Painel do robô', icone: 'robo' },
  { id: 'uso', rotulo: 'Uso do sistema', titulo: 'Uso do sistema', icone: 'barChart' },
  { id: 'banco', rotulo: 'Saúde do banco', titulo: 'Saúde do banco', icone: 'escudo' },
  { id: 'cota', rotulo: 'Cota e custos', titulo: 'Cota e custos', icone: 'dinheiro' },
  { id: 'feedbacks', rotulo: 'Feedbacks', titulo: 'Feedbacks', icone: 'mensagem' },
  { id: 'sistema', rotulo: 'Sistema e agentes', titulo: 'Sistema e agentes', icone: 'settings' },
];

export const paginaDoAdmin = (id: string) => PAGINAS_DO_ADMIN.find(p => p.id === id);
export const caminhoDoAdmin = (id: IdPaginaAdmin) => BASE + '/' + id;
