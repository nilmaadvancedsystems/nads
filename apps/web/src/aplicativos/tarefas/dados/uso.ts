// O mapa de uso do sistema (Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo usado no sistema"): a
// interface do repositório e a versão de exemplo; a do banco é uso.firestore.ts.
//   config/uso    { ligado }   o interruptor (o admin liga na tela Uso do sistema; sem ele, nada é coletado)
//   uso/{dia}     o dia (core uso.UsoDoDia): cada navegador soma o que juntou, a cada 5 minutos
import { uso } from '@nads/core';

export interface RepoUso {
  exemplos: boolean;
  /** o interruptor da coleta (ao vivo) */
  ligado(): { carregado: boolean; ligado: boolean };
  /** liga ou desliga a coleta (só o admin grava config/) */
  ligar(ligado: boolean): Promise<void>;
  /** soma no dia o que este navegador juntou */
  somar(delta: uso.UsoDoDia): Promise<void>;
  /**
   * os dias do período (os que existem), lidos uma vez (sem ficar ouvindo); telasDeExemplo: as telas da navegação, que
   * só os exemplos usam (para inventar o uso)
   */
  dias(dias: readonly string[], telasDeExemplo: readonly uso.TelaDaNavegacao[]): Promise<uso.UsoDoDia[]>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/**
 * Os exemplos: noventa dias inventados para a tela ter o que mostrar (as telas mais usadas, umas nunca abertas, os
 * controles que ninguém clica), mais o que se clica no protótipo nesta sessão.
 */
export function criarUsoMemoria(): RepoUso {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let ligado = true;
  const guardados = new Map<string, uso.UsoDoDia>();
  // o sorteio é sempre o mesmo (a tela não muda a cada recarga)
  let semente = 7;
  const sorte = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
  const CONTROLES = ['Exportar Excel', 'Imprimir', 'Filtros', 'Buscar', 'Competência', 'Abrir', 'Salvar', 'Fechar'];
  const DEPARTAMENTOS = ['fiscal', 'contabil', 'dp'];
  const PESSOAS = ['Heverton', 'Gustavo.S', 'Savio', 'Vitor', 'Clara'];
  let semeado = false;
  function semear(telas: readonly uso.TelaDaNavegacao[]) {
    if (semeado) return;
    semeado = true;
    // um terço das telas fica sem visita (as "nunca visitadas" dos exemplos)
    const usadas = telas.filter((_, i) => i % 3 !== 2);
    const hoje = new Date();
    for (const dia of uso.diasDoPeriodo(90, hoje)) {
      // o dia que já tem o que se clicou nesta sessão fica como está
      if (guardados.has(dia)) continue;
      const d: uso.UsoDoDia = { dia, telas: {}, pessoas: {} };
      for (const [i, t] of usadas.entries()) {
        if (sorte() > 0.9 - (i % 5) * 0.1) continue;
        const v = 1 + Math.floor(sorte() * (12 - (i % 6) * 2));
        const c: Record<string, number> = {};
        // o último controle de cada tela aparece e ninguém clica (o "possivelmente inútil")
        for (const [j, nome] of CONTROLES.entries()) c[nome] = j === CONTROLES.length - 1 ? 0 : Math.floor(sorte() * (8 - j));
        const p: Record<string, number> = {};
        for (let k = 0; k < 12; k++) {
          // os cliques se juntam no topo (os filtros) e no meio (a lista)
          const x = 16 + Math.floor(sorte() * 30) + (k % 2) * 4, y = k < 5 ? 10 + Math.floor(sorte() * 4) : 18 + Math.floor(sorte() * 25);
          p[x + '_' + y] = (p[x + '_' + y] || 0) + 1;
        }
        const q = { [DEPARTAMENTOS[i % 3]]: v + 3, [DEPARTAMENTOS[(i + 1) % 3]]: Math.floor(v / 3) };
        d.telas[t.tela] = { v, c, p, q };
      }
      for (const p of PESSOAS) d.pessoas[p] = Math.floor(sorte() * 60);
      guardados.set(dia, d);
    }
  }
  return {
    exemplos: true,
    ligado: () => ({ carregado: true, ligado }),
    async ligar(l) { ligado = l; mudou(); },
    async somar(delta) {
      const atual = guardados.get(delta.dia) || { dia: delta.dia, telas: {}, pessoas: {} };
      const somar = (m: Record<string, number>, de: Record<string, number>) => { for (const [k, n] of Object.entries(de)) m[k] = (m[k] || 0) + n; };
      for (const [tela, t] of Object.entries(delta.telas)) {
        const a = atual.telas[tela] || (atual.telas[tela] = { v: 0, c: {}, p: {}, q: {} });
        a.v += t.v; somar(a.c, t.c); somar(a.p, t.p); somar(a.q, t.q);
      }
      somar(atual.pessoas, delta.pessoas);
      guardados.set(delta.dia, atual);
      mudou();
    },
    async dias(lista, telas) {
      semear(telas);
      return lista.map(d => guardados.get(d)).filter((d): d is uso.UsoDoDia => !!d).map(d => structuredClone(d));
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
