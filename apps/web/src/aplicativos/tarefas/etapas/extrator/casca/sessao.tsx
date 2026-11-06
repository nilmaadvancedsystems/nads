// Sessão da empresa aberta na Importação (a etapa da Tarefa; Vitor, 06/11/2026: o Extrator saiu do Extratudo e ficou só
// aqui): a empresa guardada no Extrator e aplicar() para gravar. Zera ao trocar de empresa.
import type { extrator as x } from '@nads/core';
import { createContext, useContext, type ReactNode } from 'react';
import { useAplicar, useEmpresa } from '../dados/repo';

export interface Sessao {
  nome: string;
  rota: string;
  codigo: number | null;
  empresa: x.EmpresaExtrator;
  aplicar: (acao: (e: x.EmpresaExtrator) => x.EmpresaExtrator) => x.EmpresaExtrator;
}

const Ctx = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSessao fora da empresa aberta');
  return s;
}

export function SessaoProvider({ nome, rota, codigo, children }: { nome: string; rota: string; codigo: number | null; children: ReactNode }) {
  const empresa = useEmpresa(nome);
  const aplicar = useAplicar(nome);
  return <Ctx.Provider value={{ nome, rota, codigo, empresa, aplicar }}>{children}</Ctx.Provider>;
}
