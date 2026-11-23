// O Controle contábil (23/11/2026: a planilha "CONTROLE CONTÁBIL" do Contábil no nads): as empresas acompanhadas no ano, com
// o mês feito, a pendência e a marca de não acompanhar. Uma empresa está no controle quando tem a linha dela no ano.
// Interface + a versão de exemplo; a do banco é controleContabil.firestore.ts.
import type { tarefas as t } from '@nads/core';

export interface AnoDoControleContabil {
  carregada: boolean;
  /** a leitura falhou (sem permissão, sem internet) */
  falhou: boolean;
  linhas: ReadonlyMap<number, t.LinhaDoControleContabil>;
}

export interface RepoControleContabil {
  exemplos: boolean;
  /** o ano (pedir já começa a ouvir só as linhas dele) */
  doAno(ano: number): AnoDoControleContabil;
  /** uma leitura só, sem ficar ouvindo (o Copiar a lista do ano anterior) */
  lerAno(ano: number): Promise<t.LinhaDoControleContabil[]>;
  salvar(l: t.LinhaDoControleContabil): Promise<void>;
  /** várias de uma vez (a importação da planilha, a cópia do ano anterior) */
  salvarVarias(ls: readonly t.LinhaDoControleContabil[]): Promise<void>;
  /** tira a empresa do controle do ano */
  remover(ano: number, codigo: number): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** semente: as linhas de exemplo de um ano (pedidas na primeira vez que o ano abre) */
export function criarControleContabilMemoria(semente: (ano: number) => t.LinhaDoControleContabil[] = () => []): RepoControleContabil {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const anos = new Map<number, Map<number, t.LinhaDoControleContabil>>();
  const vistas = new Map<number, AnoDoControleContabil>();
  const doAno = (ano: number) => {
    let m = anos.get(ano);
    if (!m) { m = new Map(semente(ano).map(l => [l.codigo, l])); anos.set(ano, m); }
    return m;
  };
  const mudou = (ano: number) => { vistas.delete(ano); ver++; for (const f of ouvintes) f(); };
  const carimbo = (l: t.LinhaDoControleContabil) => ({ ...l, atualizadoEm: new Date().toISOString(), atualizadoPor: 'exemplo' });
  return {
    exemplos: true,
    doAno(ano) {
      let v = vistas.get(ano);
      if (!v) { v = { carregada: true, falhou: false, linhas: new Map(doAno(ano)) }; vistas.set(ano, v); }
      return v;
    },
    async lerAno(ano) { return [...doAno(ano).values()]; },
    async salvar(l) { doAno(l.ano).set(l.codigo, carimbo(l)); mudou(l.ano); },
    async salvarVarias(ls) { for (const l of ls) doAno(l.ano).set(l.codigo, carimbo(l)); for (const a of new Set(ls.map(l => l.ano))) mudou(a); },
    async remover(ano, codigo) { doAno(ano).delete(codigo); mudou(ano); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
