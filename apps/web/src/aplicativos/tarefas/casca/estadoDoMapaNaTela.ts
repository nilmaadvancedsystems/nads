// O mapa na tela (os botões pintados pelos cliques; pedido em 21/10/2026: "a tela com os botões coloridos"): o admin
// liga no Uso do sistema e passeia pelas telas de verdade, com cada controle pintado do frio ao quente. O estado fica
// nesta aba (sessionStorage), para continuar ligado ao trocar de tela e ao recarregar; com ele ligado, a coleta do uso
// para (os cliques de quem olha o mapa não entram na conta).
import { useSyncExternalStore } from 'react';

export type PeriodoDoMapa = '7' | '30' | '90';
export interface MapaLigado { periodo: PeriodoDoMapa }

const CHAVE = 'nads-mapa-na-tela';
const ouvintes = new Set<() => void>();

function ler(): MapaLigado | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE) || 'null') as MapaLigado | null;
    return v && (v.periodo === '7' || v.periodo === '30' || v.periodo === '90') ? v : null;
  } catch { return null; }
}

let atual = ler();

function mudar(v: MapaLigado | null) {
  atual = v;
  try { if (v) sessionStorage.setItem(CHAVE, JSON.stringify(v)); else sessionStorage.removeItem(CHAVE); } catch { /* sem sessionStorage, fica só na memória */ }
  for (const f of ouvintes) f();
}

export const ligarMapaNaTela = (periodo: PeriodoDoMapa) => mudar({ periodo });
export const desligarMapaNaTela = () => mudar(null);

/** o mapa na tela (null = desligado) */
export function useMapaNaTela(): MapaLigado | null {
  return useSyncExternalStore(f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => atual);
}
