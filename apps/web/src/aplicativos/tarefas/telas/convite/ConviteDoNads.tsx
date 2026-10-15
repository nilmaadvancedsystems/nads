// A página do convite (/tarefas/convite/<código>, sem login; 15/10/2026): o mesmo desenho da entrada (Entrar.tsx). O de
// cadastro pede o nome e a senha; o de nova senha, só a senha. No fim, o botão leva para entrar no nads.
import { AberturaN, MarcaN } from '@nads/ui';
import { Link, useParams } from 'react-router';
import { BASE } from '../../casca/navegacao';
import { useConvite } from './useConvite';

export function ConviteDoNads() {
  const { codigo = '' } = useParams();
  const vm = useConvite(codigo);
  if (vm.carregando) return <AberturaN />;
  const novo = vm.tipo === 'novo';
  return (
    <div id="login">
      <div className="auth">
        <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
        {vm.problema ? (
          <>
            <h1 className="auth-title">Link sem efeito</h1>
            <div className="auth-box"><p style={{ margin: 0 }}>{vm.problema}</p></div>
          </>
        ) : vm.pronto ? (
          <>
            <h1 className="auth-title">{novo ? 'Conta criada' : 'Senha trocada'}</h1>
            <div className="auth-box">
              <p style={{ margin: 0 }}>
                {novo ? <>Pronto. Para entrar, use o nome <b>{vm.pronto.login}</b> e a senha que você escolheu.</> : <>Pronto, {vm.pronto.login}. Entre com a senha nova.</>}
              </p>
              <Link className="btn btn-primary" to={BASE} style={{ width: '100%', marginTop: 16 }}>Entrar no nads</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-title">{novo ? 'Criar a sua conta' : 'Escolher a senha nova'}</h1>
            <form className="auth-box" onSubmit={e => { e.preventDefault(); void vm.enviar(); }}>
              <p className="hint" style={{ marginTop: 0 }}>
                {novo
                  ? <>Convite para a equipe{vm.cargo ? <> · <b>{vm.cargo}</b></> : null}. O seu nome vira o login do nads e do Entregas.</>
                  : <>Para <b>{vm.paraQuem}</b>. Depois, entre com ela no nads e no Entregas.</>}
              </p>
              {novo && (
                <div className="field">
                  <label htmlFor="cNome">Nome</label>
                  <input id="cNome" type="text" autoComplete="username" autoFocus value={vm.nome} onChange={e => vm.setNome(e.target.value)} placeholder="Ex.: Maria Souza" />
                  {vm.login && <span className="hint">Você vai entrar como <b>{vm.login}</b></span>}
                </div>
              )}
              <div className="field" style={{ marginTop: novo ? 12 : 0 }}>
                <label htmlFor="cSenha">Senha</label>
                <input id="cSenha" type="password" autoComplete="new-password" autoFocus={!novo} value={vm.senha} onChange={e => vm.setSenha(e.target.value)} />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="cRepetir">Repita a senha</label>
                <input id="cRepetir" type="password" autoComplete="new-password" value={vm.repetir} onChange={e => vm.setRepetir(e.target.value)} />
              </div>
              {(vm.faltas.length > 0 || vm.erro) && <p className="hint" role="alert" style={{ color: 'var(--danger)', marginBottom: 0 }}>{vm.erro || vm.faltas[0]}</p>}
              <button className="btn btn-primary" type="submit" disabled={vm.enviando} style={{ width: '100%', marginTop: 16 }}>
                {vm.enviando ? (novo ? 'Criando…' : 'Trocando…') : novo ? 'Criar conta' : 'Trocar a senha'}
              </button>
            </form>
            <p className="auth-foot">O link vale 24 horas e uma vez só.</p>
          </>
        )}
      </div>
    </div>
  );
}
