// Quem está trabalhando. NÃO é login (a autenticação fica para depois): a pessoa escolhe o nome na
// lista da equipe, e ele vai em cada evento das tarefas. Preferência de quem usa: fica no navegador.
import { usuarios } from '@nads/core';
import { createContext, useContext, useState, type ReactNode } from 'react';

const CHAVE = 'nads-tarefas-operador';

export interface Operador { nome: string; departamento: usuarios.Departamento; nivel: usuarios.Nivel; admin: boolean }

function daEquipe(nome: string | null): Operador | null {
  const u = usuarios.EQUIPE_EXEMPLO.find(x => x.nome === nome);
  if (!u || !u.departamento || !u.nivel) return null;
  return { nome: u.nome, departamento: u.departamento, nivel: u.nivel, admin: u.papeis.includes('admin') };
}

function ler(): Operador | null {
  try { return daEquipe(localStorage.getItem(CHAVE)); } catch { return null; }
}

const Ctx = createContext<{ operador: Operador | null; escolher: (nome: string | null) => void } | null>(null);

export function OperadorProvider({ children }: { children: ReactNode }) {
  const [operador, setOperador] = useState<Operador | null>(ler);
  function escolher(nome: string | null) {
    try { if (nome) localStorage.setItem(CHAVE, nome); else localStorage.removeItem(CHAVE); } catch { /* vale só agora */ }
    setOperador(daEquipe(nome));
  }
  return <Ctx.Provider value={{ operador, escolher }}>{children}</Ctx.Provider>;
}

export function useOperador() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useOperador fora do OperadorProvider');
  return c;
}

/** A equipe para escolher (os nomes do documento da rotina, 22/09/2026). */
export const EQUIPE = usuarios.EQUIPE_EXEMPLO;
