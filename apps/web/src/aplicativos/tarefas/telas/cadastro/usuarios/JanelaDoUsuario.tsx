// As janelas flutuantes de Cadastro › Usuários, no desenho da Minha página (o Notion): à esquerda quem é e os tópicos
// (painéis laterais; Vitor, 05/10/2026: "isso também deve ser em painéis laterais"), à direita o tópico escolhido, em
// cartões com uma opção por linha. JanelaDoUsuario: Cargo, Papéis e Acesso de uma pessoa (só o admin muda).
// JanelaNovoUsuario: Dados, Cargo e Papéis do acesso novo, com o Criar acesso sempre no pé. Fecham no ×, no Esc e
// clicando fora.
import { usuarios } from '@nads/core';
import { BotaoAcao, Icone, Interruptor } from '@nads/ui';
import { useState } from 'react';
import { Cartao, JanelaLateral, Linha, type TopicoDaJanela } from '../../janela/JanelaLateral';
import { temNivelDiretor } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { useNovoUsuario } from './useNovoUsuario';
import { EmpresasDaPessoa } from '../responsaveis/EmpresasDaPessoa';
import type { VmUsuarios } from './useUsuariosDoNads';

/** O link do convite (cadastro ou nova senha), para copiar e mandar à pessoa (15/10/2026). */
function LinkDoConvite({ link, copiar }: { link: string; copiar: () => void }) {
  return (
    <span className="convite-link">
      <input className="usuario-campo" type="text" readOnly value={link} aria-label="Link" onFocus={ev => ev.currentTarget.select()} />
      <button type="button" className="btn btn-outline" onClick={copiar}><Icone nome="copiar" />Copiar</button>
    </span>
  );
}

function Foto({ foto, iniciais }: { foto?: string | null; iniciais: string }) {
  return foto ? <img className="pessoal-foto grande" src={foto} alt="" /> : <span className="pessoal-foto grande pessoal-iniciais" aria-hidden="true">{iniciais}</span>;
}

/** o papel Desenvolvedor (06/11/2026): o que ele libera */
/** O e-mail de entrada, com o Trocar para o Diretor e o Dono (12/11/2026). */
function EmailDaConta({ vm, p }: { vm: VmUsuarios; p: usuarios.Usuario }) {
  const [editando, setEditando] = useState<string | null>(null);
  if (editando === null) {
    return (
      <span className="btn-row" style={{ alignItems: 'center' }}>
        <span>{p.email}</span>
        {vm.podeTrocarEmail(p) && <button type="button" className="btn btn-outline" onClick={() => setEditando(p.email)}><Icone nome="lapis" />Trocar</button>}
      </span>
    );
  }
  const salvar = async () => { if (await vm.trocarEmail(p, editando)) setEditando(null); };
  return (
    <span className="btn-row" style={{ alignItems: 'center' }}>
      <input className="usuario-campo" type="email" aria-label={'E-mail de ' + p.nome} value={editando} autoFocus
        onChange={e => setEditando(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void salvar(); if (e.key === 'Escape') setEditando(null); }} />
      <button type="button" className="btn btn-outline" onClick={() => setEditando(null)}>Cancelar</button>
      <BotaoAcao className="btn btn-primary" carregando={vm.fazendo('email:' + p.uid)} textoCarregando="Trocando…" onClick={() => void salvar()}>Salvar</BotaoAcao>
    </span>
  );
}

const DICA_FINANCEIRO = 'Quem é Diretor sempre tem. Os outros, só com a autorização do Diretor.';
const SempreLigado = () => <span className="badge badge-neutral">Sempre ligado</span>;
const DICA_DEV = 'Libera o Modo desenvolvedor no menu do avatar (só ver, sem gravar nada).';

type TopicoDaPessoa = 'cargo' | 'papeis' | 'acesso' | 'empresas';

export function JanelaDoUsuario({ vm }: { vm: VmUsuarios }) {
  const [topico, setTopico] = useState<TopicoDaPessoa>('cargo');
  const p = vm.pessoa;
  const { operador } = useOperador();
  if (!p) return null;
  const topicos: TopicoDaJanela<TopicoDaPessoa>[] = [
    { id: 'cargo', rotulo: 'Cargo', icone: 'briefcase' },
    { id: 'papeis', rotulo: 'Papéis', icone: 'checklist' },
    { id: 'acesso', rotulo: 'Acesso', icone: 'lock' },
    // as empresas de que a pessoa cuida, com o Transferir (Vitor, 07/10/2026: "dentro de cada usuário vai ter as empresas dele")
    { id: 'empresas', rotulo: 'Empresas', icone: 'briefcase' },
  ];
  return (
    <JanelaLateral rotulo={p.nome} topicos={topicos} topico={topico} mudar={setTopico} fechar={vm.fechar} resumo={(
      <div className="usuario-quem">
        <Foto foto={p.fotoPerfil} iniciais={p.iniciais} />
        <b>{p.nome}</b>
        <span className="fraco">{p.email}</span>
        <span className={'badge ' + (p.online ? 'badge-ok' : 'badge-neutral')}>{!p.ativo ? 'Inativo' : p.online ? 'Online' : 'Ativo'}</span>
        {p.ativo && !p.online && <span className="fraco">{p.presenca}</span>}
        <span className="fraco">{p.cargo || 'Sem cargo'}</span>
        {p.atividade && (
          <div className="usuario-atividade">
            <span className="usuario-atividade-rotulo">Trabalhando agora</span>
            <b>{p.atividade.etapa}</b>
            <span>{p.atividade.empresa}</span>
            {p.atividade.periodo && <span className="usuario-atividade-rotulo">{p.atividade.periodo}</span>}
          </div>
        )}
      </div>
    )}>
      {!vm.admin && topico !== 'empresas' && <p className="hint">Só um administrador muda a equipe.</p>}
      {topico === 'empresas' && <EmpresasDaPessoa pessoa={p.nome} />}
      {topico === 'cargo' && (
        <Cartao titulo="Cargo">
          <Linha rotulo="Departamento">
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
          {vm.papeis.filter(x => x.id !== 'financeiro' || temNivelDiretor(operador)).map(x => (
            <Linha key={x.id} rotulo={x.rotulo} dica={x.id === 'desenvolvedor' ? DICA_DEV : x.id === 'financeiro' ? DICA_FINANCEIRO : undefined}>
              {x.id === 'financeiro' && usuarios.nivelDeDiretor(p.nivel)
                ? <SempreLigado />
                : <Interruptor ligado={p.papeis.includes(x.id)} onMudar={() => void vm.alternarPapel(p, x.id)} rotulo={x.rotulo + ' de ' + p.nome} />}
            </Linha>
          ))}
        </Cartao>
      )}
      {topico === 'acesso' && (
        <>
          <Cartao titulo="Conta">
            <Linha rotulo="No nads">
              <span className="usuarios-estado"><span className={'usuarios-ponto' + (p.online ? ' ok' : '')} aria-hidden="true" />{p.presenca}</span>
            </Linha>
            <Linha rotulo="E-mail" dica="O login. Com e-mail fora do padrão nome@nilma.local, a pessoa entra digitando o e-mail no lugar do nome.">
              <EmailDaConta vm={vm} p={p} />
            </Linha>
            <Linha rotulo="Conta ativa">
              <Interruptor ligado={p.ativo} onMudar={() => void vm.ativar(p)} rotulo={(p.ativo ? 'Desativar ' : 'Ativar ') + p.nome} />
            </Linha>
          </Cartao>
          {vm.admin && (
            <Cartao titulo="Senha">
              <Linha rotulo="Nova senha" dica="Vale 24 horas e uma vez só.">
                {vm.linkDeSenha(p.uid)
                  ? <LinkDoConvite link={vm.linkDeSenha(p.uid)} copiar={() => vm.copiar(vm.linkDeSenha(p.uid))} />
                  : <button type="button" className="btn btn-outline" disabled={vm.gerandoSenha} onClick={() => void vm.gerarLinkDeSenha(p)}>
                    {vm.gerandoSenha ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="link" />}Gerar link de nova senha
                  </button>}
              </Linha>
            </Cartao>
          )}
          <Cartao titulo="Computadores liberados">
            {!p.computadores.length ? (
              <Linha rotulo="Nenhum" dica="A proteção do login só pede liberação quando está ligada (Configurações)." />
            ) : p.computadores.map(s => (
              <Linha key={s.id} rotulo={s.computador} dica={'Liberado em ' + vm.quando(s.liberadoEm)}>
                {vm.admin && <BotaoAcao className="btn btn-outline" carregando={vm.fazendo('revogar:' + s.id)} textoCarregando="Revogando…" onClick={() => void vm.revogar(s)}>Revogar</BotaoAcao>}
              </Linha>
            ))}
          </Cartao>
        </>
      )}
    </JanelaLateral>
  );
}

type TopicoDoNovo = 'dados' | 'cargo' | 'papeis';

export function JanelaNovoUsuario({ fechar }: { fechar: () => void }) {
  const { operador } = useOperador();
  const vm = useNovoUsuario(fechar);
  const [topico, setTopico] = useState<TopicoDoNovo>('dados');
  // o que falta (depois de tentar criar) acende o tópico onde está
  const faltaDados = vm.erros.some(e => /nome|senha|acesso com esse nome/i.test(e));
  const faltaCargo = vm.erros.some(e => /departamento|nível/i.test(e));
  const topicos: TopicoDaJanela<TopicoDoNovo>[] = [
    { id: 'dados', rotulo: 'Dados', icone: 'usuario', alerta: faltaDados },
    { id: 'cargo', rotulo: 'Cargo', icone: 'briefcase', alerta: faltaCargo },
    { id: 'papeis', rotulo: 'Papéis a mais', icone: 'checklist' },
  ];
  return (
    <JanelaLateral rotulo="Novo usuário" topicos={topicos} topico={topico} mudar={setTopico} fechar={fechar}
      resumo={(
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
          <button type="button" className="btn btn-outline" disabled={vm.gerandoLink || !vm.podeGerarLink} onClick={() => void vm.gerarLink()}
            title={vm.podeGerarLink ? 'A pessoa abre o link e escolhe o nome e a senha' : 'Escolha o departamento e o nível primeiro'}>
            {vm.gerandoLink ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="link" />}Link de cadastro
          </button>
          <button type="button" className="btn btn-primary" disabled={vm.criando} onClick={() => void vm.criar()}>
            {vm.criando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="plus" />}Criar acesso
          </button>
        </>
      )}>
      {vm.link && (
        <Cartao titulo="Link de cadastro">
          <Linha rotulo="Mande para a pessoa" dica="Vale 24 horas e uma vez só.">
            <LinkDoConvite link={vm.link} copiar={vm.copiar} />
          </Linha>
        </Cartao>
      )}
      {topico === 'dados' && (
        <Cartao titulo="Dados">
          <Linha rotulo="Nome">
            <input className="usuario-campo" type="text" aria-label="Nome" value={vm.nome} onChange={ev => vm.setNome(ev.target.value)} placeholder="Ex.: Maria Souza" autoComplete="off" autoFocus />
          </Linha>
          <Linha rotulo="Senha" dica="Pelo menos 6 caracteres.">
            <input className="usuario-campo" type="password" aria-label="Senha" value={vm.senha} onChange={ev => vm.setSenha(ev.target.value)} autoComplete="new-password"
              onKeyDown={ev => { if (ev.key === 'Enter') setTopico('cargo'); }} />
          </Linha>
        </Cartao>
      )}
      {topico === 'cargo' && (
        <Cartao titulo="Cargo">
          <Linha rotulo="Departamento">
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
          {vm.extras.filter(x => x.id !== 'financeiro' || temNivelDiretor(operador)).map(x => (
            <Linha key={x.id} rotulo={x.rotulo} dica={x.id === 'desenvolvedor' ? DICA_DEV : x.id === 'financeiro' ? DICA_FINANCEIRO : undefined}>
              {x.id === 'financeiro' && usuarios.nivelDeDiretor(vm.nivel)
                ? <SempreLigado />
                : <Interruptor ligado={x.on} onMudar={() => vm.alternarExtra(x.id)} rotulo={x.rotulo} />}
            </Linha>
          ))}
        </Cartao>
      )}
      {vm.exemplos && <p className="hint">Dados de exemplo: a conta não é criada de verdade.</p>}
    </JanelaLateral>
  );
}
