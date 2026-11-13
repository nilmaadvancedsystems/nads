// ViewModel do módulo Desenvolvedor (13/11/2026): as empresas com o link da Área do Cliente (para abrir a área de uma delas
// como o cliente vê) e a Central dos robôs. As telas abrem dentro do nads, pelas rotas de rotasDoModoDev.tsx.
import { empresas as emp } from '@nads/core';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAreaCliente, useTodosOsCadastros } from '../../dados/repo';

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface EmpresaComLink { codigo: number; nome: string; token: string }

/** As empresas com link, pelo nome; a busca pelo nome ou pelo código. */
export function empresasComLink(links: readonly { codigo: number; token: string }[], nomes: ReadonlyMap<number, string>, busca: string): EmpresaComLink[] {
  const q = simples(busca.trim());
  return links
    .map(l => ({ codigo: l.codigo, token: l.token, nome: nomes.get(l.codigo) || 'Empresa ' + l.codigo }))
    .filter(e => !q || simples(e.nome + ' ' + e.codigo).includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function useOutrosSites() {
  const repo = useAreaCliente();
  const links = repo.links();
  const cadastros = useTodosOsCadastros();
  const ir = useNavigate();
  const [busca, setBusca] = useState('');
  const nomes = useMemo(() => {
    // o nome do Cadastro; sem ele, o da lista do escritório
    const m = new Map<number, string>();
    for (const e of emp.EMPRESAS) if (e.codigo != null) m.set(e.codigo, e.nome);
    for (const c of cadastros.porId.values()) if (c.codigo != null) m.set(c.codigo, c.nome);
    return m;
  }, [cadastros.porId]);
  const empresas = useMemo(() => empresasComLink(links.lista, nomes, busca), [links.lista, nomes, busca]);
  return {
    carregando: !links.carregada,
    erro: links.erro,
    total: links.lista.length,
    empresas, busca, setBusca,
    abrirArea: (token: string) => ir('/cliente/' + encodeURIComponent(token)),
    /** a área de exemplo (dados de mentira, nada sai do navegador) */
    abrirExemplo: () => ir('/cliente/exemplo'),
    abrirCentral: () => ir('/robos'),
  };
}
