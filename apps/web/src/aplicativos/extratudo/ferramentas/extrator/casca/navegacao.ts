// Navegação do Extrator: seções (barra lateral) → páginas (abas do cabeçalho), como na Conferência.
import type { NomeIcone } from '@nads/ui';

export type IdSecao = 'importacao' | 'conferencia' | 'auditoria';

export interface Pagina {
  /** "secao/pagina" — também é o caminho na URL depois da empresa */
  id: string;
  rotulo: string;
  icone: NomeIcone;
  titulo: string;
}

export interface Secao { id: IdSecao; rotulo: string; icone: NomeIcone; grupo: number; paginas: Pagina[] }

export const SECOES: Secao[] = [
  {
    id: 'importacao', grupo: 1, rotulo: 'Importação', icone: 'upload', paginas: [
      { id: 'importacao/arquivos', rotulo: 'Arquivos', icone: 'fileUp', titulo: 'Importação' },
      { id: 'importacao/lancamentos', rotulo: 'Lançamentos', icone: 'list', titulo: 'Lançamentos importados' },
    ],
  },
  {
    id: 'conferencia', grupo: 2, rotulo: 'Conferência', icone: 'scale', paginas: [
      { id: 'conferencia/resultado', rotulo: 'Extrato × sistema', icone: 'checkCircle', titulo: 'Extrato × sistema' },
    ],
  },
  {
    id: 'auditoria', grupo: 3, rotulo: 'Auditoria', icone: 'clock', paginas: [
      { id: 'auditoria/historico', rotulo: 'Histórico', icone: 'clock', titulo: 'Auditoria' },
    ],
  },
];

/**
 * Páginas que não aparecem na navegação: as que a Tarefas abre dentro de uma etapa. "tarefa/extratos" =
 * importar (em lista) e conferir na mesma tela.
 */
export const PAGINAS_DA_TAREFA: Pagina[] = [
  { id: 'tarefa/extratos', rotulo: 'Importação', icone: 'fileUp', titulo: '' },
  // a etapa Bancos: o relatório do que passou pelos bancos no período (só olhar; Vitor, 06/10/2026)
  { id: 'tarefa/bancos', rotulo: 'Bancos', icone: 'landmark', titulo: 'Relatório Bancário' },
];

export const PAGINA_INICIAL = 'importacao/arquivos';

export function paginaPorId(id: string): Pagina | undefined {
  for (const s of SECOES) for (const p of s.paginas) if (p.id === id) return p;
  return PAGINAS_DA_TAREFA.find(p => p.id === id);
}

export function secaoDaPagina(id: string): Secao | undefined {
  return SECOES.find(s => s.id === id.split('/')[0]);
}
