// Gmail › E-mails: a caixa do robô do Gmail (como nas Pendências). No topo, como o robô está, "Verificar o Gmail
// agora" e o andamento da leitura; as abas (de clientes, sem cliente, spam) com a busca; a lista; e o e-mail aberto
// numa janela por cima, com o texto inteiro, os anexos, as ações e responder.
import type { entregas as e } from '@nads/core';
import { Icone, MenuSuspenso, useCarregando } from '@nads/ui';
import { useEffect } from 'react';
import { useCaixaDoRobo, usePainelDoEmail, type AbaDaCaixa, type VmCaixa } from './useCaixaDoRobo';

const ABAS: { id: AbaDaCaixa; rotulo: string }[] = [
  { id: 'clientes', rotulo: 'De clientes' },
  { id: 'sem-cliente', rotulo: 'Sem cliente' },
  { id: 'spam', rotulo: 'Spam' },
];

function EscolherCliente({ vm, rotulo, aoEscolher }: { vm: VmCaixa; rotulo: string; aoEscolher: (clienteId: string) => void }) {
  return (
    <MenuSuspenso rotulo={rotulo} className="btn btn-outline btn-sm" direita largura={360} titulo="Cliente"
      itens={vm.clientes.slice(0, 400).map(c => ({ rotulo: (c.codigo ? c.codigo + ' · ' : '') + c.nome, onClick: () => aoEscolher(c.id) }))} />
  );
}

function Acoes({ vm, x }: { vm: VmCaixa; x: e.EmailDaCaixa }) {
  const salvo = vm.salvo(x);
  const parecido = vm.aba === 'sem-cliente' ? vm.parecido(x) : null;
  return (
    <span className="gmail-acoes" onClick={ev => ev.stopPropagation()}>
      {vm.aba === 'sem-cliente' ? (
        <>
          {parecido && <button type="button" className="btn btn-outline btn-sm" title={'Ligar ' + x.remetente + ' a ' + parecido.nome} onClick={() => void vm.ligar(x, parecido.id)}>É {parecido.nome.split(' ').slice(0, 2).join(' ')}</button>}
          <EscolherCliente vm={vm} rotulo="Escolher cliente" aoEscolher={id => void vm.ligar(x, id)} />
        </>
      ) : x.clienteId ? (
        salvo ? <span className="badge badge-ok" title={salvo.pasta}>no Drive</span>
          : x.arquivos.length > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={() => void vm.salvarNoDrive(x)}>Salvar no Drive</button>
      ) : (
        <EscolherCliente vm={vm} rotulo="De qual cliente?" aoEscolher={id => void vm.salvarNoDrive(x, id)} />
      )}
      <MenuSuspenso rotulo="" icone="settings" className="btn btn-ghost btn-sm" direita dica="Mais"
        itens={[
          { rotulo: 'Abrir no Gmail', icone: 'envelope', onClick: () => { window.open(vm.linkDoGmail(x.mensagemId), '_blank', 'noopener'); } },
          ...(vm.aba !== 'spam' ? [{ rotulo: 'É spam', icone: 'x' as const, desabilitado: !vm.admin, dica: vm.admin ? undefined : 'só admin', onClick: () => void vm.ignorar(x) }] : []),
        ]} />
    </span>
  );
}

function PainelDoEmail({ vm, x }: { vm: VmCaixa; x: e.EmailDaCaixa }) {
  const p = usePainelDoEmail(x);
  const { fechar } = vm;
  useEffect(() => {
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !document.querySelector('.cad-janela .popover, .modal-overlay')) fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const m = p.lido.email;
  return (
    <div className="cad-janela-fundo" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div className="cad-janela gmail-janela" role="dialog" aria-modal="true" aria-label={x.assunto || 'E-mail'}>
        <header className="cad-janela-topo">
          <button type="button" className="btn btn-ghost btn-sm" onClick={fechar}><Icone nome="chevronLeft" />E-mails</button>
          <span className="cad-janela-empresa"><span className="cad-janela-nome">{x.assunto || '(sem assunto)'}</span></span>
          <button type="button" className="btn btn-ghost btn-sm cad-janela-x" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>
        <div className="cad-janela-conteudo gmail-painel">
          <div className="gmail-cabecalho">
            <p><b>{x.nome || x.remetente}</b> <span className="fraco">&lt;{x.remetente}&gt;</span></p>
            {m?.para && <p className="fraco">Para: {m.para}{m.cc ? ' · Cc: ' + m.cc : ''}</p>}
            <p className="fraco">{x.em ? new Date(x.em).toLocaleString('pt-BR') : ''}{x.clienteNome ? ' · ' + x.clienteNome : ''}</p>
            <p className="gmail-painel-acoes"><Acoes vm={vm} x={x} /></p>
          </div>
          {p.lido.carregando ? <p className="empty">Buscando o e-mail no Gmail pelo robô…</p>
            : p.lido.erro ? <div className="alert"><Icone nome="alert" /><div><p className="alert-text">Não consegui ler o e-mail inteiro: {p.lido.erro}. O trecho: {x.trecho}</p></div></div>
              : <pre className="gmail-texto">{m?.texto}{m?.truncado ? '\n\n(o e-mail é maior; o resto está no Gmail)' : ''}</pre>}
          {(m?.anexos.length || x.arquivos.length) ? (
            <div className="gmail-anexos">
              <p className="fraco">Anexos</p>
              <ul>{(m?.anexos.length ? m.anexos.map(a => a.nome) : x.arquivos).map(n => <li key={n}><Icone nome="arquivo" />{n}</li>)}</ul>
            </div>
          ) : null}
          {p.respostas.length > 0 && (
            <div className="gmail-respostas">
              <p className="fraco">Respostas</p>
              {p.respostas.map(r => (
                <div key={r.id} className="gmail-resposta">
                  <p className="fraco">{r.por} · {vm.quandoFoi(r.em)} · {r.status === 'enviado' ? 'enviada' : r.status === 'erro' ? 'não saiu: ' + (r.erro || '') : 'na fila'}</p>
                  <p>{r.corpo}</p>
                </div>
              ))}
            </div>
          )}
          <form className="gmail-responder" onSubmit={ev => { ev.preventDefault(); void p.responder(); }}>
            <textarea rows={4} placeholder={'Responder para ' + x.remetente} value={p.texto} onChange={ev => p.setTexto(ev.target.value)}
              onKeyDown={ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); void p.responder(); } }} />
            <div className="gmail-responder-pe">
              <label className="fraco"><input type="checkbox" checked={p.todos} onChange={ev => p.setTodos(ev.target.checked)} /> responder a todos</label>
              <span className="tarefas-barra-espaco" />
              <button type="submit" className="btn btn-primary btn-sm" disabled={!p.texto.trim() || p.enviando}>{p.enviando ? 'Enviando…' : 'Responder'}</button>
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
  const a = vm.robo.andamento;
  return (
    <section>
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

      <div className="chip-row">
        {ABAS.map(x => (
          <button key={x.id} type="button" className={'chip-f' + (vm.aba === x.id ? ' on' : '')} onClick={() => vm.setAba(x.id)}>
            {x.rotulo} <span className="gh-counter">{vm.contagem[x.id]}</span>
          </button>
        ))}
      </div>

      {!vm.carregando && !vm.linhas.length ? <p className="empty">Nenhum e-mail aqui.</p> : (
        <div className="table-wrap">
          <table className="tabela-empresas gmail-tabela">
            <thead><tr><th>Quando</th><th>De</th><th>Assunto</th><th>Anexos</th><th /></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(x => (
                <tr key={x.mensagemId} className="linha-abre" tabIndex={0} onClick={() => vm.abrir(x.mensagemId)} onKeyDown={ev => { if (ev.key === 'Enter') vm.abrir(x.mensagemId); }}>
                  <td className="fraco num">{vm.quandoFoi(x.em)}</td>
                  <td><span className="cad-conta"><span>{x.clienteNome || x.nome || x.remetente}</span><span className="fraco">{x.remetente}</span></span></td>
                  <td className="gmail-assunto"><b>{x.assunto || '(sem assunto)'}</b><span className="fraco"> — {x.trecho}</span></td>
                  <td className="fraco num">{x.arquivos.length ? <span title={x.arquivos.join(', ')}><Icone nome="arquivo" className="drive-ico" /> {x.arquivos.length}</span> : ''}</td>
                  <td className="cad-acoes"><Acoes vm={vm} x={x} /></td>
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
