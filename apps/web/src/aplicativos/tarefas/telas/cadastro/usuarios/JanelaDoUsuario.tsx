// As janelas flutuantes de Cadastro › Usuários, no desenho da Minha página (o Notion): à esquerda quem é e os tópicos
// (painéis laterais; Vitor, 05/10/2026: "isso também deve ser em painéis laterais"), à direita o tópico escolhido, em
// cartões com uma opção por linha. JanelaDoUsuario: Cargo, Papéis e Acesso de uma pessoa (só o admin muda).
// JanelaNovoUsuario: Dados, Cargo e Papéis do acesso novo, com o Criar acesso sempre no pé. Fecham no ×, no Esc e
// clicando fora.
import type { usuarios } from '@nads/core';
import { Icone, Interruptor, type NomeIcone } from '@nads/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useNovoUsuario } from './useNovoUsuario';
import type { VmUsuarios } from './useUsuariosDoNads';

interface Topico<T extends string> { id: T; rotulo: string; icone: NomeIcone; alerta?: boolean }

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

/** A moldura: o fundo (clicar fora fecha); à esquerda quem é e os tópicos; à direita o título do tópico, o × e o pé. */
function Janela<T extends string>({ rotulo, quem, topicos, topico, mudar, pe, fechar, children }: {
  rotulo: string; quem: ReactNode; topicos: Topico<T>[]; topico: T; mudar: (t: T) => void; pe?: ReactNode; fechar: () => void; children: ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const atual = topicos.find(t => t.id === topico) || topicos[0];
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pessoal-janela usuario-janela" role="dialog" aria-modal="true" aria-label={rotulo}>
        <aside className="pessoal-lado usuario-lado">
          {quem}
          <nav aria-label="Tópicos">
            {topicos.map(t => (
              <button key={t.id} type="button" className={'pessoal-topico' + (t.id === topico ? ' ativo' : '')} aria-current={t.id === topico ? 'page' : undefined} onClick={() => mudar(t.id)}>
                <Icone nome={t.icone} />{t.rotulo}
                {t.alerta && <span className="usuario-topico-alerta" aria-label="falta preencher" />}
              </button>
            ))}
          </nav>
        </aside>
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <h2>{atual.rotulo}</h2>
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

type TopicoDaPessoa = 'cargo' | 'papeis' | 'acesso';

export function JanelaDoUsuario({ vm }: { vm: VmUsuarios }) {
  const [topico, setTopico] = useState<TopicoDaPessoa>('cargo');
  const p = vm.pessoa;
  if (!p) return null;
  const topicos: Topico<TopicoDaPessoa>[] = [
    { id: 'cargo', rotulo: 'Cargo', icone: 'briefcase' },
    { id: 'papeis', rotulo: 'Papéis', icone: 'checklist' },
    { id: 'acesso', rotulo: 'Acesso', icone: 'lock' },
  ];
  return (
    <Janela rotulo={p.nome} topicos={topicos} topico={topico} mudar={setTopico} fechar={vm.fechar} quem={(
      <div className="usuario-quem">
        <Foto foto={p.fotoPerfil} iniciais={p.iniciais} />
        <b>{p.nome}</b>
        <span className="fraco">{p.email}</span>
        <span className={'badge ' + (p.online ? 'badge-ok' : 'badge-neutral')}>{!p.ativo ? 'Inativo' : p.online ? 'Online' : 'Ativo'}</span>
        {p.ativo && !p.online && <span className="fraco">{p.presenca}</span>}
        <span className="fraco">{p.cargo || 'Sem cargo'}</span>
      </div>
    )}>
      {!vm.admin && <p className="hint">Só um administrador muda a equipe.</p>}
      {topico === 'cargo' && (
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
      )}
      {topico === 'papeis' && (
        <Cartao titulo="Papéis">
          {vm.papeis.map(x => (
            <Linha key={x.id} rotulo={x.rotulo} dica={x.dica}>
              <Interruptor ligado={p.papeis.includes(x.id)} onMudar={() => void vm.alternarPapel(p, x.id)} rotulo={x.rotulo + ' de ' + p.nome} />
            </Linha>
          ))}
        </Cartao>
      )}
      {topico === 'acesso' && (
        <>
          <Cartao titulo="Conta">
            <Linha rotulo="No nads" dica="Online = o nads dela está aberto agora (ele avisa a cada 3 minutos).">
              <span className="usuarios-estado"><span className={'usuarios-ponto' + (p.online ? ' ok' : '')} aria-hidden="true" />{p.presenca}</span>
            </Linha>
            <Linha rotulo="Conta ativa" dica="Desativada, a pessoa não entra no nads nem no Entregas.">
              <Interruptor ligado={p.ativo} onMudar={() => void vm.ativar(p)} rotulo={(p.ativo ? 'Desativar ' : 'Ativar ') + p.nome} />
            </Linha>
          </Cartao>
          <Cartao titulo="Computadores liberados">
            {!p.computadores.length ? (
              <Linha rotulo="Nenhum" dica="A proteção do login só pede liberação quando está ligada (Configurações)." />
            ) : p.computadores.map(s => (
              <Linha key={s.id} rotulo={s.computador} dica={'Liberado em ' + vm.quando(s.liberadoEm)}>
                {vm.admin && <button type="button" className="btn btn-outline" onClick={() => void vm.revogar(s)}>Revogar</button>}
              </Linha>
            ))}
          </Cartao>
        </>
      )}
    </Janela>
  );
}

type TopicoDoNovo = 'dados' | 'cargo' | 'papeis';

export function JanelaNovoUsuario({ fechar }: { fechar: () => void }) {
  const vm = useNovoUsuario(fechar);
  const [topico, setTopico] = useState<TopicoDoNovo>('dados');
  // o que falta (depois de tentar criar) acende o tópico onde está
  const faltaDados = vm.erros.some(e => /nome|senha|acesso com esse nome/i.test(e));
  const faltaCargo = vm.erros.some(e => /departamento|nível/i.test(e));
  const topicos: Topico<TopicoDoNovo>[] = [
    { id: 'dados', rotulo: 'Dados', icone: 'usuario', alerta: faltaDados },
    { id: 'cargo', rotulo: 'Cargo', icone: 'briefcase', alerta: faltaCargo },
    { id: 'papeis', rotulo: 'Papéis a mais', icone: 'checklist' },
  ];
  return (
    <Janela rotulo="Novo usuário" topicos={topicos} topico={topico} mudar={setTopico} fechar={fechar}
      quem={(
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
          {topico !== 'papeis' && <button type="button" className="btn btn-outline" onClick={() => setTopico(topico === 'dados' ? 'cargo' : 'papeis')}>Próximo<Icone nome="chevronRight" /></button>}
          <button type="button" className="btn btn-primary" disabled={vm.criando} onClick={() => void vm.criar()}>
            {vm.criando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="plus" />}Criar acesso
          </button>
        </>
      )}>
      {topico === 'dados' && (
        <Cartao titulo="Dados">
          <Linha rotulo="Nome" dica="Como a pessoa entra no nads e no Entregas.">
            <input className="usuario-campo" type="text" value={vm.nome} onChange={ev => vm.setNome(ev.target.value)} placeholder="Ex.: Maria Souza" autoComplete="off" autoFocus />
          </Linha>
          <Linha rotulo="Senha" dica="Pelo menos 6 caracteres; a pessoa troca depois em Minha conta.">
            <input className="usuario-campo" type="password" value={vm.senha} onChange={ev => vm.setSenha(ev.target.value)} autoComplete="new-password"
              onKeyDown={ev => { if (ev.key === 'Enter') setTopico('cargo'); }} />
          </Linha>
        </Cartao>
      )}
      {topico === 'cargo' && (
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
      )}
      {topico === 'papeis' && (
        <Cartao titulo="Papéis a mais">
          {vm.extras.map(x => (
            <Linha key={x.id} rotulo={x.rotulo}>
              <Interruptor ligado={x.on} onMudar={() => vm.alternarExtra(x.id)} rotulo={x.rotulo} />
            </Linha>
          ))}
        </Cartao>
      )}
      {vm.exemplos && <p className="hint">Dados de exemplo: a conta não é criada de verdade.</p>}
    </Janela>
  );
}
