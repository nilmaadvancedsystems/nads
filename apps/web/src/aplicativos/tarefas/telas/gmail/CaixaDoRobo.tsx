// Gmail › E-mails (Vitor, 13/10/2026: "agora quero que refaça toda a UI do Gmail"): a caixa do robô como uma caixa de
// entrada de verdade. No topo, uma barra só (as caixas, como o robô está, a busca e "Verificar agora"); à esquerda a
// lista (as abas De clientes · Sem cliente · Spam e cada e-mail com a inicial, o cliente, o assunto, o começo do texto,
// a hora, os anexos e se já está no Drive); à direita o e-mail aberto (as ações numa barra, o texto, os anexos em
// cartões, as respostas e responder). Sem e-mail escolhido, o convite. No celular, o e-mail ocupa a tela.
import type { entregas as e } from '@nads/core';
import { Esqueleto, Icone, NumeroQueConta, Segmentado, useCarregando } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useCaixaDoRobo, usePainelDoEmail, type AbaDaCaixa, type VmCaixa } from './useCaixaDoRobo';

const ABAS: { valor: AbaDaCaixa; rotulo: string }[] = [
  { valor: 'clientes', rotulo: 'De clientes' },
  { valor: 'sem-cliente', rotulo: 'Sem cliente' },
  { valor: 'spam', rotulo: 'Spam' },
];

/** A cor da inicial, sempre a mesma para o mesmo remetente (seis tons do nads). */
const TONS = ['azul', 'verde', 'roxo', 'laranja', 'ciano', 'rosa'] as const;
const tomDe = (t: string) => TONS[[...t].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7) % TONS.length];
const inicialDe = (x: e.EmailDaCaixa) => (x.clienteNome || x.nome || x.remetente || '?').trim().charAt(0).toUpperCase();

/** O ícone do anexo pela extensão. */
const extensao = (nome: string) => (/\.([a-z0-9]{2,5})$/i.exec(nome)?.[1] || '').toUpperCase();

/** Escolher o cliente dentro do e-mail aberto: uma busca com a lista embaixo. */
function EscolherCliente({ vm, titulo, aoEscolher }: { vm: VmCaixa; titulo: string; aoEscolher: (clienteId: string) => void }) {
  const [busca, setBusca] = useState('');
  const achados = vm.clientesQueBatem(busca);
  return (
    <div className="gm-escolher">
      <p className="gm-rotulo"><Icone nome="briefcase" />{titulo}</p>
      <label className="busca-curta larga">
        <Icone nome="search" />
        <input type="text" placeholder="Código ou nome do cliente" value={busca} onChange={ev => setBusca(ev.target.value)} aria-label={titulo} autoFocus />
      </label>
      {achados.length > 0 && (
        <div className="emp-list gm-escolher-lista">
          {achados.map(c => (
            <button key={c.id} type="button" className="emp-item" onClick={() => { aoEscolher(c.id); setBusca(''); }}>
              <span className="emp-cod">{c.codigo || '—'}</span>
              <span className="emp-txt"><span className="emp-nome">{c.nome}</span>{c.email && <span className="emp-reg">{c.email}</span>}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Um e-mail na lista. */
function Item({ vm, x, aberto }: { vm: VmCaixa; x: e.EmailDaCaixa; aberto: boolean }) {
  const salvo = vm.salvo(x);
  const parecido = vm.aba === 'sem-cliente' ? vm.parecido(x) : null;
  const quem = x.clienteNome || x.nome || x.remetente;
  return (
    <li>
      <div role="button" tabIndex={0} className={'gm-item' + (aberto ? ' aberto' : '')} data-linha={x.mensagemId}
        onClick={() => vm.abrir(x.mensagemId)} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); vm.abrir(x.mensagemId); } }}>
        <span className={'gm-inicial gm-tom-' + tomDe(x.remetente || quem)} aria-hidden="true">{inicialDe(x)}</span>
        <span className="gm-item-corpo">
          <span className="gm-item-topo">
            <b className="gm-quem">{quem}</b>
            <span className="gm-hora">{vm.quandoFoi(x.em)}</span>
          </span>
          <span className="gm-assunto">{x.assunto || '(sem assunto)'}</span>
          <span className="gm-trecho">{x.trecho}</span>
          {(x.arquivos.length > 0 || salvo || parecido) && (
            <span className="gm-item-pe">
              {x.arquivos.length > 0 && <span className="gm-anexos-num" title={x.arquivos.join(', ')}><Icone nome="arquivo" />{x.arquivos.length}</span>}
              {salvo && <span className="gm-no-drive" title={salvo.pasta}><Icone nome="check" />no Drive</span>}
              {parecido && (
                <button type="button" className="gm-sugestao" title={'Ligar ' + x.remetente + ' a ' + parecido.nome}
                  onClick={ev => { ev.stopPropagation(); void vm.ligar(x, parecido.id); }}>
                  É {parecido.nome.split(' ').slice(0, 2).join(' ')}?
                </button>
              )}
            </span>
          )}
        </span>
      </div>
    </li>
  );
}

/** O e-mail aberto, à direita. */
function Leitura({ vm, x }: { vm: VmCaixa; x: e.EmailDaCaixa }) {
  const p = usePainelDoEmail(x);
  const { fechar } = vm;
  useEffect(() => {
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !document.querySelector('.modal-overlay')) fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const m = p.lido.email;
  const salvo = vm.salvo(x);
  const semDono = !x.clienteId;
  const naCaixaSemCliente = vm.aba === 'sem-cliente';
  const anexos = m?.anexos.length ? m.anexos : x.arquivos.map(nome => ({ nome, tamanho: 0 }));
  const quem = x.nome || x.remetente;
  return (
    <article className="gm-leitura-corpo" aria-label={x.assunto || 'E-mail'}>
      <button type="button" className="btn btn-ghost gm-voltar" onClick={fechar}><Icone nome="chevronLeft" />E-mails</button>
      <header className="gm-leitura-topo">
        <h2>{x.assunto || '(sem assunto)'}</h2>
        <div className="gm-barra">
          {!semDono && (salvo
            ? <span className="gm-no-drive grande" title={salvo.pasta}><Icone nome="check" />Salvo no Drive</span>
            : anexos.length > 0 && <button type="button" className="btn btn-primary" onClick={() => void vm.salvarNoDrive(x)}><Icone nome="pasta" />Salvar no Drive</button>)}
          <a className="btn btn-outline" href={vm.linkDoGmail(x.mensagemId)} target="_blank" rel="noopener noreferrer"><Icone nome="envelope" />Abrir no Gmail</a>
          <span className="tarefas-barra-espaco" />
          {/* marcou a empresa errada (Vitor, 06/10/2026): tira o remetente dela e o e-mail volta para Sem cliente */}
          {!semDono && <button type="button" className="btn btn-ghost" onClick={() => void vm.desligar(x).then(ok => { if (ok) fechar(); })}
            title={'Não é de ' + x.clienteNome + ': tirar e escolher de novo'}>Não é deste cliente</button>}
          {vm.aba !== 'spam' && vm.admin && <button type="button" className="btn btn-ghost gm-spam" onClick={() => void vm.ignorar(x).then(fechar)}>É spam</button>}
          <button type="button" className="btn btn-ghost gm-fechar" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </div>
      </header>

      <div className="gm-de">
        <span className={'gm-inicial grande gm-tom-' + tomDe(x.remetente || quem)} aria-hidden="true">{inicialDe(x)}</span>
        <div className="gm-de-txt">
          <p><b>{quem}</b> <span className="fraco">&lt;{x.remetente}&gt;</span></p>
          <p className="fraco">{'Para ' + (m?.para || 'a caixa do escritório')}{m?.cc ? ' · Cc ' + m.cc : ''}</p>
        </div>
        <div className="gm-de-lado">
          <span className="fraco">{x.em ? new Date(x.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
          {x.clienteNome && <span className="badge badge-neutral">{x.clienteNome}</span>}
        </div>
      </div>

      {naCaixaSemCliente ? (
        <EscolherCliente vm={vm} titulo={'De qual cliente é ' + x.remetente + '?'} aoEscolher={id => void vm.ligar(x, id).then(fechar)} />
      ) : semDono ? (
        <EscolherCliente vm={vm} titulo={x.candidatos?.length ? 'De qual cliente? (o robô ficou entre ' + x.candidatos.join(' e ') + ')' : 'De qual cliente?'}
          aoEscolher={id => void vm.salvarNoDrive(x, id)} />
      ) : null}

      <div className="gm-texto">
        {p.lido.carregando ? <Esqueleto linhas={5} />
          : p.lido.erro ? <p className="fraco">Não consegui ler o e-mail inteiro ({p.lido.erro}). O começo dele: {x.trecho}</p>
            : m?.texto.trim() ? <div className="gm-texto-corpo">{m.texto}{m.truncado ? '\n\n(o e-mail é maior; o resto está no Gmail)' : ''}</div>
              : <p className="fraco">Este e-mail não tem texto, só {anexos.length === 1 ? 'o anexo' : 'os anexos'}.</p>}
      </div>

      {anexos.length > 0 && (
        <section className="gm-secao">
          <p className="gm-rotulo"><Icone nome="arquivo" />{anexos.length === 1 ? '1 anexo' : anexos.length + ' anexos'}</p>
          <ul className="gm-anexos">
            {anexos.map(a => (
              <li key={a.nome} className="gm-anexo" title={a.nome}>
                <span className="gm-anexo-tipo">{extensao(a.nome) || <Icone nome="arquivo" />}</span>
                <span className="gm-anexo-txt"><b>{a.nome}</b>{a.tamanho > 0 && <span className="fraco">{Math.max(1, Math.round(a.tamanho / 1024))} KB</span>}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.respostas.length > 0 && (
        <section className="gm-secao">
          <p className="gm-rotulo"><Icone nome="mensagem" />Respostas</p>
          {p.respostas.map(r => (
            <div key={r.id} className="gm-resposta">
              <p className="fraco">{r.por} · {vm.quandoFoi(r.em)} · {r.status === 'enviado' ? 'enviada' : r.status === 'erro' ? 'não saiu: ' + (r.erro || '') : 'na fila do robô'}</p>
              <p>{r.corpo}</p>
            </div>
          ))}
        </section>
      )}

      <form className="gm-responder" onSubmit={ev => { ev.preventDefault(); void p.responder(); }}>
        <textarea rows={3} placeholder={'Responder para ' + x.remetente + '… (Ctrl+Enter envia)'} value={p.texto} onChange={ev => p.setTexto(ev.target.value)}
          onKeyDown={ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); void p.responder(); } }} aria-label="Resposta" />
        <div className="gm-responder-pe">
          <label className="gm-todos"><input type="checkbox" checked={p.todos} onChange={ev => p.setTodos(ev.target.checked)} />Responder a todos</label>
          <span className="tarefas-barra-espaco" />
          <button type="submit" className="btn btn-primary" disabled={!p.texto.trim() || p.enviando}><Icone nome="mensagem" />{p.enviando ? 'Enviando…' : 'Enviar'}</button>
        </div>
      </form>
    </article>
  );
}

export function CaixaDoRobo() {
  const vm = useCaixaDoRobo();
  useCarregando(vm.carregando);
  const a = vm.robo.andamento;
  const estado = !vm.robo.online ? 'fora' : vm.robo.lendo ? 'lendo' : 'online';
  return (
    <section className="gm">
      {/* a barra de cima: as caixas, o robô, a busca e verificar */}
      <div className="gm-topo">
        {vm.caixas.length > 1 && <Segmentado valor={vm.caixa} opcoes={vm.caixas} onMudar={vm.escolherCaixa} />}
        <span className={'gm-robo gm-robo-' + estado} title={vm.robo.visto ? 'Último sinal ' + vm.robo.visto : 'Sem sinal do robô'}>
          <i aria-hidden="true" />{estado === 'fora' ? 'Robô fora do ar' : estado === 'lendo' ? 'Lendo o Gmail…' : 'Robô online'}
          {vm.robo.ultimaLeitura && <span className="fraco">· lido {vm.robo.ultimaLeitura}</span>}
          {vm.robo.naFila > 0 && <span className="fraco">· {vm.robo.naFila} na fila</span>}
        </span>
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar e-mail" aria-label="Buscar e-mail" value={vm.busca} onChange={ev => vm.setBusca(ev.target.value)}
            onKeyDown={ev => { if (ev.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <button type="button" className="btn btn-outline" onClick={() => void vm.verificar()}><Icone nome="repeat" />Verificar agora</button>
      </div>

      {vm.erro && <div className="alert"><Icone nome="alert" /><div><p className="alert-text">{vm.erro}</p></div></div>}
      {vm.robo.erro && <div className="alert"><Icone nome="alert" /><div><p className="alert-title">A última leitura deu erro</p><p className="alert-text">{vm.robo.erro}</p></div></div>}
      {vm.exemplos && <p className="hint">Dados de exemplo: a caixa é inventada e nada vai para o Gmail.</p>}

      {a && (
        <div className="gm-andamento">
          <span className="gm-andamento-icone" aria-hidden="true"><Icone nome="repeat" /></span>
          <div className="gm-andamento-txt">
            <b>{a.tipo === 'salvar' ? 'Salvando no Drive' : a.tipo === 'disparo' ? 'Enviando e-mails' : 'Lendo o Gmail'}{a.total ? ' · ' + Math.round((a.feito / a.total) * 100) + '%' : ''}</b>
            {a.total > 0 && <span className="tarefas-barra larga andando"><span style={{ width: Math.min(100, (a.feito / a.total) * 100) + '%' }} /></span>}
            {a.recentes.length > 0 && <span className="fraco">{a.recentes[a.recentes.length - 1].texto}</span>}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => void vm.cancelar()}>Cancelar</button>
        </div>
      )}

      <div className={'gm-caixa' + (vm.aberto ? ' com-leitura' : '')}>
        {/* a lista */}
        <div className="gm-lista">
          <div className="gm-abas">
            {ABAS.map(x => (
              <button key={x.valor} type="button" className={'gm-aba' + (vm.aba === x.valor ? ' ativa' : '')} onClick={() => vm.setAba(x.valor)} aria-pressed={vm.aba === x.valor}>
                {x.rotulo}<span className="gm-aba-num"><NumeroQueConta texto={String(vm.contagem[x.valor])} /></span>
              </button>
            ))}
          </div>
          {vm.carregando ? <div className="gm-lista-vazia"><Esqueleto linhas={6} /></div>
            : !vm.linhas.length ? (
              <div className="gm-lista-vazia">
                <span className="gm-vazio-icone" aria-hidden="true"><Icone nome="caixaEntrada" /></span>
                <b>Nada aqui</b>
                <span className="fraco">{vm.busca ? 'Nenhum e-mail com essa busca.' : vm.aba === 'sem-cliente' ? 'Todo e-mail já tem cliente.' : vm.aba === 'spam' ? 'Nenhum spam.' : 'Nenhum e-mail de cliente.'}</span>
              </div>
            ) : (
              <ul className="gm-itens">
                {vm.linhas.map(x => <Item key={x.mensagemId} vm={vm} x={x} aberto={vm.aberto?.mensagemId === x.mensagemId} />)}
              </ul>
            )}
        </div>
        {/* o e-mail aberto */}
        <div className="gm-leitura">
          {vm.aberto ? <Leitura key={vm.aberto.mensagemId} vm={vm} x={vm.aberto} /> : (
            <div className="gm-leitura-vazia">
              <span className="gm-vazio-icone" aria-hidden="true"><Icone nome="envelope" /></span>
              <b>Escolha um e-mail</b>
              <span className="fraco">O texto, os anexos e as ações aparecem aqui.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
