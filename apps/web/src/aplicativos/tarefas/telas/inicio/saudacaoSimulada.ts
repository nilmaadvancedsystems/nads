// A saudação simulada do ⚡ do Início (o modo desenvolvedor; 13/11/2026: "No ⚡ Dados de teste, uma opção para simular hora,
// dia e aniversário"): o turno, a segunda-feira e o aniversário de mentira, e o "Outra frase" (troca a escolhida). Fica só nesta
// aba do navegador (sessionStorage); fora do modo desenvolvedor não vale.
import { useSyncExternalStore } from 'react';
import type { tarefas } from '@nads/core';

export interface SaudacaoSimulada { turno?: tarefas.saudacao.Turno; segunda?: boolean; aniversario?: 'mes' | 'dia'; troca?: number }

const CHAVE = 'nads-saudacao-simulada';
const ouvintes = new Set<() => void>();
let cache: { texto: string; valor: SaudacaoSimulada } = { texto: '', valor: {} };

function ler(): SaudacaoSimulada {
  let texto = '';
  try { texto = sessionStorage.getItem(CHAVE) || ''; } catch { /* sem armazenamento: sem simulação */ }
  if (texto !== cache.texto) {
    try { cache = { texto, valor: texto ? (JSON.parse(texto) as SaudacaoSimulada) : {} }; } catch { cache = { texto, valor: {} }; }
  }
  return cache.valor;
}

export function simularSaudacao(mudar: Partial<SaudacaoSimulada> | null) {
  const novo = mudar ? { ...ler(), ...mudar } : {};
  try { if (Object.keys(novo).length) sessionStorage.setItem(CHAVE, JSON.stringify(novo)); else sessionStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
  for (const f of ouvintes) f();
}

export function useSaudacaoSimulada(): SaudacaoSimulada {
  return useSyncExternalStore(f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, ler, ler);
}

const HORA_DO_TURNO = { manha: 9, tarde: 15, noite: 21 } as const;

/** A hora e o aniversário de verdade, trocados pelo que está simulado. */
export function aplicarSimulacao(agora: Date, aniversario: string, s: SaudacaoSimulada): { agora: Date; aniversario: string } {
  const d = new Date(agora);
  if (s.segunda) d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (s.turno) d.setHours(HORA_DO_TURNO[s.turno], 0, 0, 0);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  // no mês do aniversário: outro dia do mesmo mês (o dia 1, ou o 2 quando hoje é dia 1)
  const outroDia = d.getDate() === 1 ? '02' : '01';
  return { agora: d, aniversario: s.aniversario === 'dia' ? mm + '-' + dd : s.aniversario === 'mes' ? mm + '-' + outroDia : aniversario };
}
