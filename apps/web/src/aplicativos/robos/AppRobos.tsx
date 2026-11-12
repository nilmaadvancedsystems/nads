// A Central dos robôs (Vitor, 07/11/2026: "um site para gerenciar os robôs, com a cara do Umbrel, para acessar de qualquer
// lugar, inclusive do celular"). O login é o mesmo da Tarefas e do Admin (a conta do Entregas, Firebase Auth do
// entregas-2e5e2); nos exemplos, a escolha do nome na lista da equipe. Passa o admin e quem tem um papel em robosPermissoes
// (10/11/2026: só olhar, comandar robôs marcados, administrar); os outros, não. A proteção de verdade é a regra do banco e a
// conferência do robô antes de executar (robo/central.js).
import { robos as r, usuarios } from '@nads/core';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { SoParaAdmin } from '../admin/casca/SoParaAdmin';
import { PermissaoContext, useAcesso } from './casca/useAcesso';
import { OperadorProvider, operadorDaConta, useOperador, type Operador } from '../tarefas/casca/operador';
import { useSessao } from '../tarefas/dados/sessao';
import { AberturaDoLogin } from '../tarefas/telas/entrar/aberturaDoLogin';
import { Entrar } from '../tarefas/telas/entrar/Entrar';
import { QuemSouEu } from '../tarefas/telas/quem/QuemSouEu';
import './robos.css';

function operadorDoAdmin(u: usuarios.Usuario): Operador {
  return operadorDaConta(u) ?? { nome: u.nome, departamento: 'contabil', nivel: u.nivel, admin: u.papeis.includes('admin'), desenvolvedor: u.papeis.includes('desenvolvedor') && u.nivel !== 'dono' };
}

function SoComAcesso({ children }: { children: ReactNode }) {
  const { operador, escolher, comLogin } = useOperador();
  const permissao = useAcesso(operador?.nome || null, !!operador?.admin);
  if (!operador) return <QuemSouEu />;
  if (!permissao) return null;
  if (!r.temAcesso(permissao)) return <SoParaAdmin nome={operador.nome} rotuloSair={comLogin ? 'Sair da conta' : 'Trocar de pessoa'} sair={() => escolher(null)} />;
  return <PermissaoContext.Provider value={permissao}>{children}</PermissaoContext.Provider>;
}

export function AppRobos() {
  const sessao = useSessao();
  const usuario = sessao?.usuario || null;
  return (
    <>
      {sessao && !usuario ? <Entrar sessao={sessao} titulo="Entrar na Central dos robôs" /> : (
        <OperadorProvider daConta={sessao && usuario ? { operador: operadorDoAdmin(usuario), sair: sessao.sair } : undefined}>
          <SoComAcesso><Outlet /></SoComAcesso>
        </OperadorProvider>
      )}
      <AberturaDoLogin />
    </>
  );
}
