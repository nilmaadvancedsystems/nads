// O "onde parou" das etapas da Tarefa (Vitor, 15/10/2026: "caso o usuário clique Próximo naquela etapa, salve isso, pois
// quando ele voltar vai estar exatamente onde parou e não vai ser necessário re-upar arquivos"). Um useState que fica
// guardado neste navegador, pela chave (a empresa, o período e a etapa): a subetapa em que a pessoa está, até onde ela
// já chegou e o que ela importou (o balancete dinâmico, os razões, as guias), já lido. Trocou de empresa ou de período,
// a chave muda e volta o que estava guardado nela (ou o começo).
// Fica no localStorage, não no banco (o banco só liga quando o Vitor pede): é por computador. O que tem mais de
// DURA_DIAS some sozinho; sem espaço, os mais velhos saem primeiro.
import { useCallback, useState, type SetStateAction } from 'react';

const PREFIXO = 'nads-onde-parou-v1|';
const DURA_DIAS = 60;

interface Guardado { em: number; v: unknown }

function ler<T>(chave: string): T | undefined {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    if (!bruto) return undefined;
    const g = JSON.parse(bruto) as Guardado;
    if (!g || Date.now() - g.em > DURA_DIAS * 864e5) { localStorage.removeItem(PREFIXO + chave); return undefined; }
    return g.v as T;
  } catch { return undefined; }
}

/** As chaves guardadas, da mais velha para a mais nova. */
function guardadas(): { chave: string; em: number }[] {
  const lista: { chave: string; em: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIXO)) continue;
      let em = 0;
      try { em = (JSON.parse(localStorage.getItem(k) || '{}') as Guardado).em || 0; } catch { /* estragado: sai primeiro */ }
      lista.push({ chave: k, em });
    }
  } catch { /* sem acesso ao localStorage */ }
  return lista.sort((a, b) => a.em - b.em);
}

function gravar(chave: string, v: unknown) {
  try {
    if (v === undefined || v === null) { localStorage.removeItem(PREFIXO + chave); return; }
    const texto = JSON.stringify({ em: Date.now(), v } satisfies Guardado);
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      try { localStorage.setItem(PREFIXO + chave, texto); return; }
      catch {
        // sem espaço: tira o guardado mais velho (outro que não este) e tenta de novo
        const velho = guardadas().find(g => g.chave !== PREFIXO + chave);
        if (!velho) return;
        localStorage.removeItem(velho.chave);
      }
    }
  } catch { /* sem localStorage (janela anônima, bloqueado): fica só na tela */ }
}

/** Os valores guardados cujas chaves passam no teste, do mais novo para o mais velho (ler o de outra etapa). */
export function guardadosQueCasam(teste: (chave: string) => boolean): unknown[] {
  return guardadas().reverse().map(g => g.chave.slice(PREFIXO.length)).filter(teste).map(k => ler<unknown>(k)).filter(v => v !== undefined);
}

/** Esquece o que está guardado na chave (e nas que começam com ela + '|'). */
export function esquecerGuardado(chave: string) {
  try {
    for (const g of guardadas()) if (g.chave === PREFIXO + chave || g.chave.startsWith(PREFIXO + chave + '|')) localStorage.removeItem(g.chave);
  } catch { /* sem localStorage */ }
}

/**
 * Como o useState, mas guardado pela chave (null = não guarda: só na tela). Trocou a chave, volta o guardado dela. O
 * valor tem de ser dado puro (sem File, Map, Date): vai como JSON.
 */
export function useGuardado<T>(chave: string | null, inicial: T): [T, (v: SetStateAction<T>) => void] {
  const [estado, setEstado] = useState<{ chave: string | null; v: T }>(() => ({ chave, v: chave ? ler<T>(chave) ?? inicial : inicial }));
  // a chave mudou (outra empresa, outro período): o guardado dela
  let atual = estado;
  if (estado.chave !== chave) {
    atual = { chave, v: chave ? ler<T>(chave) ?? inicial : inicial };
    setEstado(atual);
  }
  const mudar = useCallback((x: SetStateAction<T>) => {
    setEstado(e => {
      const v = typeof x === 'function' ? (x as (a: T) => T)(e.chave === chave ? e.v : (chave ? ler<T>(chave) ?? inicial : inicial)) : x;
      if (chave) gravar(chave, v);
      return { chave, v };
    });
  // o inicial é o da primeira vez (como no useState)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return [atual.v, mudar];
}
