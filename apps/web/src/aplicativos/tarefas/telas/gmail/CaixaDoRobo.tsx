// Gmail › E-mails: a caixa do robô do Gmail (como nas Pendências). No topo, como o robô está, "Verificar o Gmail
// agora" e o andamento da leitura; as abas (de clientes, sem cliente, spam) com a busca; a lista; e o e-mail aberto
// numa janela por cima, com o texto inteiro, os anexos, as ações e responder.
import type { entregas as e } from '@nads/core';
import { Esqueleto, Icone, NumeroQueConta, useCarregando, useEntradaAnimada, useIndicador, useLinhasQueSeMovem, Segmentado } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useCaixaDoRobo, usePainelDoEmail, type AbaDaCaixa, type VmCaixa } from './useCaixaDoRobo';

const ABAS: { id: AbaDaCaixa; rotulo: string }[] = [
  { id: 'clientes', rotulo: 'De clientes' },
  { id: 'sem-cliente', rotulo: 'Sem cliente' },
  { id: 'spam', rotulo: 'Spam' },
];

/** As ações na linha da lista (o resto fica no e-mail aberto, onde há espaço). */
function AcoesDaLinha({ vm, x }: { vm: VmCaixa; x: e.EmailDaCaixa }) {
  const salvo = vm.salvo(x);
  const parecido = vm.aba === 'sem-cliente' ? vm.parecido(x) : null;
  return (
    <span className="gmail-acoes" onClick={ev => ev.stopPropagation()}>
      {vm.aba === 'sem-cliente' ? (
        <>
          {parecido && <button type="button" className="btn btn-outline btn-sm" title={'Ligar ' + x.remetente + ' a ' + parecido.nome} onClick={() => void vm.ligar(x, parecido.id)}>É {parecido.nome.split(' ').slice(0, 2).join(' ')}</button>}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.abrir(x.mensagemId)}>Escolher cliente…</button>
        </>
      ) : x.clienteId ? (
        salvo ? <span className="badge badge-ok" title={salvo.pasta}>no Drive</span>
          : x.arquivos.length > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={() => void vm.salvarNoDrive(x)}>Salvar no Drive</button>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.abrir(x.mensagemId)}>De qual cliente?</button>
      )}
      <a className="btn btn-ghost btn-sm gmail-icone" href={vm.linkDoGmail(x.mensagemId)} target="_blank" rel="noopener noreferrer" title="Abrir no Gmail" aria-label="Abrir no Gmail"><Icone nome="envelope" /></a>
    </span>
  );
}

/** Escolher o cliente dentro do e-mail aberto: uma busca com a lista embaixo (sem menu que fique cortado). */
function EscolherCliente({ vm, titulo, aoEscolher }: { vm: VmCaixa; titulo: string; aoEscolher: (clienteId: string) => void }) {
  const [busca, setBusca] = useState('');
  const achados = vm.clientesQueBatem(busca);
  return (
    <div className="gmail-escolher">
      <p className="gmail-rotulo">{titulo}</p>
      <label className="busca-curta larga">
        <Icone nome="search" />
        <input type="text" placeholder="Código ou nome do cliente" value={busca} onChange={ev => setBusca(ev.target.value)} aria-label={titulo} />
      </label>
      {achados.length > 0 && (
        <div className="emp-list gmail-escolher-lista">
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

function PainelDoEmail({ vm, x }: { vm: VmCaixa; x: e.EmailDaCaixa }) {
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
  const inicial = (x.nome || x.remetente || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="cad-janela-fundo" data-volta-para={'[data-linha="' + x.mensagemId + '"]'} onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div className="cad-janela gmail-janela" role="dialog" aria-modal="true" aria-label={x.assunto || 'E-mail'}>
        <header className="cad-janela-topo">
          <button type="button" className="btn btn-ghost btn-sm" onClick={fechar}><Icone nome="chevronLeft" />E-mails</button>
          <span className="cad-janela-empresa"><span className="cad-janela-nome">{x.assunto || '(sem assunto)'}</span></span>
          <button type="button" className="btn btn-ghost btn-sm cad-janela-x" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>
        <div className="cad-janela-conteudo gmail-painel">
          <div className="gmail-de">
            <span className="gmail-inicial" aria-hidden="true">{inicial}</span>
            <div className="gmail-de-txt">
              <p><b>{x.nome || x.remetente}</b> <span className="fraco">&lt;{x.remetente}&gt;</span></p>
              <p className="fraco">{'Para ' + (m?.para || 'a caixa do escritório')}{m?.cc ? ' · Cc ' + m.cc : ''}</p>
              <p className="fraco">{x.em ? new Date(x.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                {x.clienteNome && <> · <span className="badge badge-neutral">{x.clienteNome}</span></>}</p>
            </div>
            <div className="gmail-de-acoes">
              {!semDono && (salvo
                ? <span className="badge badge-ok" title={salvo.pasta}>no Drive</span>
                : anexos.length > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={() => void vm.salvarNoDrive(x)}><Icone nome="pasta" />Salvar no Drive</button>)}
              <a className="btn btn-outline btn-sm" href={vm.linkDoGmail(x.mensagemId)} target="_blank" rel="noopener noreferrer"><Icone nome="envelope" />Abrir no Gmail</a>
              {vm.aba !== 'spam' && vm.admin && <button type="button" className="btn btn-outline btn-sm gmail-spam" onClick={() => void vm.ignorar(x).then(fechar)}>É spam</button>}
            </div>
          </div>

          {naCaixaSemCliente ? (
            <EscolherCliente vm={vm} titulo={'De qual cliente é ' + x.remetente + '?'} aoEscolher={id => void vm.ligar(x, id).then(fechar)} />
          ) : semDono ? (
            <EscolherCliente vm={vm} titulo={x.candidatos?.length ? 'De qual cliente? (o robô ficou entre ' + x.candidatos.join(' e ') + ')' : 'De qual cliente?'}
              aoEscolher={id => void vm.salvarNoDrive(x, id)} />
          ) : null}

          <div className="gmail-corpo">
            {p.lido.carregando ? <Esqueleto linhas={5} />
              : p.lido.erro ? <p className="fraco">Não consegui ler o e-mail inteiro ({p.lido.erro}). O começo dele: {x.trecho}</p>
                : m?.texto.trim() ? <div className="gmail-texto">{m.texto}{m.truncado ? '\n\n(o e-mail é maior; o resto está no Gmail)' : ''}</div>
                  : <p className="fraco">Este e-mail não tem texto, só {anexos.length === 1 ? 'o anexo' : 'os anexos'}.</p>}
          </div>

          {anexos.length > 0 && (
            <div className="gmail-anexos">
              <p className="gmail-rotulo">{anexos.length === 1 ? '1 anexo' : anexos.length + ' anexos'}</p>
              <ul>{anexos.map(a => <li key={a.nome}><Icone nome="arquivo" /><span>{a.nome}</span>{a.tamanho > 0 && <span className="fraco">{Math.max(1, Math.round(a.tamanho / 1024))} KB</span>}</li>)}</ul>
            </div>
          )}

          {p.respostas.length > 0 && (
            <div className="gmail-respostas">
              <p className="gmail-rotulo">Respostas</p>
              {p.respostas.map(r => (
                <div key={r.id} className="gmail-resposta">
                  <p className="fraco">{r.por} · {vm.quandoFoi(r.em)} · {r.status === 'enviado' ? 'enviada' : r.status === 'erro' ? 'não saiu: ' + (r.erro || '') : 'na fila do robô'}</p>
                  <p>{r.corpo}</p>
                </div>
              ))}
            </div>
          )}

          <form className="gmail-responder" onSubmit={ev => { ev.preventDefault(); void p.responder(); }}>
            <p className="gmail-rotulo">Responder</p>
            <textarea rows={4} placeholder={'Escreva a resposta para ' + x.remetente + ' (Ctrl+Enter envia)'} value={p.texto} onChange={ev => p.setTexto(ev.target.value)}
              onKeyDown={ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); void p.responder(); } }} />
            <div className="gmail-responder-pe">
              <label className="gmail-todos"><input type="checkbox" checked={p.todos} onChange={ev => p.setTodos(ev.target.checked)} />Responder a todos</label>
              <span className="tarefas-barra-espaco" />
              <button type="submit" className="btn btn-primary btn-sm" disabled={!p.texto.trim() || p.enviando}>{p.enviando ? 'Enviando…' : 'Enviar resposta'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function CaixaDoRobo() {
  const vm = useCaixaDoRobo();
  useCarregando(vm.carregando);
  // trocou de caixa ou de aba (ou chegou a lista): os e-mails chegam em cascata, do jeito do app
  const tabela = useEntradaAnimada<HTMLDivElement>('tbody > tr', [vm.caixa, vm.aba, vm.carregando], 'lista');
  // a aba escolhida (De clientes, Sem cliente, Spam): o destaque desliza até ela
  const chipsInd = useIndicador<HTMLDivElement>('.chip-f.on', [vm.aba], 'fundo');
  // saiu um e-mail da lista (ligou ao cliente, ignorou, salvou) ou chegou um novo: os outros deslizam e fecham o espaço
  const linhasQueSeMovem = useLinhasQueSeMovem<HTMLTableElement>(vm.carregando ? '' : vm.linhas.map(x => x.mensagemId).join('|'), vm.caixa + '/' + vm.aba);
  const a = vm.robo.andamento;
  return (
    <section>
      {vm.caixas.length > 1 && (
        <div className="gmail-caixas">
          <Segmentado valor={vm.caixa} opcoes={vm.caixas} onMudar={vm.escolherCaixa} />
        </div>
      )}
      <div className="tarefas-barra-topo">
        <span className={'gmail-robo' + (vm.robo.online ? ' online' : '')} title={vm.robo.visto ? 'Último sinal ' + vm.robo.visto : 'Sem sinal do robô'}>
          <Icone nome="robo" />{vm.robo.online ? (vm.robo.lendo ? 'Robô lendo o Gmail' : 'Robô online') : 'Robô fora do ar'}
          {vm.robo.naFila > 0 && <span className="fraco"> · {vm.robo.naFila} na fila</span>}
          {vm.robo.ultimaLeitura && <span className="fraco"> · última leitura {vm.robo.ultimaLeitura}</span>}
        </span>
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar e-mail" aria-label="Buscar e-mail" value={vm.busca} onChange={ev => vm.setBusca(ev.target.value)}
            onKeyDown={ev => { if (ev.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => void vm.verificar()}><Icone nome="repeat" />Verificar o Gmail agora</button>
      </div>

      {vm.erro && <div className="alert"><Icone nome="alert" /><div><p className="alert-text">{vm.erro}</p></div></div>}
      {vm.robo.erro && <div className="alert"><Icone nome="alert" /><div><p className="alert-title">A última leitura deu erro</p><p className="alert-text">{vm.robo.erro}</p></div></div>}
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: a caixa é inventada e nada vai para o Gmail.</p>}

      {a && (
        <div className="card gmail-andamento">
          <div className="gmail-andamento-topo">
            <b>{a.tipo === 'salvar' ? 'Salvando no Drive' : a.tipo === 'disparo' ? 'Enviando e-mails' : 'Lendo o Gmail'}</b>
            <span className="fraco">{a.total ? Math.round((a.feito / a.total) * 100) + '%' : ''}</span>
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void vm.cancelar()}>Cancelar</button>
          </div>
          {a.total > 0 && <span className="tarefas-barra larga"><span style={{ width: Math.min(100, (a.feito / a.total) * 100) + '%' }} /></span>}
          <ul className="gmail-andamento-passos">{a.recentes.slice(-4).map((r, i) => <li key={i} className={r.destaque ? 'destaque' : undefined}>{r.texto}</li>)}</ul>
        </div>
      )}

      <div ref={chipsInd} className="chip-row com-indicador">
        {ABAS.map(x => (
          <button key={x.id} type="button" className={'chip-f' + (vm.aba === x.id ? ' on' : '')} onClick={() => vm.setAba(x.id)}>
            {x.rotulo} <span className="gh-counter"><NumeroQueConta texto={String(vm.contagem[x.id])} /></span>
          </button>
        ))}
      </div>

      {!vm.carregando && !vm.linhas.length ? <p className="empty">Nenhum e-mail aqui.</p> : (
        <div ref={tabela} className="table-wrap">
          <table ref={linhasQueSeMovem} className="tabela-empresas gmail-tabela">
            <thead><tr><th>Quando</th><th>De</th><th>Assunto</th><th>Anexos</th><th /></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(x => (
                <tr key={x.mensagemId} data-linha={x.mensagemId} className="linha-abre" tabIndex={0} onClick={() => vm.abrir(x.mensagemId)} onKeyDown={ev => { if (ev.key === 'Enter') vm.abrir(x.mensagemId); }}>
                  <td className="fraco num">{vm.quandoFoi(x.em)}</td>
                  <td><span className="cad-conta"><span>{x.clienteNome || x.nome || x.remetente}</span><span className="fraco">{x.remetente}</span></span></td>
                  <td className="gmail-assunto"><b>{x.assunto || '(sem assunto)'}</b><span className="fraco"> — {x.trecho}</span></td>
                  <td className="fraco num">{x.arquivos.length ? <span title={x.arquivos.join(', ')}><Icone nome="arquivo" className="drive-ico" /> {x.arquivos.length}</span> : ''}</td>
                  <td className="cad-acoes"><AcoesDaLinha vm={vm} x={x} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vm.aberto && <PainelDoEmail vm={vm} x={vm.aberto} />}
    </section>
  );
}
