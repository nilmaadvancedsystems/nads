// Navegação da Conferência: seções (barra lateral) → páginas (abas do cabeçalho).
// Origem: conferencia.html SECOES/VIEWS (~L1678-1707).
import type { NomeIcone } from '@nads/ui';

export type IdSecao = 'importacao' | 'cadastro' | 'movimento' | 'auditoria';

export interface Pagina {
  /** "secao/pagina" — também é o caminho na URL depois da empresa */
  id: string;
  rotulo: string;
  icone: NomeIcone;
  /** título da página (o do topo) */
  titulo: string;
  /** página fora do menu: acende esta outra aba */
  acendeAba?: string;
}

export interface Secao { id: IdSecao; rotulo: string; icone: NomeIcone; grupo: number; paginas: Pagina[] }

export const SECOES: Secao[] = [
  {
    id: 'importacao', grupo: 1, rotulo: 'Importação', icone: 'upload', paginas: [
      { id: 'importacao/balancete', rotulo: 'Balancete', icone: 'landmark', titulo: 'Balancete' },
      { id: 'importacao/entradas', rotulo: 'Entradas', icone: 'arrowDown', titulo: 'Entradas' },
      { id: 'importacao/saidas', rotulo: 'Saídas', icone: 'arrowUp', titulo: 'Saídas' },
      { id: 'importacao/tomados', rotulo: 'Tomados', icone: 'fileDown', titulo: 'Serviços tomados' },
      { id: 'importacao/prestados', rotulo: 'Prestados', icone: 'fileUp', titulo: 'Serviços prestados' },
    ],
  },
  {
    id: 'cadastro', grupo: 1, rotulo: 'Cadastro', icone: 'link', paginas: [
      { id: 'cadastro/configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'Configurações' },
    ],
  },
  {
    id: 'movimento', grupo: 2, rotulo: 'Movimento', icone: 'repeat', paginas: [
      { id: 'movimento/relatorio', rotulo: 'Relatório', icone: 'relatorio', titulo: 'Relatório' },
      { id: 'movimento/checklist', rotulo: 'Checklist', icone: 'checklist', titulo: 'Naturezas de CFOP' },
      { id: 'movimento/consulta', rotulo: 'Consulta', icone: 'search', titulo: 'Consulta de notas' },
    ],
  },
  {
    id: 'auditoria', grupo: 3, rotulo: 'Auditoria', icone: 'clock', paginas: [
      { id: 'auditoria/historico', rotulo: 'Histórico', icone: 'clock', titulo: 'Auditoria' },
    ],
  },
];

/** Páginas fora do menu (abrem a partir de outra). */
export const PAGINAS_ESCONDIDAS: Pagina[] = [
  { id: 'movimento/verificar', rotulo: 'Verificar por conta', icone: 'fileSearch', titulo: 'Verificar por conta', acendeAba: 'movimento/relatorio' },
  { id: 'cadastro/lancamentos-automaticos', rotulo: 'Lançamentos automáticos', icone: 'zap', titulo: 'Lançamentos automáticos', acendeAba: 'cadastro/configuracoes' },
];

export function paginaPorId(id: string): Pagina | undefined {
  for (const s of SECOES) for (const p of s.paginas) if (p.id === id) return p;
  return PAGINAS_ESCONDIDAS.find(p => p.id === id);
}

export function secaoDaPagina(id: string): Secao | undefined {
  const sec = id.split('/')[0];
  return SECOES.find(s => s.id === sec);
}
