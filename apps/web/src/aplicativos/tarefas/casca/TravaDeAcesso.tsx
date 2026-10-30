// A trava de acesso (29/10/2026) do Concilia aí, do Conciliadorzinho e do Extratudo: antes do aplicativo, a entrada da
// Tarefas (o mesmo nome e a mesma senha do Entregas, como no Admin); depois, só passa quem tem o papel que a tabela de
// acesso libera. Os outros veem "Sem acesso", com o botão de sair. A proteção de verdade é a regra de cada banco.
import type { usuarios } from '@nads/core';
import { MarcaN } from '@nads/ui';
import type { ReactNode } from 'react';
import { AberturaDoLogin } from '../telas/entrar/aberturaDoLogin';
import { Entrar } from '../telas/entrar/Entrar';
import { useTravaDeAcesso } from './useTravaDeAcesso';

export function TravaDeAcesso({ recursos, nome, livre, children }: {
  recursos: readonly usuarios.Recurso[];
  /** o nome do aplicativo, para os títulos ("Entrar no Concilia aí") */
  nome: string;
  livre?: boolean;
  children: ReactNode;
}) {
  const vm = useTravaDeAcesso(recursos, livre);
  if (vm.fase === 'aberta') return <>{children}</>;
  return (
    <>
      {vm.fase === 'entrar' && vm.sessao ? <Entrar sessao={vm.sessao} titulo={'Entrar no ' + nome} /> : (
        <div id="login">
          <div className="auth">
            <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
            <h1 className="auth-title">Sem acesso ao {nome}</h1>
            <div className="auth-box">
              <p style={{ margin: 0 }}>Olá, <b>{vm.semAcesso?.nome}</b> ({vm.semAcesso?.cargo}). O {nome} é só para quem tem o papel <b>{vm.papeisQueLiberam}</b>. Se você precisa usar, peça a um admin para liberar em Tarefas › Cadastro › Usuários.</p>
            </div>
            <button className="btn btn-outline" type="button" onClick={vm.sair}>Sair da conta</button>
          </div>
        </div>
      )}
      <AberturaDoLogin />
    </>
  );
}
