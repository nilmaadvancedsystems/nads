// As janelas flutuantes de Cadastro › Usuários, no desenho da Minha página (o Notion): à esquerda quem é, à direita
// cartões com uma opção por linha. JanelaDoUsuario: o cargo, os papéis, a conta ativa e os computadores liberados de
// uma pessoa (só o admin muda). JanelaNovoUsuario: criar o acesso (o "Criar acesso" do Entregas). Fecham no ×, no Esc e
// clicando fora.
import type { usuarios } from '@nads/core';
import { Icone, Interruptor } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { useNovoUsuario } from './useNovoUsuario';
import type { VmUsuarios } from './useUsuariosDoNads';

function Linha({ rotulo, dica, children }: { rotulo: string; dica?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pessoal-linha">
      <div className="pessoal-linha-texto"><b>{rotulo}</b>{dica && <span className="fraco">{dica}</span>}</div>
      {children != null && <div className="pessoal-linha-controle">{children}</div>}
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="card pessoal-cartao"><div className="card-head"><h3>{titulo}</h3></div>{children}</section>;
}

/** A moldura: o fundo (clicar fora fecha), a lateral com quem é e o conteúdo com o título, o × e o pé (opcional). */
function Janela({ titulo, lado, pe, fechar, children }: { titulo: string; lado: ReactNode; pe?: ReactNode; fechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pessoal-janela usuario-janela" role="dialog" aria-modal="true" aria-label={titulo}>
        <aside className="pessoal-lado usuario-lado">{lado}</aside>
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <h2>{titulo}</h2>
            <button type="button" className="drawer-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" /></button>
          </header>
          <div className="pessoal-rola">{children}</div>
          {pe && <footer className="usuario-pe">{pe}</footer>}
        </section>
      </div>
    </div>
  );
}

function Foto({ foto, iniciais }: { foto?: string | null; iniciais: string }) {
  return foto ? <img className="pessoal-foto grande" src={foto} alt="" /> : <span className="pessoal-foto grande pessoal-iniciais" aria-hidden="true">{iniciais}</span>;
}

export function JanelaDoUsuario({ vm }: { vm: VmUsuarios }) {
  const p = vm.pessoa;
  if (!p) return null;
  return (
    <Janela titulo={p.nome} fechar={vm.fechar} lado={(
      <div className="usuario-quem">
        <Foto foto={p.fotoPerfil} iniciais={p.iniciais} />
        <b>{p.nome}</b>
        <span className="fraco">{p.email}</span>
        <span className={'badge ' + (p.ativo ? 'badge-ok' : 'badge-neutral')}>{p.ativo ? 'Ativo' : 'Inativo'}</span>
        <span className="fraco">{p.cargo || 'Sem cargo'}</span>
      </div>
    )}>
      {!vm.admin && <p className="hint">Só um administrador muda a equipe.</p>}
      <Cartao titulo="Cargo">
        <Linha rotulo="Departamento" dica="A rotina que a pessoa faz na Tarefas.">
          <select className="pessoal-select" value={p.departamento || ''} disabled={!vm.admin} aria-label="Departamento"
            onChange={ev => void vm.mudarCargo(p, (ev.target.value || null) as usuarios.Departamento | null, p.nivel)}>
            <option value="">—</option>
            {vm.departamentos.map(d => <option key={d.id} value={d.id}>{d.rotulo}</option>)}
          </select>
        </Linha>
        <Linha rotulo="Nível" dica="Diretor também vira administrador.">
          <select className="pessoal-select" value={p.nivel || ''} disabled={!vm.admin} aria-label="Nível"
            onChange={ev => void vm.mudarCargo(p, p.departamento, (ev.target.value || null) as usuarios.Nivel | null)}>
            <option value="">—</option>
            {vm.niveis.map(n => <option key={n.id} value={n.id}>{n.rotulo}</option>)}
          </select>
        </Linha>
      </Cartao>
      <Cartao titulo="Papéis">
        {vm.papeis.map(x => (
          <Linha key={x.id} rotulo={x.rotulo} dica={x.dica}>
            <Interruptor ligado={p.papeis.includes(x.id)} onMudar={() => void vm.alternarPapel(p, x.id)} rotulo={x.rotulo + ' de ' + p.nome} />
          </Linha>
        ))}
      </Cartao>
      <Cartao titulo="Acesso">
        <Linha rotulo="Conta ativa" dica="Desativada, a pessoa não entra no nads nem no Entregas.">
          <Interruptor ligado={p.ativo} onMudar={() => void vm.ativar(p)} rotulo={(p.ativo ? 'Desativar ' : 'Ativar ') + p.nome} />
        </Linha>
        <Linha rotulo="Computadores liberados" dica={p.computadores.length ? 'Revogar faz aquele computador pedir liberação de novo (com outro código).'
          : 'Nenhum (a proteção do login só pede liberação quando está ligada).'}>{p.computadores.length}</Linha>
        {p.computadores.length > 0 && (
          <ul className="usuario-pcs">
            {p.computadores.map(s => (
              <li key={s.id}>
                <Icone nome="monitor" /><span>{s.computador}</span><span className="fraco">liberado em {vm.quando(s.liberadoEm)}</span>
                {vm.admin && <button type="button" className="btn btn-outline" onClick={() => void vm.revogar(s)}>Revogar</button>}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </Janela>
  );
}

export function JanelaNovoUsuario({ fechar }: { fechar: () => void }) {
  const vm = useNovoUsuario(fechar);
  return (
    <Janela titulo="Novo usuário" fechar={fechar}
      lado={(
        <div className="usuario-quem">
          <Foto iniciais={vm.iniciais} />
          <b>{vm.nome.trim() || 'Pessoa nova'}</b>
          <span className="fraco">{vm.login || 'o nome vira o login'}</span>
          <span className="fraco">{vm.papeis.length ? vm.papeis.join(', ') : 'Os papéis vêm do departamento e do nível'}</span>
        </div>
      )}
      pe={(
        <>
          {vm.erros.length > 0 && <ul className="usuario-erros">{vm.erros.map(e => <li key={e}>{e}</li>)}</ul>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.criando} onClick={() => void vm.criar()}>
            {vm.criando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="plus" />}Criar acesso
          </button>
        </>
      )}>
      <Cartao titulo="Dados">
        <Linha rotulo="Nome" dica="Como a pessoa entra no nads e no Entregas.">
          <input className="usuario-campo" type="text" value={vm.nome} onChange={ev => vm.setNome(ev.target.value)} placeholder="Ex.: Maria Souza" autoComplete="off" autoFocus />
        </Linha>
        <Linha rotulo="Senha" dica="Pelo menos 6 caracteres; a pessoa troca depois em Minha conta.">
          <input className="usuario-campo" type="password" value={vm.senha} onChange={ev => vm.setSenha(ev.target.value)} autoComplete="new-password"
            onKeyDown={ev => { if (ev.key === 'Enter') void vm.criar(); }} />
        </Linha>
      </Cartao>
      <Cartao titulo="Cargo">
        <Linha rotulo="Departamento" dica="A rotina que a pessoa faz na Tarefas.">
          <select className="pessoal-select" value={vm.departamento} onChange={ev => vm.setDepartamento(ev.target.value as typeof vm.departamento)} aria-label="Departamento">
            <option value="">Escolha…</option>
            {vm.departamentos.map(d => <option key={d.id} value={d.id}>{d.rotulo}</option>)}
          </select>
        </Linha>
        <Linha rotulo="Nível" dica="Diretor também vira administrador.">
          <select className="pessoal-select" value={vm.nivel} onChange={ev => vm.setNivel(ev.target.value as typeof vm.nivel)} aria-label="Nível">
            <option value="">Escolha…</option>
            {vm.niveis.map(n => <option key={n.id} value={n.id}>{n.rotulo}</option>)}
          </select>
        </Linha>
      </Cartao>
      <Cartao titulo="Papéis a mais">
        {vm.extras.map(x => (
          <Linha key={x.id} rotulo={x.rotulo}>
            <Interruptor ligado={x.on} onMudar={() => vm.alternarExtra(x.id)} rotulo={x.rotulo} />
          </Linha>
        ))}
      </Cartao>
      {vm.exemplos && <p className="hint">Dados de exemplo: a conta não é criada de verdade.</p>}
    </Janela>
  );
}
