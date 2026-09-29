// ViewModel da casca comum do Extratudo: as ferramentas na barra lateral (a aberta marcada), as
// páginas da ferramenta nas abas de cima, e para onde vão o início e a empresa.
import type { PaginaCasca } from '@nads/ui';
import { useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { FERRAMENTAS } from '../ferramentas';
import { BASE, type IdFerramenta } from './caminho';

export interface PropsCascaExtratudo {
  ferramenta: IdFerramenta;
  empresa: { codigo: number | null; nome: string };
  /** a empresa na URL (código do ERP, ou o nome quando não tem código) */
  rota: string;
  titulo: string;
  paginas: PaginaCasca[];
  onPagina: (id: string) => void;
}

export function useCascaExtratudo(p: PropsCascaExtratudo) {
  const navegar = useNavigate();
  return {
    empresa: { codigo: p.empresa.codigo != null ? String(p.empresa.codigo) : p.empresa.nome, nome: p.empresa.nome },
    versao: VERSAO_SISTEMA,
    titulo: p.titulo,
    secoes: FERRAMENTAS.map(f => ({ id: f.id, rotulo: f.nome, icone: f.icone, grupo: 1, ativa: f.id === p.ferramenta })),
    paginas: p.paginas,
    /** outra ferramenta: abre a página inicial dela, na mesma empresa */
    onSecao: (id: string) => { if (id !== p.ferramenta) navegar(BASE + '/' + p.rota + '/' + id); },
    onPagina: p.onPagina,
    /** início: a escolha de empresa */
    inicio: () => navegar(BASE),
    /** a empresa (no caminho da barra): volta à página inicial da ferramenta */
    empresaInicio: () => navegar(BASE + '/' + p.rota + '/' + p.ferramenta),
  };
}
