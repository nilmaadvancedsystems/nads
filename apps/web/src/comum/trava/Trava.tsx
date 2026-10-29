// A trava de acesso (29/10/2026): antes do aplicativo, a entrada com o nome e a senha do Entregas; depois,
// só passa quem tem o papel que a tabela de acesso libera. Mesmo visual da entrada da Tarefas.
import type { usuarios } from '@nads/core';
import { AberturaN, MarcaN } from '@nads/ui';
import type { ReactNode } from 'react';
import { VERSAO_SISTEMA } from '../../versao';
import { useTrava, type PortaDaTrava } from './useTrava';

export function Trava({ porta, recursos, nome, children }: {
  porta: PortaDaTrava | null;
  recursos: readonly usuarios.Recurso[];
  /** o nome do aplicativo, para os títulos ("Entrar no Concilia aí") */
  nome: string;
  children: ReactNode;
}) {
  const vm = useTrava(porta, recursos);
  if (vm.fase === 'aberta') return <>{children}</>;
  // abrindo: só a abertura do N, grande e no meio da tela
  if (vm.fase === 'carregando') return <AberturaN />;
  return (
    <div id="login">
      <div className="auth">
        <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
        {vm.semAcesso ? (
          <>
            <h1 className="auth-title">Sem acesso ao {nome}</h1>
            <div className="auth-box">
              <p style={{ margin: 0 }}>Olá, <b>{vm.semAcesso.nome}</b> ({vm.semAcesso.cargo}). O {nome} é só para quem tem o papel <b>{vm.papeisQueLiberam}</b>. Se você precisa usar, peça a um admin para liberar em Tarefas › Cadastro › Usuários.</p>
            </div>
            <button className="btn btn-outline" type="button" onClick={vm.sair}>Sair da conta</button>
          </>
        ) : (
          <>
            <h1 className="auth-title">Entrar no {nome}</h1>
            <form className="auth-box" onSubmit={e => { e.preventDefault(); void vm.entrar(); }}>
              <div className="field">
                <label htmlFor="fTravaLogin">Nome</label>
                <input id="fTravaLogin" type="text" autoComplete="username" autoFocus value={vm.login} onChange={e => vm.setLogin(e.target.value)} />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="fTravaSenha">Senha</label>
                <input id="fTravaSenha" type="password" autoComplete="current-password" value={vm.senha} onChange={e => vm.setSenha(e.target.value)} />
              </div>
              {vm.erro && <p className="hint" role="alert" style={{ color: 'var(--danger)', marginBottom: 0 }}>{vm.erro}</p>}
              <button className="btn btn-primary" type="submit" disabled={!vm.podeEntrar} style={{ width: '100%', marginTop: 16 }}>
                {vm.entrando ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
            <p className="auth-foot">Use o mesmo nome e a mesma senha do Entregas.<br />Versão do sistema: {VERSAO_SISTEMA}</p>
          </>
        )}
      </div>
    </div>
  );
}
