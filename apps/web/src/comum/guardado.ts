// O "onde parou" das etapas da Tarefa (Vitor, 15/10/2026: "caso o usuário clique Próximo naquela etapa, salve isso, pois
// quando ele voltar vai estar exatamente onde parou e não vai ser necessário re-upar arquivos"). Um useState que fica
// guardado neste navegador, pela chave (a empresa, o período e a etapa): a subetapa em que a pessoa está, até onde ela
// já chegou e o que ela importou (o balancete dinâmico, os razões, as guias), já lido. Trocou de empresa ou de período,
// a chave muda e volta o que estava guardado nela (ou o começo).
// Fica no localStorage; o que tem mais de DURA_DIAS some sozinho; sem espaço, os mais velhos saem primeiro.
// No banco também (Vitor, 16/10/2026: "aplique todas as suas sugestões" — guardar no banco, não no navegador): com a
// empresa aberta (useEscopoDoGuardado), o que é dela vai para o remoto (ligarGuardadoRemoto, no banco da Tarefas) e, ao
// abrir, o mais novo do remoto volta para cá. Outra aba ou o quadro da Importação gravou: os hooks releem (evento storage).
import { useCallback, useEffect, useState, useSyncExternalStore, type SetStateAction } from 'react';

const PREFIXO = 'nads-onde-parou-v1|';
const DURA_DIAS = 60;

interface Guardado { em: number; v: unknown }

// o que já foi lido ou gravado nesta aba (Vitor, 19/10/2026: "o nads está lerdo em outras máquinas"): o razão e o dinâmico
// são grandes, e cada desenho da tela relia e desfazia o JSON do localStorage; outra aba gravou, a chave sai daqui
const cache = new Map<string, Guardado | null>();

function ler<T>(chave: string): T | undefined {
  try {
    let g = cache.get(chave);
    if (g === undefined) {
      const bruto = localStorage.getItem(PREFIXO + chave);
      g = bruto ? (JSON.parse(bruto) as Guardado) : null;
      cache.set(chave, g);
    }
    if (!g) return undefined;
    if (Date.now() - g.em > DURA_DIAS * 864e5) { localStorage.removeItem(PREFIXO + chave); cache.set(chave, null); return undefined; }
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
      // só a data, do começo do texto ({"em":123,"v":…}): desfazer o JSON inteiro de cada guardado (o razão, o dinâmico,
      // vários MB) para achar o mais velho travava a tela quando o navegador enchia
      const m = /^\{"em":(\d+)/.exec((localStorage.getItem(k) || '').slice(0, 40));
      const em = m ? Number(m[1]) : 0;
      lista.push({ chave: k, em });
    }
  } catch { /* sem acesso ao localStorage */ }
  return lista.sort((a, b) => a.em - b.em);
}

function gravar(chave: string, v: unknown, em = Date.now(), doRemoto = false) {
  if (!doRemoto) mandarAoRemoto(chave, v, em);
  // os outros hooks da mesma chave (e quem lê fora deles) releem — depois, fora do desenho de agora
  if (!doRemoto) queueMicrotask(() => mudouDeFora([chave]));
  cache.set(chave, v === undefined || v === null ? null : { em, v });
  try {
    if (v === undefined || v === null) { localStorage.removeItem(PREFIXO + chave); return; }
    const texto = JSON.stringify({ em, v } satisfies Guardado);
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      try { localStorage.setItem(PREFIXO + chave, texto); return; }
      catch {
        // sem espaço: tira o guardado mais velho (outro que não este) e tenta de novo
        const velho = guardadas().find(g => g.chave !== PREFIXO + chave);
        if (!velho) return;
        localStorage.removeItem(velho.chave);
        cache.delete(velho.chave.slice(PREFIXO.length));
      }
    }
  } catch { /* sem localStorage (janela anônima, bloqueado): fica só na tela */ }
}

/** Os valores guardados cujas chaves passam no teste, do mais novo para o mais velho (ler o de outra etapa). */
export function guardadosQueCasam(teste: (chave: string) => boolean): unknown[] {
  // só lê (o JSON) as chaves que passam no teste: o razão e o dinâmico são grandes
  const achados: { em: number; v: unknown }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIXO) || !teste(k.slice(PREFIXO.length))) continue;
      const bruto = localStorage.getItem(k);
      if (!bruto) continue;
      try {
        const g = JSON.parse(bruto) as Guardado;
        if (g && Date.now() - g.em <= DURA_DIAS * 864e5 && g.v !== undefined) achados.push({ em: g.em, v: g.v });
      } catch { /* estragado */ }
    }
  } catch { /* sem localStorage */ }
  return achados.sort((a, b) => b.em - a.em).map(x => x.v);
}

/** A versão do guardado: muda quando alguém grava (aqui, em outra aba ou vindo do banco). Para reler fora do useGuardado. */
export function useVersaoDoGuardado(): number {
  return useSyncExternalStore(assinar, versaoAtual, versaoAtual);
}

/** Esquece o que está guardado na chave (e nas que começam com ela + '|'). */
export function esquecerGuardado(chave: string) {
  try {
    for (const g of guardadas()) if (g.chave === PREFIXO + chave || g.chave.startsWith(PREFIXO + chave + '|')) { localStorage.removeItem(g.chave); cache.delete(g.chave.slice(PREFIXO.length)); }
  } catch { /* sem localStorage */ }
}

// ─── a versão: o remoto ou outra aba mudou o que está guardado, os hooks releem ─────────────────────────────────────

let versao = 0;
const ouvintes = new Set<() => void>();
/** a versão de cada chave: o useGuardado só relê a dele (o razão e o dinâmico são grandes) */
const versoes = new Map<string, number>();
function mudouDeFora(chaves: readonly string[]) {
  versao++;
  for (const c of chaves) versoes.set(c, (versoes.get(c) || 0) + 1);
  for (const o of ouvintes) o();
}
function assinar(o: () => void) {
  ouvintes.add(o);
  return () => { ouvintes.delete(o); };
}
const versaoAtual = () => versao;

// outra aba, ou o quadro da Importação dentro da Tarefa, gravou: relê e manda ao remoto o que é da empresa aberta
if (typeof window !== 'undefined') {
  window.addEventListener('storage', ev => {
    if (!ev.key || !ev.key.startsWith(PREFIXO)) return;
    const chave = ev.key.slice(PREFIXO.length);
    cache.delete(chave);
    if (ev.newValue == null) mandarAoRemoto(chave, null, Date.now());
    else try { const g = JSON.parse(ev.newValue) as Guardado; mandarAoRemoto(chave, g.v, g.em); } catch { /* estragado */ }
    mudouDeFora([chave]);
  });
}

// ─── o remoto (o banco), com a empresa aberta ──────────────────────────────────────────────────────────────────────

/** Uma entrada do remoto: a chave, quando foi gravada e o valor (null = apagada). */
export interface EntradaGuardada { chave: string; em: number; v: unknown }

/** O banco do "onde parou" (tarefas/dados/guardado.firestore.ts): uma pasta por empresa. */
export interface RemotoDoGuardado {
  carregar(escopo: string): Promise<EntradaGuardada[]>;
  gravar(escopo: string, e: EntradaGuardada): void;
}

let remoto: RemotoDoGuardado | null = null;
/** Liga o banco (no site com banco; no modo desenvolvedor e nos exemplos, não). */
export function ligarGuardadoRemoto(r: RemotoDoGuardado | null) { remoto = r; }

/** A empresa aberta: o id (a pasta no remoto) e os pedaços que aparecem nas chaves dela (o código, o nome). */
let aberta: { id: string; marcas: string[] } | null = null;

/** A chave é da empresa aberta? (as chaves levam o código ou o nome dela) */
const daAberta = (chave: string) => !!aberta && chave.split('|').some(p => aberta!.marcas.includes(p));

// o banco recebe o último valor de cada chave depois de 0,8 s parado (antes, cada clique mandava o valor inteiro na hora);
// ao fechar ou esconder a aba, manda o que falta na hora
const pendentes = new Map<string, { id: string; e: EntradaGuardada }>();
let espera: ReturnType<typeof setTimeout> | null = null;
function descarregar() {
  if (espera) { clearTimeout(espera); espera = null; }
  const lista = [...pendentes.values()];
  pendentes.clear();
  for (const p of lista) remoto?.gravar(p.id, p.e);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', descarregar);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') descarregar(); });
}

function mandarAoRemoto(chave: string, v: unknown, em: number) {
  if (!remoto || !aberta || !daAberta(chave)) return;
  pendentes.set(aberta.id + '|' + chave, { id: aberta.id, e: { chave, em, v: v === undefined ? null : v } });
  if (!espera) espera = setTimeout(descarregar, 800);
}

/**
 * Abre a empresa no guardado (o Executor e a Importação da Tarefa): o que for dela vai também para o banco e, ao abrir,
 * o mais novo do banco volta para este navegador. id: a pasta (o nome em slug); marcas: o código e o nome.
 */
export function useEscopoDoGuardado(id: string | null, marcas: readonly (string | number | null | undefined)[]) {
  const chave = id ? id + '|' + marcas.join('|') : '';
  useEffect(() => {
    if (!id) return;
    const lista = marcas.filter((m): m is string | number => m != null && m !== '').map(String);
    aberta = { id, marcas: lista };
    let vivo = true;
    if (remoto) {
      void remoto.carregar(id).then(entradas => {
        if (!vivo) return;
        const mudou: string[] = [];
        for (const e of entradas) {
          let local: Guardado | null = null;
          try { const b = localStorage.getItem(PREFIXO + e.chave); local = b ? JSON.parse(b) as Guardado : null; } catch { /* estragado */ }
          if (local && local.em >= e.em) continue;
          gravar(e.chave, e.v, e.em, true);
          mudou.push(e.chave);
        }
        if (mudou.length) mudouDeFora(mudou);
      }).catch(() => { /* sem o banco: fica o deste navegador */ });
    }
    return () => { vivo = false; descarregar(); if (aberta?.id === id) aberta = null; };
  // as marcas entram pela chave
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
}

/**
 * Como o useState, mas guardado pela chave (null = não guarda: só na tela). Trocou a chave, volta o guardado dela. O
 * valor tem de ser dado puro (sem File, Map, Date): vai como JSON. O remoto ou outra aba mudou: relê.
 */
export function useGuardado<T>(chave: string | null, inicial: T): [T, (v: SetStateAction<T>) => void] {
  const daChave = useCallback(() => (chave ? versoes.get(chave) || 0 : 0), [chave]);
  const ver = useSyncExternalStore(assinar, daChave, daChave);
  const [estado, setEstado] = useState<{ chave: string | null; ver: number; v: T }>(() => ({ chave, ver, v: chave ? ler<T>(chave) ?? inicial : inicial }));
  // a chave mudou (outra empresa, outro período), ou veio coisa nova de fora: o guardado dela
  let atual = estado;
  if (estado.chave !== chave || estado.ver !== ver) {
    atual = { chave, ver, v: chave ? ler<T>(chave) ?? inicial : inicial };
    setEstado(atual);
  }
  const mudar = useCallback((x: SetStateAction<T>) => {
    setEstado(e => {
      const v = typeof x === 'function' ? (x as (a: T) => T)(e.chave === chave ? e.v : (chave ? ler<T>(chave) ?? inicial : inicial)) : x;
      if (chave) gravar(chave, v);
      return { chave, ver: e.ver, v };
    });
  // o inicial é o da primeira vez (como no useState)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return [atual.v, mudar];
}
