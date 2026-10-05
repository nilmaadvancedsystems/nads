// Cadastro › Novo usuário: o formulário do "Criar acesso" do Entregas — a pessoa entra no nads e no Entregas com o
// nome e a senha daqui. À direita, o resumo da conta (o login e os papéis) e quem foi criado agora.
import { Icone } from '@nads/ui';
import { useNovoUsuario } from './useNovoUsuario';

export function NovoUsuario() {
  const vm = useNovoUsuario();
  return (
    <section className="novo-usuario">
      <form className="card novo-usuario-form" onSubmit={ev => { ev.preventDefault(); void vm.criar(); }}>
        <div className="card-head"><h3>Dados da pessoa</h3></div>
        {!vm.admin && <p className="hint">Só um administrador cadastra pessoas.</p>}
        <div className="novo-usuario-campos">
          <label className="novo-usuario-campo">
            <span>Nome</span>
            <input type="text" value={vm.nome} onChange={ev => vm.setNome(ev.target.value)} placeholder="Como a pessoa vai entrar (ex.: Maria Souza)" autoComplete="off" disabled={!vm.admin} />
          </label>
          <label className="novo-usuario-campo">
            <span>Senha</span>
            <input type="password" value={vm.senha} onChange={ev => vm.setSenha(ev.target.value)} placeholder="Pelo menos 6 caracteres" autoComplete="new-password" disabled={!vm.admin} />
          </label>
          <label className="novo-usuario-campo">
            <span>Departamento</span>
            <select value={vm.departamento} onChange={ev => vm.setDepartamento(ev.target.value as typeof vm.departamento)} disabled={!vm.admin}>
              <option value="">Escolha…</option>
              {vm.departamentos.map(d => <option key={d.id} value={d.id}>{d.rotulo}</option>)}
            </select>
          </label>
          <label className="novo-usuario-campo">
            <span>Nível</span>
            <select value={vm.nivel} onChange={ev => vm.setNivel(ev.target.value as typeof vm.nivel)} disabled={!vm.admin}>
              <option value="">Escolha…</option>
              {vm.niveis.map(n => <option key={n.id} value={n.id}>{n.rotulo}</option>)}
            </select>
          </label>
        </div>
        <div className="novo-usuario-campo">
          <span>Papéis a mais</span>
          <span className="usuarios-papeis">
            {vm.extras.map(x => (
              <button key={x.id} type="button" className={'chip-f' + (x.on ? ' on' : '')} aria-pressed={x.on} disabled={!vm.admin} onClick={() => vm.alternarExtra(x.id)}>{x.rotulo}</button>
            ))}
          </span>
        </div>
        {vm.erros.length > 0 && <ul className="novo-usuario-erros">{vm.erros.map(e => <li key={e}>{e}</li>)}</ul>}
        <div className="novo-usuario-pe">
          <button type="submit" className="btn btn-primary" disabled={!vm.admin || vm.criando}>
            {vm.criando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="plus" />}Criar acesso
          </button>
        </div>
      </form>
      <aside className="novo-usuario-lado">
        <div className="card">
          <div className="card-head"><h3>A conta</h3></div>
          <dl className="novo-usuario-resumo">
            <dt>Login</dt><dd>{vm.login || <span className="fraco">o nome vira o login</span>}</dd>
            <dt>Papéis</dt><dd>{vm.papeis.length ? vm.papeis.join(', ') : <span className="fraco">vêm do departamento e do nível</span>}</dd>
          </dl>
          <p className="fraco">A pessoa entra no nads e no Entregas com o nome (ou o login) e a senha. Depois, em Usuários, dá para mudar o
            cargo, os papéis e desativar a conta.{vm.exemplos ? ' (Dados de exemplo: a conta não é criada de verdade.)' : ''}</p>
        </div>
        {vm.criados.length > 0 && (
          <div className="card">
            <div className="card-head"><h3>Criados agora</h3></div>
            <ul className="novo-usuario-criados">{vm.criados.map(c => <li key={c.login}><Icone nome="checkCircle" /><b>{c.nome}</b><span className="fraco">{c.login}</span></li>)}</ul>
          </div>
        )}
      </aside>
    </section>
  );
}
