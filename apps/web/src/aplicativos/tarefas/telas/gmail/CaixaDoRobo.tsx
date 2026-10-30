// Gmail › E-mails (Vitor, 13/10/2026: "agora quero que refaça toda a UI do Gmail"; 30/10/2026: "esse modelo de como ta o
// gmail ta muito feio, quero que retrabalhe ele por completo, buscando referencias de apps de gmail"). No modelo dos apps
// de e-mail (Gmail, Outlook, Spark): à esquerda as pastas (De clientes · Sem cliente · Enviados · Spam, com quantos em
// cada), a caixa escolhida e como o robô está; no meio a barra de busca larga, os filtros e a lista, uma linha por e-mail
// (quem, assunto — começo do texto, os anexos em pílulas, no Drive e a hora; ao passar o mouse, Salvar no Drive e Abrir
// no Gmail no lugar da hora). O e-mail abre numa gaveta que sai da direita, por cima da lista (14/10/2026: "quero que você
// coloque uma tela flutuante mesmo"): a barra de ações em cima, quem mandou, o texto, os anexos em cartões, as respostas
// e responder; "Não é deste cliente" e "É spam" ficam no pé, longe do fechar. No celular, as pastas viram abas e a gaveta
// ocupa a tela.
import type { entregas as e } from '@nads/core';
import { Alerta, BotaoIcone, Esqueleto, Icone, NumeroQueConta, useCarregando, useJanela, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { useCaixaDoRobo, usePainelDoEmail, type AbaDaCaixa, type PeriodoDaCaixa, type VmCaixa } from './useCaixaDoRobo';

const PASTAS: { valor: AbaDaCaixa; rotulo: string; icone: NomeIcone; dica: string }[] = [
  { valor: 'clientes', rotulo: 'De clientes', icone: 'caixaEntrada', dica: 'E-mails que o robô ligou a um cliente' },
  { valor: 'sem-cliente', rotulo: 'Sem cliente', icone: 'usuario', dica: 'Remetentes que ainda não são de nenhum cliente' },
  // o que a caixa mandou aos clientes (Heverton, 20/10/2026: "colocar os enviados no gmail")
  { valor: 'enviados', rotulo: 'Enviados', icone: 'aviao', dica: 'O que a caixa mandou aos clientes' },
  { valor: 'spam', rotulo: 'Spam', icone: 'alert', dica: 'Remetentes marcados como spam' },
];

const PERIODOS: { valor: PeriodoDaCaixa; rotulo: string }[] = [
  { valor: 'tudo', rotulo: 'Tudo' }, { valor: 'hoje', rotulo: 'Hoje' }, { valor: '7d', rotulo: '7 dias' }, { valor: '30d', rotulo: '30 dias' },
];

/** A cor da inicial, sempre a mesma para o mesmo remetente (seis tons do nads). */
const TONS = ['azul', 'verde', 'roxo', 'laranja', 'ciano', 'rosa'] as const;
const tomDe = (t: string) => TONS[[...t].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7) % TONS.length];
const inicialDe = (x: e.EmailDaCaixa) => (x.clienteNome || x.nome || x.remetente || '?').trim().charAt(0).toUpperCase();

/** A extensão do anexo, em maiúsculas (PDF, XML…). */
const extensao = (nome: string) => (/\.([a-z0-9]{2,5})$/i.exec(nome)?.[1] || '').toUpperCase();
const semExtensao = (nome: string) => nome.replace(/\.[a-z0-9]{2,5}$/i, '');
const tamanho = (bytes: number) => (bytes >= 1048576 ? (bytes / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB');

function Avatar({ x, grande }: { x: e.EmailDaCaixa; grande?: boolean }) {
  return <span className={'mx-avatar gm-tom-' + tomDe(x.remetente || x.nome || '') + (grande ? ' grande' : '')} aria-hidden="true">{inicialDe(x)}</span>;
}

/** A pílula de um anexo (o tipo colorido e o nome). */
function Pilula({ nome }: { nome: string }) {
  const t = extensao(nome) || 'ARQ';
  return <span className="mx-pilula" title={nome}><span className={'gm-tipo gm-tipo-' + t.toLowerCase()}>{t}</span><span className="mx-pilula-nome">{semExtensao(nome)}</span></span>;
}

/** Escolher o cliente dentro do e-mail aberto: uma busca com a lista embaixo. */
function EscolherCliente({ vm, titulo, aoEscolher, candidatos = [] }: { vm: VmCaixa; titulo: string; aoEscolher: (clienteId: string) => void; candidatos?: readonly string[] }) {
  const [busca, setBusca] = useState('');
  const achados = vm.clientesQueBatem(busca);
  // os candidatos do robô (podem ser dezenas): só os 5 primeiros, em etiquetas que escolhem num clique; o resto pela busca
  const sugeridos = busca ? [] : candidatos.slice(0, 5).map(nome => ({ nome, cliente: vm.clientesQueBatem(nome)[0] || null }));
  return (
    <div className="mx-escolher">
      <p className="mx-escolher-titulo"><Icone nome="briefcase" />{titulo}</p>
      <label className="busca-curta larga">
        <Icone nome="search" />
        <input type="text" placeholder="Código ou nome do cliente" value={busca} onChange={ev => setBusca(ev.target.value)} aria-label={titulo} autoFocus />
      </label>
      {sugeridos.length > 0 && (
        <div className="mx-candidatos">
          {/* achou o cliente: escolhe num clique; não achou: o nome vai para a busca */}
          {sugeridos.map(c => <button key={c.nome} type="button" className="mx-sugestao" onClick={() => (c.cliente ? aoEscolher(c.cliente.id) : setBusca(c.nome))}>{c.nome}</button>)}
          {candidatos.length > sugeridos.length && <span className="fraco">e mais {candidatos.length - sugeridos.length}: use a busca</span>}
        </div>
      )}
      {achados.length > 0 && (
        <div className="emp-list mx-escolher-lista">
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

/** Um e-mail na lista (a linha do Gmail). */
function Linha({ vm, x, aberto }: { vm: VmCaixa; x: e.EmailDaCaixa; aberto: boolean }) {
  const salvo = vm.salvo(x);
  const parecido = vm.aba === 'sem-cliente' ? vm.parecido(x) : null;
  const q = vm.quem(x);
  const podeSalvar = !salvo && !!x.clienteId && x.arquivos.length > 0 && !x.enviado;
  return (
    <li>
      <div role="button" tabIndex={0} className={'mx-linha' + (aberto ? ' aberta' : '')} data-linha={x.mensagemId}
        onClick={() => vm.abrir(x.mensagemId)} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); vm.abrir(x.mensagemId); } }}>
        <Avatar x={x} />
        <span className="mx-quem" title={q.completo}>
          {x.enviado && <span className="mx-para">Para</span>}
          {q.codigo && <span className="mx-cod">{q.codigo}</span>}
          <span className="mx-nome">{q.nome}</span>
        </span>
        <span className="mx-meio">
          <span className="mx-assunto"><b>{x.assunto || '(sem assunto)'}</b>{x.trecho && <span className="mx-trecho"> — {x.trecho}</span>}</span>
          {(x.arquivos.length > 0 || parecido) && (
            <span className="mx-pilulas">
              {/* os anexos em pílulas embaixo, como no Gmail (14/10/2026: "podia fazer tipo o gmail mesmo") */}
              {x.arquivos.slice(0, 3).map((nome, i) => <Pilula key={nome + i} nome={nome} />)}
              {x.arquivos.length > 3 && <span className="mx-pilula mx-pilula-mais" title={x.arquivos.slice(3).join(', ')}>+{x.arquivos.length - 3}</span>}
              {parecido && (
                <button type="button" className="mx-sugestao" title={'Ligar ' + x.remetente + ' a ' + parecido.nome}
                  onClick={ev => { ev.stopPropagation(); void vm.ligar(x, parecido.id); }}>
                  É {parecido.nome.split(' ').slice(0, 2).join(' ')}?
                </button>
              )}
            </span>
          )}
        </span>
        <span className="mx-lado">
          <span className="mx-sinais">
            {x.arquivos.length > 0 && <span className="mx-clipe" title={x.arquivos.length + (x.arquivos.length === 1 ? ' anexo' : ' anexos')}><Icone nome="clipe" /></span>}
            {salvo && <span className="mx-drive" title={'No Drive: ' + salvo.pasta}><Icone nome="check" />Drive</span>}
          </span>
          <span className="mx-hora">{vm.quandoFoi(x.em)}</span>
          {/* as ações rápidas do Gmail: aparecem no lugar da hora ao passar o mouse */}
          <span className="mx-acoes-rapidas" onClick={ev => ev.stopPropagation()} onKeyDown={ev => ev.stopPropagation()}>
            {podeSalvar && <BotaoIcone icone="pasta" titulo="Salvar os anexos no Drive" pequeno onClick={() => void vm.salvarNoDrive(x)} />}
            <a className="icon-btn icon-btn-sm" href={vm.linkDoGmail(x.mensagemId)} target="_blank" rel="noopener noreferrer" title="Abrir no Gmail" aria-label="Abrir no Gmail"><Icone nome="link" /></a>
          </span>
        </span>
      </div>
    </li>
  );
}

/** O e-mail aberto, na gaveta da direita. */
function Leitura({ vm, x }: { vm: VmCaixa; x: e.EmailDaCaixa }) {
  const p = usePainelDoEmail(x);
  const [respondendo, setRespondendo] = useState(false);
  const m = p.lido.email;
  const salvo = vm.salvo(x);
  const semDono = !x.clienteId;
  const naCaixaSemCliente = vm.aba === 'sem-cliente';
  const anexos = m?.anexos.length ? m.anexos : x.arquivos.map(nome => ({ nome, tamanho: 0 }));
  const quem = x.nome || x.remetente;
  const quando = x.em ? new Date(x.em).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const abrirResposta = (todos: boolean) => { p.setTodos(todos); setRespondendo(true); };
  return (
    <article className="mx-leitura" aria-label={x.assunto || 'E-mail'}>
      {/* a barra de ações, como a do Gmail: voltar, salvar, abrir no Gmail */}
      <div className="mx-leitura-barra">
        <BotaoIcone icone="chevronLeft" titulo="Voltar para a lista (Esc)" onClick={vm.fechar} />
        <span className="mx-barra-sep" aria-hidden="true" />
        {!semDono && (salvo
          ? <span className="mx-drive grande" title={salvo.pasta}><Icone nome="check" />Salvo no Drive</span>
          : anexos.length > 0 && <button type="button" className="btn btn-primary btn-sm" onClick={() => void vm.salvarNoDrive(x)}><Icone nome="pasta" />Salvar no Drive</button>)}
        <span className="tarefas-barra-espaco" />
        <a className="btn btn-ghost btn-sm" href={vm.linkDoGmail(x.mensagemId)} target="_blank" rel="noopener noreferrer"><Icone nome="link" />Abrir no Gmail</a>
      </div>

      <div className="mx-leitura-rola">
        <header className="mx-leitura-topo">
          <h2>{x.assunto || '(sem assunto)'}</h2>
          {x.clienteNome && <span className="mx-etiqueta" title="O cliente deste e-mail"><Icone nome="briefcase" />{x.clienteNome}</span>}
          {x.enviado && <span className="mx-etiqueta"><Icone nome="aviao" />Enviado</span>}
        </header>

        <div className="mx-de">
          <Avatar x={x} grande />
          <div className="mx-de-txt">
            {x.enviado ? (
              // o enviado (20/10/2026): quem recebeu em cima; saiu da caixa do escritório
              <>
                <p><b>Para {quem}</b> <span className="fraco">&lt;{x.remetente}&gt;</span></p>
                <p className="fraco">{'Enviado pela caixa do escritório' + (m?.para && m.para.toLowerCase() !== x.remetente ? ' · Para ' + m.para : '')}{m?.cc ? ' · Cc ' + m.cc : ''}</p>
              </>
            ) : (
              <>
                <p><b>{quem}</b> <span className="fraco">&lt;{x.remetente}&gt;</span></p>
                <p className="fraco">{'para ' + (m?.para || 'a caixa do escritório')}{m?.cc ? ' · Cc ' + m.cc : ''}</p>
              </>
            )}
          </div>
          <span className="mx-de-quando">{quando}</span>
        </div>

        {naCaixaSemCliente ? (
          <EscolherCliente vm={vm} titulo={'De qual cliente é ' + x.remetente + '?'} aoEscolher={id => void vm.ligar(x, id).then(vm.fechar)} />
        ) : semDono ? (
          <EscolherCliente vm={vm} titulo={x.candidatos?.length ? 'De qual cliente? O robô ficou em dúvida entre ' + x.candidatos.length + (x.candidatos.length === 1 ? ' cliente.' : ' clientes.') : 'De qual cliente?'}
            candidatos={x.candidatos || []} aoEscolher={id => void vm.salvarNoDrive(x, id)} />
        ) : null}

        <div className="mx-texto">
          {p.lido.carregando ? <Esqueleto linhas={5} />
            : p.lido.erro ? <p className="fraco">Não consegui ler o e-mail inteiro ({p.lido.erro}). O começo dele: {x.trecho}</p>
              : m?.texto.trim() ? <div className="gm-texto-corpo">{m.texto}{m.truncado ? '\n\n(o e-mail é maior; o resto está no Gmail)' : ''}</div>
                : <p className="fraco">Este e-mail não tem texto, só {anexos.length === 1 ? 'o anexo' : 'os anexos'}.</p>}
        </div>

        {anexos.length > 0 && (
          <section className="mx-secao">
            <p className="mx-secao-titulo">{anexos.length === 1 ? '1 anexo' : anexos.length + ' anexos'}{salvo && <span className="fraco"> · salvos em {salvo.pasta}</span>}</p>
            <ul className="mx-anexos">
              {anexos.map(a => {
                const t = extensao(a.nome) || 'ARQ';
                return (
                  <li key={a.nome} className="mx-anexo" title={a.nome}>
                    <span className={'mx-anexo-capa gm-tipo-' + t.toLowerCase()}><Icone nome="arquivo" /><b>{t}</b></span>
                    <span className="mx-anexo-txt"><b>{semExtensao(a.nome)}</b><span className="fraco">{t}{a.tamanho > 0 ? ' · ' + tamanho(a.tamanho) : ''}</span></span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {p.respostas.length > 0 && (
          <section className="mx-secao">
            <p className="mx-secao-titulo">Respostas</p>
            {p.respostas.map(r => (
              <div key={r.id} className="mx-resposta">
                <p className="mx-resposta-quem"><b>{r.por}</b><span className="fraco">{vm.quandoFoi(r.em)}</span>
                  <span className={'mx-resposta-status ' + r.status}>{r.status === 'enviado' ? 'enviada' : r.status === 'erro' ? 'não saiu' : 'na fila do robô'}</span></p>
                {r.status === 'erro' && r.erro && <p className="fraco">{r.erro}</p>}
                <p>{r.corpo}</p>
              </div>
            ))}
          </section>
        )}

        {/* responder como no Gmail: os botões no fim do e-mail; o campo abre ao clicar */}
        {respondendo ? (
          <form className="mx-responder" onSubmit={ev => { ev.preventDefault(); void p.responder().then(() => setRespondendo(false)); }}>
            <p className="mx-responder-para"><Icone nome="seta" />{p.todos ? 'Responder a todos' : 'Para ' + x.remetente}</p>
            <textarea rows={5} placeholder="Escreva a resposta… (Ctrl+Enter envia)" value={p.texto} onChange={ev => p.setTexto(ev.target.value)} autoFocus
              onKeyDown={ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); void p.responder().then(() => setRespondendo(false)); } }} aria-label="Resposta" />
            <div className="mx-responder-pe">
              <button type="submit" className="btn btn-primary" disabled={!p.texto.trim() || p.enviando}><Icone nome="aviao" />{p.enviando ? 'Enviando…' : 'Enviar'}</button>
              <label className="mx-todos"><input type="checkbox" checked={p.todos} onChange={ev => p.setTodos(ev.target.checked)} />Responder a todos</label>
              <span className="tarefas-barra-espaco" />
              <BotaoIcone icone="lixeira" titulo="Descartar a resposta" onClick={() => { p.setTexto(''); setRespondendo(false); }} />
            </div>
          </form>
        ) : (
          <div className="mx-responder-botoes">
            <button type="button" className="btn btn-outline" onClick={() => abrirResposta(false)}><Icone nome="seta" />Responder</button>
            <button type="button" className="btn btn-outline" onClick={() => abrirResposta(true)}><Icone nome="usuario" />Responder a todos</button>
          </div>
        )}

        {/* longe da barra de cima (14/10/2026: "remova isso daqui, provavelmente vai ser clicado errado"): no pé do e-mail */}
        {/* no enviado não há o que desfazer: o cliente veio do destinatário e não é spam */}
        {!x.enviado && (!semDono || (vm.aba !== 'spam' && vm.admin)) && (
          <footer className="mx-pe">
            <span className="fraco">Algo errado com este e-mail?</span>
            {/* marcou a empresa errada (Vitor, 06/10/2026): tira o remetente dela e o e-mail volta para Sem cliente */}
            {!semDono && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void vm.desligar(x).then(ok => { if (ok) vm.fechar(); })}
              title={'Não é de ' + x.clienteNome + ': tirar e escolher de novo'}>Não é deste cliente</button>}
            {vm.aba !== 'spam' && vm.admin && <button type="button" className="btn btn-ghost btn-sm mx-spam" onClick={() => void vm.ignorar(x).then(vm.fechar)}>É spam</button>}
          </footer>
        )}
      </div>
    </article>
  );
}

/** A gaveta da direita com o e-mail aberto: Esc e clicar fora fecham; o foco fica dentro dela. */
function Gaveta({ vm, x }: { vm: VmCaixa; x: e.EmailDaCaixa }) {
  const ref = useRef<HTMLDivElement>(null);
  useJanela(ref, vm.fechar);
  // a lista não rola por trás enquanto a gaveta está aberta
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);
  return (
    <div className="mx-gaveta-fundo" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fechar(); }}>
      <div ref={ref} className="mx-gaveta" role="dialog" aria-modal="true" aria-label={x.assunto || 'E-mail'}>
        <Leitura key={x.mensagemId} vm={vm} x={x} />
      </div>
    </div>
  );
}

export function CaixaDoRobo() {
  const vm = useCaixaDoRobo();
  useCarregando(vm.carregando);
  const a = vm.robo.andamento;
  const estado = !vm.robo.online ? 'fora' : vm.robo.lendo ? 'lendo' : 'online';
  const pasta = PASTAS.find(p => p.valor === vm.aba) || PASTAS[0];
  return (
    <section className="mx">
      {vm.erro && <Alerta naLinha titulo="" texto={vm.erro} />}
      {vm.robo.erro && <Alerta naLinha titulo="A última leitura deu erro" texto={vm.robo.erro} />}
      {vm.exemplos && <p className="hint">Dados de exemplo: a caixa é inventada e nada vai para o Gmail.</p>}

      <div className="mx-app">
        {/* as pastas, como a barra da esquerda do Gmail */}
        <nav className="mx-pastas" aria-label="Pastas">
          {/* as caixas (a do escritório e as dos setores), como a troca de contas do Gmail */}
          {vm.caixas.length > 1 && (
            <div className="mx-contas" role="group" aria-label="Caixa">
              <p className="subnav-titulo">Caixas</p>
              {vm.caixas.map(c => (
                <button key={c.valor} type="button" className={'subnav-item mx-conta-btn' + (vm.caixa === c.valor ? ' active' : '')} aria-pressed={vm.caixa === c.valor} onClick={() => vm.escolherCaixa(c.valor)}>
                  <span className="mx-conta-ini" aria-hidden="true">{c.rotulo.replace(/^Setor\s+/i, '').charAt(0).toUpperCase()}</span>
                  <span className="mx-conta-nome">{c.rotulo}</span>
                </button>
              ))}
            </div>
          )}
          <p className={'subnav-titulo' + (vm.caixas.length > 1 ? ' depois' : '')}>Pastas</p>
          <ul>
            {PASTAS.map(p => (
              <li key={p.valor}>
                <button type="button" className={'subnav-item mx-pasta' + (vm.aba === p.valor ? ' active' : '')} aria-current={vm.aba === p.valor ? 'page' : undefined}
                  title={p.dica} onClick={() => vm.setAba(p.valor)}>
                  <Icone nome={p.icone} />
                  <span className="mx-pasta-nome">{p.rotulo}</span>
                  {vm.contagem[p.valor] > 0 && <span className="mx-pasta-num"><NumeroQueConta texto={String(vm.contagem[p.valor])} /></span>}
                </button>
              </li>
            ))}
            {/* o Histórico das leituras (30/10/2026: "pode remover a barra lateral dessa aba"): sem a barra do app, ele vira
                mais uma linha das pastas */}
            <li>
              <Link className="subnav-item mx-pasta" to={caminhoDaPagina('contato', 'historico')} title="As últimas leituras do robô">
                <Icone nome="clock" /><span className="mx-pasta-nome">Histórico do robô</span>
              </Link>
            </li>
          </ul>
          {/* como o robô está, no pé das pastas */}
          <div className={'mx-robo mx-robo-' + estado} title={vm.robo.visto ? 'Último sinal ' + vm.robo.visto : 'Sem sinal do robô'}>
            <i aria-hidden="true" />
            <span className="mx-robo-txt">
              <b>{estado === 'fora' ? 'Robô fora do ar' : estado === 'lendo' ? 'Lendo o Gmail…' : 'Robô online'}</b>
              <span className="fraco">{[vm.robo.ultimaLeitura && 'lido ' + vm.robo.ultimaLeitura, vm.robo.naFila > 0 && vm.robo.naFila + ' na fila'].filter(Boolean).join(' · ') || ' '}</span>
            </span>
          </div>
        </nav>

        <div className="mx-principal">
          {/* a barra de cima com as peças do site (30/10/2026: "pode fazer essa tela parecer mais parte do site?"): a busca de
              lupa, os filtros em fichas e Verificar agora, como nas outras telas da Tarefa */}
          <div className="tarefas-barra-topo mx-topo">
            <label className="busca-curta mx-busca">
              <Icone nome="search" />
              <input type="text" placeholder={'Buscar em ' + pasta.rotulo.toLowerCase()} aria-label="Buscar e-mail" value={vm.busca} onChange={ev => vm.setBusca(ev.target.value)}
                onKeyDown={ev => { if (ev.key === 'Escape') vm.setBusca(''); }} />
            </label>
            {PERIODOS.map(p => <button key={p.valor} type="button" className={'chip-f' + (vm.periodo === p.valor ? ' on' : '')} aria-pressed={vm.periodo === p.valor} onClick={() => vm.setPeriodo(p.valor)}>{p.rotulo}</button>)}
            <span className="mx-sep" aria-hidden="true" />
            <button type="button" className={'chip-f' + (vm.comAnexo ? ' on' : '')} aria-pressed={vm.comAnexo} onClick={() => vm.setComAnexo(!vm.comAnexo)}>Com anexo</button>
            <button type="button" className={'chip-f' + (vm.foraDoDrive ? ' on' : '')} aria-pressed={vm.foraDoDrive} onClick={() => vm.setForaDoDrive(!vm.foraDoDrive)}>Fora do Drive</button>
            {vm.filtrando && <button type="button" className="btn btn-ghost dp-limpar" onClick={vm.limparFiltros}><Icone nome="x" />Limpar filtros</button>}
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-outline" onClick={() => void vm.verificar()} title="Pedir ao robô para ler os e-mails dos últimos 3 dias"><Icone nome="repeat" /><span className="mx-some-celular">Verificar agora</span></button>
          </div>

          {a && (
            <div className="mx-andamento">
              <span className="mx-andamento-icone" aria-hidden="true"><Icone nome="repeat" /></span>
              <div className="mx-andamento-txt">
                <b>{a.tipo === 'salvar' ? 'Salvando no Drive' : a.tipo === 'disparo' ? 'Enviando e-mails' : 'Lendo o Gmail'}{a.total ? ' · ' + Math.round((a.feito / a.total) * 100) + '%' : ''}</b>
                {a.total > 0 && <span className="tarefas-barra larga andando"><span style={{ width: Math.min(100, (a.feito / a.total) * 100) + '%' }} /></span>}
                {a.recentes.length > 0 && <span className="fraco">{a.recentes[a.recentes.length - 1].texto}</span>}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void vm.cancelar()}>Cancelar</button>
            </div>
          )}

          {/* a lista num cartão, como as outras listas do site; no alto, a pasta e quantos e-mails */}
          <section className="card mx-cartao">
          <div className="mx-cartao-topo">
            <h3 className="mx-cartao-titulo">{pasta.rotulo}</h3>
            <span className="mx-total">{vm.linhas.length} {vm.linhas.length === 1 ? 'e-mail' : 'e-mails'}</span>
          </div>

          {vm.carregando ? <div className="mx-vazio"><Esqueleto linhas={8} /></div>
            : !vm.linhas.length ? (
              <div className="mx-vazio">
                <span className="mx-vazio-icone" aria-hidden="true"><Icone nome={pasta.icone} /></span>
                <b>{vm.busca || vm.filtrando ? 'Nada encontrado' : 'Tudo em dia'}</b>
                <span className="fraco">{vm.busca || vm.filtrando ? 'Nenhum e-mail com essa busca ou filtro.' : vm.aba === 'sem-cliente' ? 'Todo e-mail já tem cliente.' : vm.aba === 'spam' ? 'Nenhum spam.' : vm.aba === 'enviados' ? 'Nenhum e-mail enviado a cliente nos últimos dias (o robô lê os enviados a cada leitura).' : 'Nenhum e-mail de cliente.'}</span>
                {(vm.busca || vm.filtrando) && <button type="button" className="btn btn-outline btn-sm" onClick={() => { vm.setBusca(''); vm.limparFiltros(); }}>Limpar a busca e os filtros</button>}
              </div>
            ) : (
              <ul className="mx-lista">
                {vm.grupos.map(g => (
                  <li key={g.rotulo} className="mx-grupo">
                    <p className="mx-grupo-rotulo">{g.rotulo}<span>{g.itens.length}</span></p>
                    <ul>{g.itens.map(x => <Linha key={x.mensagemId} vm={vm} x={x} aberto={vm.aberto?.mensagemId === x.mensagemId} />)}</ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {vm.aberto && <Gaveta vm={vm} x={vm.aberto} />}
    </section>
  );
}
