// View da Minha página: uma janela grande por cima da tela, no desenho das Configurações do Notion (e do Entregas,
// que segue o Notion) — à esquerda a pessoa, a busca e os tópicos em grupos; à direita o tópico aberto, em cartões
// com cabeçalho e uma opção por linha (o rótulo e a explicação à esquerda, o controle à direita). Fecha no ×, no Esc e
// clicando fora.
import { Esqueleto, Icone, Interruptor, SeletorTema, useCarregando, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TopicoPessoal } from './contexto';
import { usePaginaPessoal, type VmPessoal } from './usePaginaPessoal';

const TOPICOS: { id: TopicoPessoal; rotulo: string; icone: NomeIcone; grupo: string; busca: string }[] = [
  { id: 'caixa', rotulo: 'Caixa de entrada', icone: 'caixaEntrada', grupo: '', busca: 'inbox pendências paradas envios claudio secretário liberação computador cobrança e-mail sem cliente arquivados' },
  { id: 'notas', rotulo: 'Anotações', icone: 'fileText', grupo: '', busca: 'notas lembrete lembrar escrever' },
  { id: 'conta', rotulo: 'Minha conta', icone: 'usuario', grupo: 'Conta', busca: 'foto perfil ícone icone nome e-mail email setor sair senha' },
  { id: 'preferencias', rotulo: 'Aparência e telas', icone: 'settings', grupo: 'Preferências', busca: 'tema claro escuro início abrir tela barra lateral competência mês tabelas compactas atalhos teclado' },
  { id: 'aplicativo', rotulo: 'Versão do sistema', icone: 'download', grupo: 'Aplicativo', busca: 'versão atualizar nova' },
];

/** Uma opção: o rótulo e a explicação à esquerda, o controle (ou o valor) à direita. */
function Linha({ rotulo, dica, children }: { rotulo: string; dica?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pessoal-linha">
      <div className="pessoal-linha-texto">
        <b>{rotulo}</b>
        {dica && <span className="fraco">{dica}</span>}
      </div>
      {children != null && <div className="pessoal-linha-controle">{children}</div>}
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="card pessoal-cartao">
      <div className="card-head"><h3>{titulo}</h3></div>
      {children}
    </section>
  );
}

function Foto({ foto, iniciais, grande }: { foto: string | null; iniciais: string; grande?: boolean }) {
  const classe = 'pessoal-foto' + (grande ? ' grande' : '');
  return foto ? <img className={classe} src={foto} alt="" /> : <span className={classe + ' pessoal-iniciais'} aria-hidden="true">{iniciais}</span>;
}

function CaixaDeEntrada({ vm, fechar }: { vm: VmPessoal; fechar: () => void }) {
  const c = vm.caixa;
  useCarregando(c.carregando);
  return (
    <>
      <div className="chip-row pessoal-filtros">
        <button type="button" className={'chip-f' + (c.filtro === 'tudo' ? ' on' : '')} onClick={() => c.setFiltro('tudo')}>Tudo <span className="gh-counter">{c.total}</span></button>
        <button type="button" className={'chip-f' + (c.filtro === 'acao' ? ' on' : '')} onClick={() => c.setFiltro('acao')}>Pede ação <span className="gh-counter">{c.pedemAcao}</span></button>
        <button type="button" className={'chip-f' + (c.filtro === 'arquivados' ? ' on' : '')} onClick={() => c.setFiltro('arquivados')}>Arquivados <span className="gh-counter">{c.arquivados}</span></button>
      </div>
      {c.carregando ? <Esqueleto linhas={4} /> : !c.itens.length ? (
        <div className="card gh-blank">
          <Icone nome="caixaEntrada" />
          <h4>{c.filtro === 'acao' ? 'Nada pedindo ação' : c.filtro === 'arquivados' ? 'Nada arquivado' : 'Caixa de entrada vazia'}</h4>
          <p>{c.filtro === 'arquivados' ? 'O que você arquivar sai da caixa e fica aqui.'
            : 'Aqui aparecem as etapas que você parou, os e-mails sem cliente da caixa do seu setor, as cobranças que você pediu e os arquivos que mandou ao Claudio Secretário' + (vm.conta.admin ? ', e os pedidos de liberação de computador' : '') + '.'}</p>
        </div>
      ) : (
        <ul className="card pessoal-caixa">
          {c.itens.map(i => (
            <li key={i.id} className={'pessoal-item tom-' + i.tom}>
              <span className="pessoal-item-icone" aria-hidden="true"><Icone nome={i.icone} /></span>
              <div className="pessoal-item-texto">
                <b>{i.titulo}</b>
                <span className="fraco">{i.texto}</span>
              </div>
              <span className="pessoal-item-quando fraco">{i.quando}</span>
              {(i.acoes.length > 0 || i.arquivavel) && (
                <span className="pessoal-item-acoes">
                  {c.filtro !== 'arquivados' && i.acoes.map(a => (
                    <button key={a.rotulo} type="button" className={'btn ' + (a.principal ? 'btn-primary' : 'btn-outline')}
                      onClick={() => { a.onClick(); if (a.fecha) fechar(); }}>{a.rotulo}</button>
                  ))}
                  {i.arquivavel && (c.filtro === 'arquivados'
                    ? <button type="button" className="btn btn-outline" onClick={() => c.desarquivar(i.id)}>Desarquivar</button>
                    : <button type="button" className="icon-btn" title="Arquivar (sai da caixa)" aria-label="Arquivar" onClick={() => c.arquivar(i.id)}><Icone nome="arquivo" /></button>)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** As Anotações (as mesmas do Entregas): escrever (com lembrete, se quiser), marcar feita, editar o texto e apagar. */
function Anotacoes({ vm }: { vm: VmPessoal }) {
  const n = vm.notas;
  const [texto, setTexto] = useState('');
  const [lembrete, setLembrete] = useState('');
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  useCarregando(n.carregando);
  const salvar = () => {
    if (!texto.trim()) return;
    n.nova(texto, lembrete ? new Date(lembrete).toISOString() : null);
    setTexto(''); setLembrete('');
  };
  return (
    <>
      <form className="card pessoal-nota-nova" onSubmit={ev => { ev.preventDefault(); salvar(); }}>
        <textarea rows={2} placeholder="Escreva uma anotação… (só você vê; aparece também no Entregas)" value={texto} onChange={ev => setTexto(ev.target.value)}
          onKeyDown={ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); salvar(); } }} aria-label="Nova anotação" />
        <div className="pessoal-nota-nova-pe">
          <label className="fraco">Lembrar em <input type="datetime-local" value={lembrete} onChange={ev => setLembrete(ev.target.value)} /></label>
          <button type="submit" className="btn btn-primary" disabled={!texto.trim()}><Icone nome="plus" />Anotar</button>
        </div>
      </form>
      {n.carregando ? <Esqueleto linhas={3} /> : !n.lista.length ? (
        <div className="card gh-blank"><Icone nome="fileText" /><h4>Nenhuma anotação</h4><p>O que você anotar aqui (ou no Entregas) aparece nos dois.</p></div>
      ) : (
        <ul className="card pessoal-caixa pessoal-notas">
          {n.lista.map(x => (
            <li key={x.id} className={'pessoal-item' + (x.feito ? ' feita' : '') + (x.atrasada ? ' atrasada' : '')}>
              <input type="checkbox" checked={x.feito} onChange={ev => n.marcar(x.id, ev.target.checked)} aria-label={x.feito ? 'Desmarcar' : 'Marcar como feita'} />
              <div className="pessoal-item-texto">
                {editando?.id === x.id ? (
                  <textarea rows={2} autoFocus value={editando.texto} onChange={ev => setEditando({ id: x.id, texto: ev.target.value })}
                    onBlur={() => { if (editando.texto.trim() && editando.texto !== x.texto) n.editar(x.id, editando.texto); setEditando(null); }}
                    onKeyDown={ev => { if (ev.key === 'Escape') { ev.stopPropagation(); setEditando(null); } if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) (ev.target as HTMLTextAreaElement).blur(); }}
                    aria-label="Editar a anotação" />
                ) : (
                  <button type="button" className="pessoal-nota-texto" title="Editar" onClick={() => setEditando({ id: x.id, texto: x.texto })}>{x.texto}</button>
                )}
                {x.lembrete && <span className="fraco">{x.atrasada ? 'Lembrete passou: ' : 'Lembrete: '}{x.lembrete}</span>}
              </div>
              <span className="pessoal-item-acoes">
                <button type="button" className="icon-btn" title="Apagar" aria-label="Apagar a anotação" onClick={() => n.apagar(x.id)}><Icone nome="x" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** O nome: o texto com o Salvar ao lado (Enter salva). */
function EditarNome({ atual, salvar }: { atual: string; salvar: (n: string) => Promise<string | null> }) {
  const [nome, setNome] = useState(atual);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const mudou = nome.trim() !== atual;
  const ir = async () => { setSalvando(true); const e = await salvar(nome); setSalvando(false); setErro(e || ''); };
  return (
    <span className="pessoal-nome">
      <input value={nome} onChange={ev => { setNome(ev.target.value); setErro(''); }} onKeyDown={ev => { if (ev.key === 'Enter' && mudou) void ir(); }} aria-label="Nome" />
      {mudou && <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => void ir()}>{salvando ? <span className="btn-spinner" /> : null}Salvar</button>}
      {erro && <span className="pessoal-erro">{erro}</span>}
    </span>
  );
}

/** A senha: a atual (o Firebase pede de novo) e a nova duas vezes. */
function TrocarSenha({ salvar }: { salvar: (atual: string, nova: string, confirma: string) => Promise<string | null> }) {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  if (!aberto) {
    return (
      <Linha rotulo="Senha" dica="A mesma do Entregas.">
        <button type="button" className="btn btn-outline" onClick={() => setAberto(true)}><Icone nome="lock" />Trocar senha</button>
      </Linha>
    );
  }
  return (
    <form className="pessoal-form" onSubmit={async ev => {
      ev.preventDefault(); setSalvando(true);
      const e = await salvar(atual, nova, confirma);
      setSalvando(false);
      if (e) setErro(e); else { setAberto(false); setAtual(''); setNova(''); setConfirma(''); setErro(''); }
    }}>
      <b>Trocar senha</b>
      <input type="password" autoComplete="current-password" placeholder="Senha atual" value={atual} onChange={ev => setAtual(ev.target.value)} />
      <input type="password" autoComplete="new-password" placeholder="Senha nova (pelo menos 6 caracteres)" value={nova} onChange={ev => setNova(ev.target.value)} />
      <input type="password" autoComplete="new-password" placeholder="Repita a senha nova" value={confirma} onChange={ev => setConfirma(ev.target.value)} />
      {erro && <p className="pessoal-erro">{erro}</p>}
      <span className="pessoal-nome">
        <button type="submit" className="btn btn-primary" disabled={salvando}>{salvando ? <span className="btn-spinner" /> : null}Trocar</button>
        <button type="button" className="btn btn-outline" onClick={() => { setAberto(false); setErro(''); }}>Cancelar</button>
      </span>
    </form>
  );
}

function MinhaConta({ vm }: { vm: VmPessoal }) {
  const c = vm.conta;
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <>
      <Cartao titulo="Foto de perfil">
        <div className="pessoal-linha">
          <Foto foto={c.foto} iniciais={c.iniciais} grande />
          <div className="pessoal-linha-texto">
            <b>{c.nome}</b>
            <span className="fraco">Aparece no seu ícone, no canto do cabeçalho (e no Entregas: é a mesma conta).</span>
          </div>
          <div className="pessoal-linha-controle">
            <input ref={arquivo} type="file" accept="image/*" hidden
              onChange={ev => { const f = ev.target.files?.[0]; if (f) c.trocarFoto(f); ev.target.value = ''; }} />
            <button type="button" className="btn btn-outline" disabled={c.salvandoFoto} onClick={() => arquivo.current?.click()}>
              {c.salvandoFoto ? <span className="btn-spinner" /> : <Icone nome="upload" />}{c.foto ? 'Trocar foto' : 'Escolher foto'}
            </button>
            {c.foto && <button type="button" className="btn btn-outline" disabled={c.salvandoFoto} onClick={c.tirarFoto}>Remover</button>}
          </div>
        </div>
        <div className="pessoal-linha-texto"><span className="fraco">Ou um ícone (os mesmos do Entregas):</span></div>
        <div className="pessoal-icones" role="list">
          {c.icones.map(i => (
            <button key={i.nome} type="button" role="listitem" className={'pessoal-icone' + (c.foto === i.url ? ' on' : '')} title={i.nome}
              aria-label={'Usar o ícone ' + i.nome} disabled={c.salvandoFoto} onClick={() => c.escolherIcone(i.url)}>
              <img src={i.url} alt="" />
            </button>
          ))}
        </div>
      </Cartao>
      <Cartao titulo="Conta">
        <Linha rotulo="Nome" dica="Como aparece nas tarefas e nos pedidos ao robô (e no Entregas).">
          {c.comLogin ? <EditarNome atual={c.nome} salvar={c.trocarNome} /> : c.nome}
        </Linha>
        <Linha rotulo="E-mail" dica="O login do Entregas (a mesma conta em todo o nads).">{c.email || '—'}</Linha>
        <Linha rotulo="Setor" dica="Quem muda é um administrador.">{c.setor}</Linha>
        {c.comLogin && <TrocarSenha salvar={c.trocarSenha} />}
        <Linha rotulo={c.sair} dica="Sai deste navegador; para entrar de novo, o login do Entregas.">
          <button type="button" className="btn btn-outline btn-danger" onClick={c.fazerSair}><Icone nome="logOut" />{c.sair}</button>
        </Linha>
      </Cartao>
    </>
  );
}

function Preferencias({ vm }: { vm: VmPessoal }) {
  const p = vm.preferencias;
  return (
    <>
      <Cartao titulo="Aparência">
        <Linha rotulo="Tema" dica="Claro, escuro ou o do computador. Vale para todo o nads neste navegador."><SeletorTema /></Linha>
      </Cartao>
      <Cartao titulo="Telas">
        <Linha rotulo="Onde a Tarefas abre" dica="A primeira tela ao entrar (neste navegador).">
          <select className="pessoal-select" value={p.inicio} onChange={ev => p.mudarInicio(ev.target.value)} aria-label="Onde a Tarefas abre">
            {p.inicios.map(i => <option key={i.valor} value={i.valor}>{i.rotulo}</option>)}
          </select>
        </Linha>
        <Linha rotulo="Mês em que as telas abrem" dica="Minhas empresas, a página da empresa e o Contábil (dá para trocar na tela).">
          <select className="pessoal-select" value={p.competencia} onChange={ev => p.mudarCompetencia(ev.target.value as 'anterior' | 'atual')} aria-label="Mês em que as telas abrem">
            <option value="anterior">O mês anterior</option>
            <option value="atual">O mês atual</option>
          </select>
        </Linha>
        <Linha rotulo="Barra lateral recolhida" dica="A barra da esquerda começa só com os ícones (dá para abrir nela mesma).">
          <Interruptor ligado={p.lateralOculta} onMudar={() => p.mudarLateral(!p.lateralOculta)} rotulo="Barra lateral recolhida" />
        </Linha>
        <Linha rotulo="Tabelas compactas" dica="Linhas mais baixas: cabe mais na tela.">
          <Interruptor ligado={p.compactas} onMudar={() => p.mudarCompactas(!p.compactas)} rotulo="Tabelas compactas" />
        </Linha>
      </Cartao>
      <Cartao titulo="Atalhos de teclado">
        <table className="pessoal-atalhos">
          <tbody>
            {p.atalhos.map(a => (
              <tr key={a.onde + a.teclas.join('+')}>
                <td>{a.teclas.map((k, i) => <span key={k}>{i > 0 && ' + '}<kbd>{k}</kbd></span>)}</td>
                <td>{a.faz}</td>
                <td className="fraco">{a.onde}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>
    </>
  );
}

function Aplicativo({ vm }: { vm: VmPessoal }) {
  const a = vm.aplicativo;
  return (
    <Cartao titulo="Atualização">
      <Linha rotulo="Versão" dica="Uma versão só para o nads inteiro.">{a.versao}</Linha>
      <Linha rotulo="Versão nova" dica={a.versaoNova ? 'Saiu a ' + a.versaoNova + '. Atualizar não perde o que está na tela.' : 'Você está na mais nova.'}>
        {a.versaoNova ? <button type="button" className="btn btn-primary" onClick={a.atualizar}><Icone nome="repeat" />Atualizar</button> : <span className="badge badge-ok">Em dia</span>}
      </Linha>
    </Cartao>
  );
}

export function JanelaPessoal({ topico, mudar, fechar }: { topico: TopicoPessoal; mudar: (t: TopicoPessoal) => void; fechar: () => void }) {
  const vm = usePaginaPessoal();
  const [busca, setBusca] = useState('');
  // Esc fecha
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const q = busca.trim().toLowerCase();
  const visiveis = TOPICOS.filter(t => !q || (t.rotulo + ' ' + t.busca).toLowerCase().includes(q));
  const atual = TOPICOS.find(t => t.id === topico) || TOPICOS[0];
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pessoal-janela" role="dialog" aria-modal="true" aria-label="Minha página">
        <aside className="pessoal-lado">
          <div className="pessoal-quem">
            <Foto foto={vm.conta.foto} iniciais={vm.conta.iniciais} />
            <div className="pessoal-quem-texto"><b>{vm.conta.nome}</b><span className="fraco">{vm.conta.email || vm.conta.setor}</span></div>
          </div>
          <label className="busca-curta pessoal-busca">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar" aria-label="Buscar nas configurações" value={busca} onChange={e => setBusca(e.target.value)} />
          </label>
          <nav aria-label="Tópicos">
            {visiveis.map((t, i) => (
              <div key={t.id}>
                {t.grupo && t.grupo !== visiveis[i - 1]?.grupo && <p className="pessoal-grupo">{t.grupo}</p>}
                <button type="button" className={'pessoal-topico' + (t.id === topico ? ' ativo' : '')} aria-current={t.id === topico ? 'page' : undefined}
                  onClick={() => mudar(t.id)}>
                  <Icone nome={t.icone} />{t.rotulo}
                  {t.id === 'caixa' && vm.caixa.pedemAcao > 0 && <span className="gh-counter">{vm.caixa.pedemAcao}</span>}
                  {t.id === 'notas' && vm.notas.abertas > 0 && <span className="gh-counter">{vm.notas.abertas}</span>}
                </button>
              </div>
            ))}
            {!visiveis.length && <p className="fraco pessoal-nada">Nada com "{busca}".</p>}
          </nav>
        </aside>
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <h2>{atual.rotulo}</h2>
            <button type="button" className="drawer-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" /></button>
          </header>
          <div className="pessoal-rola">
            {topico === 'notas' ? <Anotacoes vm={vm} />
              : topico === 'conta' ? <MinhaConta vm={vm} />
              : topico === 'preferencias' ? <Preferencias vm={vm} />
                : topico === 'aplicativo' ? <Aplicativo vm={vm} />
                  : <CaixaDeEntrada vm={vm} fechar={fechar} />}
          </div>
        </section>
      </div>
    </div>
  );
}
