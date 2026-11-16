// O ⚡ Dados de teste do e-mail principal (16/11/2026; Minha conta, só no modo desenvolvedor): abre a janela do e-mail
// principal ou a tela de entrada por e-mail com uma conta de mentira, sem gravar nem pedir nada ao robô.
import { useSyncExternalStore } from 'react';

/** 'so-nome': a conta que ainda entra pelo nome@nilma.local; 'com-email': a que já tem e-mail, falta só confirmar; 'entrada': a tela de entrada */
export type SimulacaoDoEmailPrincipal = 'so-nome' | 'com-email' | 'entrada' | null;

let atual: SimulacaoDoEmailPrincipal = null;
const ouvintes = new Set<() => void>();

export function simularEmailPrincipal(s: SimulacaoDoEmailPrincipal): void {
  atual = s;
  ouvintes.forEach(f => f());
}

export function useSimulacaoDoEmailPrincipal(): SimulacaoDoEmailPrincipal {
  return useSyncExternalStore(f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => atual, () => null);
}

/** a conta de mentira da simulação (sem nome de ninguém) */
export const EMAIL_DE_TESTE = { 'so-nome': 'fulana@nilma.local', 'com-email': 'fulana@exemplo.com' } as const;
