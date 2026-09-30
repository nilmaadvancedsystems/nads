// A sessão da Tarefas ao vivo (o login com as contas do Entregas; null nos exemplos, onde não há login).
import { useSyncExternalStore } from 'react';
import type { EstadoSessao } from './entregas.firestore';
import { sessaoDaTarefas } from './fonte';

const nada = () => () => {};
const zero = () => 0;

export interface Sessao extends EstadoSessao {
  entrar: (login: string, senha: string) => Promise<void>;
  sair: () => void;
}

export function useSessao(): Sessao | null {
  const s = sessaoDaTarefas();
  useSyncExternalStore(s ? s.assinar : nada, s ? s.versao : zero, s ? s.versao : zero);
  if (!s) return null;
  return { ...s.estado(), entrar: (l, p) => s.entrar(l, p), sair: () => { void s.sair(); } };
}
