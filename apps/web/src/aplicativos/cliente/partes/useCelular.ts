// A Área do Cliente está numa tela de celular (até 767 px, o mesmo corte do cliente.css)? Acompanha a tela girar ou mudar.
import { useSyncExternalStore } from 'react';

const TELA_DE_CELULAR = '(max-width: 767px)';

export const ehCelular = () => typeof window !== 'undefined' && !!window.matchMedia?.(TELA_DE_CELULAR).matches;

function assinarTela(f: () => void) {
  const m = typeof window !== 'undefined' ? window.matchMedia?.(TELA_DE_CELULAR) : undefined;
  m?.addEventListener('change', f);
  return () => m?.removeEventListener('change', f);
}

export function useCelular(): boolean {
  return useSyncExternalStore(assinarTela, ehCelular, () => false);
}
