// Fiscal › Auditoria de itens (04/11/2026: o prompt "Gestor Fiscal e Auditor Tributário" adaptado como ferramenta do
// Fiscal): sobe a planilha de itens/produtos (xlsx, xls, ods ou csv), audita linha a linha pelo core (PIS/COFINS e ICMS-ST
// de MG) e baixa a planilha auditada. Tudo no navegador: o arquivo não sai do computador.
import { tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';

const a = t.auditoriaItens;
export type Filtro = '' | t.auditoriaItens.Diagnostico;
export const DIAGNOSTICOS: readonly t.auditoriaItens.Diagnostico[] = ['Ambos', 'Somente ST', 'Somente Monofásico', 'Não'];
const LIMITE = 300;

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useAuditoriaDeItens() {
  const { aviso } = useRetorno();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [planilha, setPlanilha] = useState<t.auditoriaItens.PlanilhaDeItens | null>(null);
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('');
  const [busca, setBusca] = useState('');

  async function escolher(f: File | null) {
    setArquivo(f); setPlanilha(null); setErro(''); setFiltro(''); setBusca('');
    if (!f) return;
    setLendo(true);
    try { setPlanilha(a.lerPlanilhaDeItens(new Uint8Array(await f.arrayBuffer()))); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setLendo(false); }
  }

  const linhas = useMemo(() => (planilha ? a.auditarPlanilha(planilha) : []), [planilha]);
  const comNcm = useMemo(() => linhas.filter(l => l.auditoria), [linhas]);
  const contagem = useMemo(() => {
    const c: Record<t.auditoriaItens.Diagnostico, number> = { Ambos: 0, 'Somente ST': 0, 'Somente Monofásico': 0, Não: 0 };
    for (const l of comNcm) c[l.auditoria!.diagnostico]++;
    return c;
  }, [comNcm]);
  const filtradas = useMemo(() => {
    const b = normal(busca.trim());
    const bDig = busca.replace(/\D/g, '');
    return comNcm.filter(l => (!filtro || l.auditoria!.diagnostico === filtro)
      && (!b || normal(l.item.descricao).includes(b) || (bDig.length > 0 && a.ncmLimpo(l.item.ncm).startsWith(bDig))));
  }, [comNcm, filtro, busca]);

  const c = planilha?.colunas;
  return {
    arquivo, escolher, erro, lendo,
    planilha,
    /** as colunas que vieram, além do NCM */
    achadas: c ? ([['Descrição', c.descricao], ['CFOP', c.cfop], ['CST', c.cst], ['CSOSN', c.csosn], ['CEST', c.cest]] as const).filter(([, k]) => k >= 0).map(([n]) => n) : [],
    semDescricao: !!c && c.descricao < 0,
    temSituacao: !!c && (c.cst >= 0 || c.csosn >= 0),
    total: comNcm.length,
    semNcm: linhas.length - comNcm.length,
    contagem,
    filtro, setFiltro: (f: Filtro) => setFiltro(atual => (atual === f ? '' : f)),
    busca, setBusca,
    linhas: filtradas.slice(0, LIMITE),
    fora: Math.max(0, filtradas.length - LIMITE),
    quantasFiltradas: filtradas.length,
    baixar() {
      if (!planilha || !arquivo) return;
      try {
        const bytes = a.planilhaAuditada(planilha, linhas, 'Auditoria');
        baixarBytes(bytes, arquivo.name.replace(/\.[^.]+$/, '') + ' - auditada.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } catch (e) { aviso({ titulo: 'Não consegui gerar a planilha', texto: e instanceof Error ? e.message : String(e), tom: 'erro' }); }
    },
  };
}
