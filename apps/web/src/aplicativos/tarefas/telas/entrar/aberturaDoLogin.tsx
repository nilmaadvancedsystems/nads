// A abertura completa ao entrar (Vitor, 02/10/2026: "quando o usuário colocar usuário e senha, carregue a animação
// completa", a CR-04): começa no clique em Entrar e fica por cima até terminar (uns 4 s), mesmo com a tela trocando
// por baixo (a entrada vira o app). Senha errada: some na hora.
import { AberturaN } from '@nads/ui';
import { useSyncExternalStore } from 'react';

let ativa = false;
let t: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();
const mudar = (v: boolean) => { ativa = v; ouvintes.forEach(f => f()); };

export function comecarAberturaDoLogin(): void {
  if (t) clearTimeout(t);
  mudar(true);
  t = setTimeout(() => { t = null; mudar(false); }, 4200);
}

export function pararAberturaDoLogin(): void {
  if (t) clearTimeout(t);
  t = null;
  mudar(false);
}

export function AberturaDoLogin() {
  const v = useSyncExternalStore(f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => ativa, () => false);
  return v ? <AberturaN inteira /> : null;
}
