// ViewModel da entrada do Lançatudo: a empresa (a busca da barra, a mesma das ferramentas do Fiscal), a competência e a conta
// bancária, no endereço (?e=292&c=2026-09&b=sicoob), para o link levar direto e o Voltar do navegador funcionar.
import { empresas } from '@nads/core';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { repoDoExtrator } from '../../dados/extrator';

export interface EmpresaDoLancatudo { codigo: number; nome: string }

/** O mês passado ('aaaa-mm'): o que o Contábil fecha agora. */
export function mesPassado(hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** soAs: só essas empresas (pelo código) aparecem e podem ser escolhidas (o minimum: as que estão no SCI); sem, todas */
export function useLancatudo(soAs?: ReadonlySet<number> | null) {
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  // as empresas do escritório e as do Extrator (a empresa de teste e, nos exemplos, as de exemplo), uma vez cada código
  const todas = useMemo(() => {
    const porCodigo = new Map<number, EmpresaDoLancatudo & { regime: string }>();
    for (const e of [...empresas.EMPRESAS, ...repoDoExtrator().listarEmpresas()]) if (e.codigo != null && !porCodigo.has(e.codigo)) porCodigo.set(e.codigo, { codigo: e.codigo, nome: e.nome, regime: e.regime || '' });
    return [...porCodigo.values()].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  }, []);
  const lista = useMemo(() => (soAs ? todas.filter(e => soAs.has(e.codigo)) : todas), [todas, soAs]);
  const q = busca.trim();
  const achadas = useMemo(() => (q ? empresas.buscarEmpresas(lista, q).slice(0, 8) : []), [lista, q]);

  const codigo = Number(params.get('e')) || null;
  const empresa: EmpresaDoLancatudo | null = codigo == null ? null : lista.find(e => e.codigo === codigo) || null;
  const competencia = /^\d{4}-\d{2}$/.test(params.get('c') || '') ? (params.get('c') as string) : mesPassado();
  const banco = params.get('b') || null;

  const mudar = (novos: Record<string, string | null>) => setParams(p => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(novos)) { if (v) n.set(k, v); else n.delete(k); }
    return n;
  });
  const escolher = (e: { codigo: number | string | null }) => { if (e.codigo == null) return; setBusca(''); setAtivo(0); mudar({ e: String(e.codigo), b: null }); };

  return {
    empresa, competencia, banco,
    /** as que podem ser escolhidas (com o soAs, só elas) e todas, sem o filtro */
    lista, todas,
    // a empresa na barra (EmpresaDaBarra)
    busca, setBusca: (v: string) => { setBusca(v); setAtivo(0); }, achadas, ativo, setAtivo,
    mover: (d: number) => setAtivo(i => Math.max(0, Math.min(achadas.length - 1, i + d))),
    escolher,
    escolherDestacado: () => { const e = achadas[ativo]; if (e) escolher(e); },
    trocarEmpresa: () => mudar({ e: null, b: null }),
    setCompetencia: (c: string) => { if (c) mudar({ c }); },
    setBanco: (b: string) => mudar({ b }),
  };
}
