// Gmail › E-mails (Vitor, 13/10/2026: "agora quero que refaça toda a UI do Gmail"): a caixa do robô como uma caixa de
// entrada de verdade. No topo, uma barra só (as caixas, como o robô está, a busca e "Verificar agora"); à esquerda a
// lista (as abas De clientes · Sem cliente · Spam e cada e-mail com a inicial, o cliente, o assunto, o começo do texto,
// a hora, os anexos e se já está no Drive); à direita o e-mail aberto (as ações numa barra, o texto, os anexos em
// cartões, as respostas e responder). A lista ocupa a largura toda, uma linha por e-mail; ao clicar, o e-mail abre numa
// janela flutuante por cima dela (14/10/2026). No celular, a janela ocupa a tela.
import type { entregas as e } from '@nads/core';
import { Alerta, BotaoFechar, Esqueleto, Icone, NumeroQueConta, Segmentado, useCarregando } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useCaixaDoRobo, usePainelDoEmail, type AbaDaCaixa, type PeriodoDaCaixa, type VmCaixa } from './useCaixaDoRobo';

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

const PERIODOS: { valor: PeriodoDaCaixa; rotulo: string }[] = [
  { valor: 'tudo', rotulo: 'Tudo' }, { valor: 'hoje', rotulo: 'Hoje' }, { valor: '7d', rotulo: '7 dias' }, { valor: '30d', rotulo: '30 dias' },
];


/** Escolher o cliente dentro do e-mail aberto: uma busca com a lista embaixo. */
function EscolherCliente({ vm, titulo, aoEscolher, candidatos = [] }: { vm: VmCaixa; titulo: string; aoEscolher: (clienteId: string) => void; candidatos?: readonly string[] }) {
  const [busca, setBusca] = useState('');
  const achados = vm.clientesQueBatem(busca);
  // os candidatos do robô (podem ser dezenas): só os 5 primeiros, em etiquetas que escolhem num clique; o resto pela busca
  const sugeridos = busca ? [] : candidatos.slice(0, 5).map(nome => ({ nome, cliente: vm.clientesQueBatem(nome)[0] || null }));
  return (
    <div className="gm-escolher">
      <p className="gm-rotulo"><Icone nome="briefcase" />{titulo}</p>
      <label className="busca-curta larga">
        <Icone nome="search" />
        <input type="text" placeholder="Código ou nome do cliente" value={busca} onChange={ev => setBusca(ev.target.value)} aria-label={titulo} autoFocus />
      </label>
      {sugeridos.length > 0 && (
        <div className="gm-candidatos">
          {/* achou o cliente: escolhe num clique; não achou: o nome vai para a busca */}
          {sugeridos.map(c => <button key={c.nome} type="button" className="gm-sugestao" onClick={() => (c.cliente ? aoEscolher(c.cliente.id) : setBusca(c.nome))}>{c.nome}</button>)}
          {candidatos.length > sugeridos.length && <span className="fraco">e mais {candidatos.length - sugeridos.length}: use a busca</span>}
        </div>
      )}
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
  const q = vm.quem(x);
  return (
    <li>
      <div role="button" tabIndex={0} className={'gm-item' + (aberto ? ' aberto' : '')} data-linha={x.mensagemId}
        onClick={() => vm.abrir(x.mensagemId)} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); vm.abrir(x.mensagemId); } }}>
        <span className={'gm-inicial gm-tom-' + tomDe(x.remetente || q.completo)} aria-hidden="true">{inicialDe(x)}</span>
        <span className="gm-item-corpo">
          <span className="gm-item-topo">
            <span className="gm-quem" title={q.completo}>{q.codigo && <span className="emp-cod">{q.codigo}</span>}<b>{q.nome}</b></span>
            <span className="gm-hora">{vm.quandoFoi(x.em)}</span>
          </span>
          <span className="gm-assunto"><b>{x.assunto || '(sem assunto)'}</b>{x.trecho && <span className="gm-trecho-junto"> — {x.trecho}</span>}</span>
          <span className="gm-trecho">{x.trecho}</span>
          {(x.arquivos.length > 0 || salvo || parecido) && (
            <span className="gm-item-pe">
              {x.arquivos.length > 0 && <span className="gm-clipe" title={x.arquivos.length + (x.arquivos.length === 1 ? ' anexo' : ' anexos')}><Icone nome="arquivo" /></span>}
              {salvo && <span className="gm-no-drive" title={'No Drive: ' + salvo.pasta}><Icone nome="check" />no Drive</span>}
              {parecido && (
                <button type="button" className="gm-sugestao" title={'Ligar ' + x.remetente + ' a ' + parecido.nome}
                  onClick={ev => { ev.stopPropagation(); void vm.ligar(x, parecido.id); }}>
                  É {parecido.nome.split(' ').slice(0, 2).join(' ')}?
                </button>
              )}
            </span>
          )}
          {/* os anexos em pílulas embaixo, como no Gmail (14/10/2026: "podia fazer tipo o gmail mesmo") */}
          {x.arquivos.length > 0 && (
            <span className="gm-pilulas">
              {x.arquivos.slice(0, 3).map((nome, i) => {
                const t = extensao(nome) || 'ARQ';
                return <span key={nome + i} className="gm-pilula" title={nome}><span className={'gm-tipo gm-tipo-' + t.toLowerCase()}>{t}</span><span className="gm-pilula-nome">{nome.replace(/\.[a-z0-9]{2,5}$/i, '')}</span></span>;
              })}
              {x.arquivos.length > 3 && <span className="gm-pilula gm-pilula-mais" title={x.arquivos.slice(3).join(', ')}>+{x.arquivos.length - 3}</span>}
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
          <BotaoFechar className="gm-fechar" onClick={fechar} />
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
        <EscolherCliente vm={vm} titulo={x.candidatos?.length ? 'De qual cliente? O robô ficou em dúvida entre ' + x.candidatos.length + (x.candidatos.length === 1 ? ' cliente.' : ' clientes.') : 'De qual cliente?'}
          candidatos={x.candidatos || []} aoEscolher={id => void vm.salvarNoDrive(x, id)} />
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

      {/* longe do X de fechar (14/10/2026: "remova isso daqui, provavelmente vai ser clicado errado"): no pé do e-mail */}
      {(!semDono || (vm.aba !== 'spam' && vm.admin)) && (
        <footer className="gm-pe">
          <span className="fraco">Algo errado com este e-mail?</span>
          {/* marcou a empresa errada (Vitor, 06/10/2026): tira o remetente dela e o e-mail volta para Sem cliente */}
          {!semDono && <button type="button" className="btn btn-outline" onClick={() => void vm.desligar(x).then(ok => { if (ok) fechar(); })}
            title={'Não é de ' + x.clienteNome + ': tirar e escolher de novo'}>Não é deste cliente</button>}
          {vm.aba !== 'spam' && vm.admin && <button type="button" className="btn btn-outline gm-spam" onClick={() => void vm.ignorar(x).then(fechar)}>É spam</button>}
        </footer>
      )}
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

      {vm.erro && <Alerta naLinha titulo="" texto={vm.erro} />}
      {vm.robo.erro && <Alerta naLinha titulo="A última leitura deu erro" texto={vm.robo.erro} />}
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

      <div className="gm-caixa">
        {/* a lista */}
        <div className="gm-lista">
          <div className="gm-abas">
            {ABAS.map(x => (
              <button key={x.valor} type="button" className={'gm-aba' + (vm.aba === x.valor ? ' ativa' : '')} onClick={() => vm.setAba(x.valor)} aria-pressed={vm.aba === x.valor}>
                {x.rotulo}<span className="gm-aba-num"><NumeroQueConta texto={String(vm.contagem[x.valor])} /></span>
              </button>
            ))}
          </div>
          <div className="chip-row gm-filtros">
            {PERIODOS.map(p => <button key={p.valor} type="button" className={'chip-f' + (vm.periodo === p.valor ? ' on' : '')} aria-pressed={vm.periodo === p.valor} onClick={() => vm.setPeriodo(p.valor)}>{p.rotulo}</button>)}
            <span className="gm-filtros-sep" aria-hidden="true" />
            <button type="button" className={'chip-f' + (vm.comAnexo ? ' on' : '')} aria-pressed={vm.comAnexo} onClick={() => vm.setComAnexo(!vm.comAnexo)}>Com anexo</button>
            <button type="button" className={'chip-f' + (vm.foraDoDrive ? ' on' : '')} aria-pressed={vm.foraDoDrive} onClick={() => vm.setForaDoDrive(!vm.foraDoDrive)}>Fora do Drive</button>
            {vm.filtrando && <button type="button" className="btn btn-ghost gm-limpar" onClick={vm.limparFiltros}>Limpar</button>}
            <span className="gm-filtros-conta fraco">{vm.linhas.length} {vm.linhas.length === 1 ? 'e-mail' : 'e-mails'}</span>
          </div>
          {vm.carregando ? <div className="gm-lista-vazia"><Esqueleto linhas={6} /></div>
            : !vm.linhas.length ? (
              <div className="gm-lista-vazia">
                <span className="gm-vazio-icone" aria-hidden="true"><Icone nome="caixaEntrada" /></span>
                <b>Nada aqui</b>
                <span className="fraco">{vm.busca || vm.filtrando ? 'Nenhum e-mail com essa busca ou filtro.' : vm.aba === 'sem-cliente' ? 'Todo e-mail já tem cliente.' : vm.aba === 'spam' ? 'Nenhum spam.' : 'Nenhum e-mail de cliente.'}</span>
              </div>
            ) : (
              <ul className="gm-itens">
                {vm.grupos.map(g => (
                  <li key={g.rotulo} className="gm-grupo">
                    <p className="gm-grupo-rotulo">{g.rotulo}<span>{g.itens.length}</span></p>
                    <ul>{g.itens.map(x => <Item key={x.mensagemId} vm={vm} x={x} aberto={vm.aberto?.mensagemId === x.mensagemId} />)}</ul>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
      {/* o e-mail aberto numa janela flutuante por cima da lista (14/10/2026: "quero que você coloque uma tela flutuante
          mesmo, esse layout fica estranho"); clicar fora ou Esc fecha */}
      {vm.aberto && (
        <div className="cad-janela-fundo" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fechar(); }}>
          <div className="cad-janela gm-janela" role="dialog" aria-modal="true" aria-label={vm.aberto.assunto || 'E-mail'}>
            <Leitura key={vm.aberto.mensagemId} vm={vm} x={vm.aberto} />
          </div>
        </div>
      )}
    </section>
  );
}
