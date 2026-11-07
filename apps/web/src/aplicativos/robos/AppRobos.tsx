// A Central dos robôs (Vitor, 07/11/2026: "um site para gerenciar os robôs, com a cara do Umbrel, para acessar de qualquer
// lugar, inclusive do celular"). O login é o mesmo da Tarefas e do Admin (a conta do Entregas, Firebase Auth do
// entregas-2e5e2); nos exemplos, a escolha do nome na lista da equipe. Só quem é admin passa. A proteção de verdade é a
// regra do banco (robosMaquinas, robosRegistros, robosComandos, robo/* e roboAtividade: só o admin).
import { usuarios } from '@nads/core';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { SoParaAdmin } from '../admin/casca/SoParaAdmin';
import { OperadorProvider, operadorDaConta, useOperador, type Operador } from '../tarefas/casca/operador';
import { useSessao } from '../tarefas/dados/sessao';
import { AberturaDoLogin } from '../tarefas/telas/entrar/aberturaDoLogin';
import { Entrar } from '../tarefas/telas/entrar/Entrar';
import { QuemSouEu } from '../tarefas/telas/quem/QuemSouEu';
import './robos.css';

function operadorDoAdmin(u: usuarios.Usuario): Operador {
  return operadorDaConta(u) ?? { nome: u.nome, departamento: 'contabil', nivel: u.nivel, admin: u.papeis.includes('admin'), desenvolvedor: u.papeis.includes('desenvolvedor') };
}

function SoAdmin({ children }: { children: ReactNode }) {
  const { operador, escolher, comLogin } = useOperador();
  if (!operador) return <QuemSouEu />;
  if (!operador.admin) return <SoParaAdmin nome={operador.nome} rotuloSair={comLogin ? 'Sair da conta' : 'Trocar de pessoa'} sair={() => escolher(null)} />;
  return <>{children}</>;
}

export function AppRobos() {
  const sessao = useSessao();
  const usuario = sessao?.usuario || null;
  return (
    <>
      {sessao && !usuario ? <Entrar sessao={sessao} titulo="Entrar na Central dos robôs" /> : (
        <OperadorProvider daConta={sessao && usuario ? { operador: operadorDoAdmin(usuario), sair: sessao.sair } : undefined}>
          <SoAdmin><Outlet /></SoAdmin>
        </OperadorProvider>
      )}
      <AberturaDoLogin />
    </>
  );
}
