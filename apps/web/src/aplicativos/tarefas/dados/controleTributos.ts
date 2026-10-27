// O controle de tributos do Fiscal (27/10/2026: a folha do Protocolo de Entrega de Tributos preenchida no nads): as
// linhas de cada empresa no mês e o fim da folha de cada grupo (as observações e a retificação). Interface + a versão de
// exemplo; a do banco é controleTributos.firestore.ts.
import type { tarefas as t } from '@nads/core';

export interface ControleDoMes {
  carregada: boolean;
  linhas: ReadonlyMap<number, t.LinhaDoControle>;
  folhas: ReadonlyMap<t.GrupoDoControleId, t.FolhaDoControle>;
}

export interface RepoControleTributos {
  exemplos: boolean;
  /** o mês (pedir já começa a ouvir) */
  doMes(competencia: string): ControleDoMes;
  salvarLinha(l: t.LinhaDoControle): Promise<void>;
  salvarFolha(competencia: string, grupo: t.GrupoDoControleId, folha: t.FolhaDoControle): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export const FOLHA_VAZIA: t.FolhaDoControle = { observacoes: [], retificacoes: [] };

export function criarControleTributosMemoria(): RepoControleTributos {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const meses = new Map<string, ControleDoMes>();
  const mes = (c: string) => meses.get(c) || { carregada: true, linhas: new Map(), folhas: new Map() };
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  return {
    exemplos: true,
    doMes: mes,
    async salvarLinha(l) { const m = mes(l.competencia); meses.set(l.competencia, { ...m, linhas: new Map(m.linhas).set(l.codigo, l) }); mudou(); },
    async salvarFolha(c, g, f) { const m = mes(c); meses.set(c, { ...m, folhas: new Map(m.folhas).set(g, f) }); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
