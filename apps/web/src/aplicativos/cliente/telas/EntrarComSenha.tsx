// A tela de entrar da Área do Cliente (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma por
// pessoa"): aparece quando o link pede senha. O e-mail, a senha, o Entrar e o "Criar ou trocar a senha".
import { Icone } from '@nads/ui';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { useEntrarComSenha } from './useEntrarComSenha';
import './entrar.css';

export function EntrarComSenha({ token, nome }: { token: string; nome: string }) {
  const vm = useEntrarComSenha(token);
  return (
    <div className="card cli-entrar">
      <MarcaDoEscritorio tamanho={44} />
      <h1>Entrar na Área do Cliente</h1>
      {nome && <p className="cli-entrar-empresa">{nome}</p>}
      <form className="cli-entrar-form" onSubmit={e => { e.preventDefault(); vm.entrar(); }}>
        <label>
          <span>E-mail</span>
          <input type="email" autoComplete="username" value={vm.email} onChange={e => vm.mudarEmail(e.target.value)} placeholder="o e-mail que você deu ao escritório" />
        </label>
        <label>
          <span>Senha</span>
          <input type="password" autoComplete="current-password" value={vm.senha} onChange={e => vm.mudarSenha(e.target.value)} />
        </label>
        {vm.erro && <p className="cli-erro" role="alert">{vm.erro}</p>}
        {vm.aviso && <p className="cli-entrar-aviso" role="status"><Icone nome="envelope" width={16} height={16} />{vm.aviso}</p>}
        <button type="submit" className="btn btn-primary" disabled={vm.ocupado}>{vm.ocupado ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <button type="button" className="cli-link-mini" disabled={vm.ocupado} onClick={vm.criarSenha}>Primeiro acesso ou esqueceu? Criar ou trocar a senha</button>
      <p className="cli-entrar-dica">A senha é sua: o escritório não vê nem escolhe. Se ainda não tem acesso, peça ao escritório para incluir o seu e-mail.</p>
    </div>
  );
}
