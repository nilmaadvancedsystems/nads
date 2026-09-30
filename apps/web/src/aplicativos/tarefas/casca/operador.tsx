// Quem está trabalhando: o nome vai em cada evento das tarefas; o departamento escolhe a rotina.
// No banco, vem do login com a conta do Entregas (AppTarefas passa em `daConta`); nos exemplos, a
// pessoa escolhe o nome na lista da equipe (fica no navegador).
import { usuarios } from '@nads/core';
import { createContext, useContext, useState, type ReactNode } from 'react';

const CHAVE = 'nads-tarefas-operador';

export interface Operador { nome: string; departamento: usuarios.Departamento; nivel: usuarios.Nivel | null; admin: boolean }

/** A pessoa da conta do Entregas como operador (null = a conta não diz o departamento). */
export function operadorDaConta(u: usuarios.Usuario): Operador | null {
  const departamento = usuarios.departamentoDaConta(u);
  if (!departamento) return null;
  return { nome: u.nome, departamento, nivel: u.nivel, admin: u.papeis.includes('admin') };
}

function daEquipe(nome: string | null): Operador | null {
  const u = usuarios.EQUIPE_EXEMPLO.find(x => x.nome === nome);
  if (!u || !u.departamento || !u.nivel) return null;
  return { nome: u.nome, departamento: u.departamento, nivel: u.nivel, admin: u.papeis.includes('admin') };
}

function ler(): Operador | null {
  try { return daEquipe(localStorage.getItem(CHAVE)); } catch { return null; }
}

/** comLogin: quem está é a conta do Entregas, e "escolher(null)" é sair da conta. */
const Ctx = createContext<{ operador: Operador | null; escolher: (nome: string | null) => void; comLogin: boolean } | null>(null);

export function OperadorProvider({ children, daConta }: { children: ReactNode; daConta?: { operador: Operador; sair: () => void } }) {
  const [escolhido, setEscolhido] = useState<Operador | null>(ler);
  function escolher(nome: string | null) {
    if (daConta) { if (!nome) daConta.sair(); return; }
    try { if (nome) localStorage.setItem(CHAVE, nome); else localStorage.removeItem(CHAVE); } catch { /* vale só agora */ }
    setEscolhido(daEquipe(nome));
  }
  const operador = daConta ? daConta.operador : escolhido;
  return <Ctx.Provider value={{ operador, escolher, comLogin: !!daConta }}>{children}</Ctx.Provider>;
}

export function useOperador() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useOperador fora do OperadorProvider');
  return c;
}

/** A equipe para escolher (os nomes do documento da rotina, 22/09/2026). */
export const EQUIPE = usuarios.EQUIPE_EXEMPLO;
