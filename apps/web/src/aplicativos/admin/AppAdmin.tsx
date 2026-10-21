// O site do admin (Vitor, 21/10/2026: "quero um site específico só para quem é admin, para ter acesso a desempenho do robô,
// uso de sistema, saúde do banco de dados e coisas assim"). O login é o mesmo da Tarefas (a conta do Entregas, Firebase Auth
// do entregas-2e5e2; tarefas/dados/sessao.ts); nos exemplos, a escolha do nome na lista da equipe. Só quem é admin passa:
// os outros veem "Só para administradores". A proteção de verdade é a regra do banco (só o admin lê o que este site mostra).
import { usuarios } from '@nads/core';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { OperadorProvider, operadorDaConta, useOperador, type Operador } from '../tarefas/casca/operador';
import { useSessao } from '../tarefas/dados/sessao';
import { AberturaDoLogin } from '../tarefas/telas/entrar/aberturaDoLogin';
import { Entrar } from '../tarefas/telas/entrar/Entrar';
import { QuemSouEu } from '../tarefas/telas/quem/QuemSouEu';
import { SoParaAdmin } from './casca/SoParaAdmin';
import './admin.css';

/**
 * A pessoa da conta como operador. O admin sem departamento no cargo (a Tarefas pede o departamento para montar a rotina)
 * entra assim mesmo: aqui o departamento não escolhe nada (as telas olham só o "admin").
 */
function operadorDoAdmin(u: usuarios.Usuario): Operador {
  return operadorDaConta(u) ?? { nome: u.nome, departamento: 'contabil', nivel: u.nivel, admin: u.papeis.includes('admin') };
}

function SoAdmin({ children }: { children: ReactNode }) {
  const { operador, escolher, comLogin } = useOperador();
  if (!operador) return <QuemSouEu />;
  if (!operador.admin) return <SoParaAdmin nome={operador.nome} rotuloSair={comLogin ? 'Sair da conta' : 'Trocar de pessoa'} sair={() => escolher(null)} />;
  return <>{children}</>;
}

export function AppAdmin() {
  const sessao = useSessao();
  // o repositório das rotinas da Tarefas (repoDaTarefas) nunca é criado aqui: ele ouviria as rotinas do escritório inteiro
  const usuario = sessao?.usuario || null;
  return (
    <>
      {sessao && !usuario ? <Entrar sessao={sessao} titulo="Entrar no Admin" /> : (
        <OperadorProvider daConta={sessao && usuario ? { operador: operadorDoAdmin(usuario), sair: sessao.sair } : undefined}>
          <SoAdmin><Outlet /></SoAdmin>
        </OperadorProvider>
      )}
      <AberturaDoLogin />
    </>
  );
}
