// A página própria de criar a senha da Área do Cliente (19/11/2026; o dono, sobre a página "Senha alterada" do Firebase: "tem como melhorar isso?"):
// no lugar da página branca do Firebase ("Senha alterada" com um Continuar que não leva a lugar nenhum).
import { Icone } from '@nads/ui';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { useCriarSenha } from './useCriarSenha';
import '../cliente.css';
import './entrar.css';

export function CriarSenha() {
  const vm = useCriarSenha();
  return (
    <div className="cli-app cli-raiz cli-pagina-senha">
      <div className="card cli-entrar">
        <MarcaDoEscritorio tamanho={44} />
        {vm.conferindo ? <p className="cli-entrar-empresa">Conferindo o link…</p> : vm.erroDoLink ? (
          <>
            <h1>Link de senha</h1>
            <p className="cli-erro" role="alert">{vm.erroDoLink}</p>
          </>
        ) : vm.empresas ? (
          <>
            <h1>Senha criada</h1>
            {vm.empresas.length ? (
              <>
                <p className="cli-entrar-empresa">Escolha a empresa para abrir:</p>
                <div className="cli-senha-empresas">
                  {vm.empresas.map(e => <button key={e.token} type="button" className="btn" onClick={() => vm.abrir(e.token)}><Icone nome="predio" width={16} height={16} />{e.nome}</button>)}
                </div>
              </>
            ) : <p className="cli-entrar-dica">Pronto, a senha foi trocada. Se você é do escritório, volte ao nads e entre com ela; se é cliente, abra o link da sua empresa.</p>}
          </>
        ) : (
          <>
            <h1>Crie a sua senha</h1>
            <p className="cli-entrar-empresa">{vm.email}</p>
            <form className="cli-entrar-form" onSubmit={e => { e.preventDefault(); vm.gravar(); }}>
              <input type="email" autoComplete="username" value={vm.email} readOnly hidden />
              <label>
                <span>Senha nova</span>
                <input type="password" autoComplete="new-password" value={vm.senha} onChange={e => vm.mudarSenha(e.target.value)} />
              </label>
              <label>
                <span>Repita a senha</span>
                <input type="password" autoComplete="new-password" value={vm.repetida} onChange={e => vm.mudarRepetida(e.target.value)} />
              </label>
              <p className="cli-entrar-dica">Pelo menos 8 caracteres, com letras e números.</p>
              {vm.erro && <p className="cli-erro" role="alert">{vm.erro}</p>}
              <button type="submit" className="btn btn-primary" disabled={vm.gravando}>{vm.gravando ? 'Gravando…' : 'Gravar a senha e entrar'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
