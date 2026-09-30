// Entrada da Tarefas (30/09/2026): o mesmo nome e a mesma senha do Entregas.
import { MarcaN } from '@nads/ui';
import { VERSAO_SISTEMA } from '../../../../versao';
import type { Sessao } from '../../dados/sessao';
import { useEntrar } from './useEntrar';

export function Entrar({ sessao }: { sessao: Sessao }) {
  const vm = useEntrar(sessao);
  return (
    <div id="login">
      <div className="auth">
        <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
        {vm.carregando ? (
          <p className="hint" style={{ textAlign: 'center' }}><span className="btn-spinner" /> Abrindo…</p>
        ) : vm.semDepartamento ? (
          <>
            <h1 className="auth-title">Falta o seu departamento</h1>
            <div className="auth-box">
              <p style={{ margin: 0 }}>Olá, <b>{vm.semDepartamento.nome}</b>. A sua conta ainda não diz se você é do Contábil, do Fiscal ou do DP. Peça ao admin para completar o seu cargo no Entregas.</p>
            </div>
            <button className="btn btn-outline" type="button" onClick={vm.sair}>Sair da conta</button>
          </>
        ) : (
          <>
            <h1 className="auth-title">Entrar na Tarefas</h1>
            <form className="auth-box" onSubmit={e => { e.preventDefault(); void vm.entrar(); }}>
              <div className="field">
                <label htmlFor="fLogin">Nome</label>
                <input id="fLogin" type="text" autoComplete="username" autoFocus value={vm.login} onChange={e => vm.setLogin(e.target.value)} />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="fSenha">Senha</label>
                <input id="fSenha" type="password" autoComplete="current-password" value={vm.senha} onChange={e => vm.setSenha(e.target.value)} />
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
