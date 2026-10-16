// ViewModel da página Links da Área do Cliente (Vitor, 16/10/2026): as empresas do escritório, cada uma com o link (ou sem),
// a busca e o filtro Todas / Com link / Sem link. As ações (gerar, copiar, WhatsApp, trocar, revogar) são do useAcoesDoLink.
import { demo, empresas } from '@nads/core';
import { useMemo, useState } from 'react';
import { useAreaCliente, useTodosOsCadastros } from '../../dados/repo';
import { useAcoesDoLink } from './useAcoesDoLink';

export type FiltroDosLinks = 'todas' | 'com' | 'sem';
export const ROTULO_DO_FILTRO_DOS_LINKS: Record<FiltroDosLinks, string> = { todas: 'Todas as empresas', com: 'Com link', sem: 'Sem link' };

export interface EmpresaComLink {
  chave: string;
  codigo: number;
  nome: string;
  regime: string;
  /** '' = sem link */
  token: string;
  atualizadoEm: string;
}

export function useLinksDoCliente() {
  const repo = useAreaCliente();
  const todos = useTodosOsCadastros();
  const acoes = useAcoesDoLink();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDosLinks>('todas');
  const links = repo.links();

  // a lista do escritório com a empresa de teste e as cadastradas pelo nads; só entram as que têm código (o link é por código)
  const todas = useMemo<EmpresaComLink[]>(() => {
    const porCodigo = new Map(links.lista.map(l => [l.codigo, l]));
    return [...demo.comEmpresaDemo(empresas.EMPRESAS, demo.EMPRESA_DEMO), ...empresas.cadastro.empresasCadastradasNoNads(todos.porId.values())
      .filter(n => !empresas.EMPRESAS.some(e => e.nome === n.nome))]
      .filter((e): e is typeof e & { codigo: number } => e.codigo != null)
      .map(e => {
        const l = porCodigo.get(e.codigo);
        return { chave: e.codigo + e.nome, codigo: e.codigo, nome: e.nome, regime: e.regime, token: l?.token || '', atualizadoEm: l?.atualizadoEm || '' };
      });
  }, [links.lista, todos.porId]);

  const linhas = useMemo(() => {
    const q = busca.trim();
    const achadas = q ? empresas.buscarEmpresas(todas, q) : todas;
    return achadas.filter(e => filtro === 'todas' || (filtro === 'com') === !!e.token);
  }, [todas, busca, filtro]);

  const comLink = todas.filter(e => e.token).length;
  return {
    exemplos: repo.exemplos,
    carregando: !links.carregada,
    erro: links.erro,
    linhas,
    total: todas.length,
    contagem: { todas: todas.length, com: comLink, sem: todas.length - comLink } as Record<FiltroDosLinks, number>,
    busca, setBusca, filtro, setFiltro,
    acoes,
    /** 'aaaa-mm-ddT…' → 'dd/mm/aaaa' */
    data: (iso: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : ''),
  };
}
