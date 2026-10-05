// A janela flutuante do Arquivar agora (Vitor, 05/10/2026: "quero uma tela flutuante assim como as outras" e "um
// relatório com as mensagens de resposta do Claude"), no desenho das outras (a JanelaLateral): à esquerda o estado e os
// tópicos — Agora (a organização em andamento com as 10 fases, ou o pedido), Conversa do Claude (o que ele vai
// respondendo enquanto organiza), Relatório (o do dia), Hoje (as rodadas somadas) e Execuções (as últimas, com os
// clientes, o relatório e a mensagem final de cada uma); no pé, Organizar agora.
import { Icone, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cartao, JanelaLateral, Linha, type TopicoDaJanela } from '../janela/JanelaLateral';
import type { useArquivadorDoDrive } from './useArquivadorDoDrive';

type Vm = ReturnType<typeof useArquivadorDoDrive>;
type Topico = 'agora' | 'conversa' | 'relatorio' | 'hoje' | 'execucoes';

const ICONES: Record<string, NomeIcone> = { pendente: 'clock', aguardando: 'clock', processando: 'girar', concluido: 'checkCircle', erro: 'alert', cancelado: 'x' };

/** Negrito (**assim**) e código (`assim`) numa linha. */
function Trecho({ t }: { t: string }) {
  return <>{t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (
    p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <b key={i}>{p.slice(2, -2)}</b>
      : p.startsWith('`') && p.endsWith('`') && p.length > 2 ? <code key={i}>{p.slice(1, -1)}</code> : p
  ))}</>;
}

/** O texto do Claude com o markdown simples dele: parágrafos, listas (- ou 1.), títulos (#), negrito e código. */
function TextoDoClaude({ texto }: { texto: string }) {
  const blocos: ReactNode[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  let paragrafo: string[] = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push(<p key={blocos.length}>{paragrafo.map((l, i) => <span key={i}>{i > 0 && <br />}<Trecho t={l} /></span>)}</p>);
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista) {
      const itens = lista.itens.map((l, i) => <li key={i}><Trecho t={l} /></li>);
      blocos.push(lista.ordenada ? <ol key={blocos.length}>{itens}</ol> : <ul key={blocos.length}>{itens}</ul>);
    }
    lista = null;
  };
  for (const bruta of texto.replace(/\r\n/g, '\n').split('\n')) {
    const l = bruta.trim();
    const marcador = /^[-*•]\s+(.*)$/.exec(l);
    const numero = /^\d+[.)]\s+(.*)$/.exec(l);
    if (marcador || numero) {
      fecharParagrafo();
      const ordenada = !!numero;
      if (!lista || lista.ordenada !== ordenada) { fecharLista(); lista = { ordenada, itens: [] }; }
      lista.itens.push((marcador || numero)![1]);
    } else if (!l) { fecharParagrafo(); fecharLista(); }
    else if (/^#{1,6}\s/.test(l)) { fecharParagrafo(); fecharLista(); blocos.push(<p key={blocos.length}><b>{l.replace(/^#+\s*/, '')}</b></p>); }
    else { fecharLista(); paragrafo.push(l); }
  }
  fecharParagrafo(); fecharLista();
  return <>{blocos}</>;
}

function Numeros({ numeros }: { numeros: { valor: number; rotulo: string; aviso: boolean }[] }) {
  return (
    <div className="arquivador-numeros">
      {numeros.map(n => <div key={n.rotulo} className={'arquivador-numero' + (n.aviso ? ' aviso' : '')}><b>{n.valor}</b><span>{n.rotulo}</span></div>)}
    </div>
  );
}

function Agora({ vm }: { vm: Vm }) {
  const r = vm.rotina;
  const p = vm.pedido;
  return (
    <>
      {r && (
        <section className="arquivador-pedido processando">
          <header className="arquivador-pedido-topo"><Icone nome="girar" /><b>{r.titulo}</b>{r.pct != null && <span className="arquivador-pct">{r.pct}%</span>}</header>
          <p className="arquivador-detalhe">{r.detalhe}</p>
          <span className="tarefas-barra larga andando"><span style={{ width: (r.pct ?? 8) + '%' }} /></span>
          {vm.fases.length > 0 && (
            <ol className="arquivador-fases">
              {vm.fases.map(f => <li key={f.nome} className={f.estado}><Icone nome={f.estado === 'feita' ? 'checkCircle' : f.estado === 'atual' ? 'girar' : 'clock'} />{f.nome}</li>)}
            </ol>
          )}
        </section>
      )}
      {p && (
        <section className={'arquivador-pedido ' + p.status}>
          <header className="arquivador-pedido-topo"><Icone nome={ICONES[p.status] || 'arquivo'} /><b>{p.titulo}</b>{p.pct != null && <span className="arquivador-pct">{p.pct}%</span>}</header>
          <p className="arquivador-detalhe">{p.detalhe}</p>
          {p.status === 'processando' && (
            <>
              <span className="tarefas-barra larga andando"><span style={{ width: (p.pct ?? 5) + '%' }} /></span>
              {p.etapa && <p className="arquivador-etapa">{p.etapa}</p>}
            </>
          )}
          {p.resultado && (p.resultado.vazio ? <p className="arquivador-detalhe">Não havia nada novo para arquivar.</p> : (
            <>
              <Numeros numeros={p.resultado.numeros} />
              {p.resultado.clientes.length > 0 && (
                <ul className="arquivador-clientes">
                  {p.resultado.clientes.map(c => <li key={c.chave}><span>{c.rotulo}</span><b>{c.n}</b></li>)}
                  {p.resultado.maisClientes > 0 && <li className="fraco">e mais {p.resultado.maisClientes} {p.resultado.maisClientes === 1 ? 'cliente' : 'clientes'}</li>}
                </ul>
              )}
            </>
          ))}
          {p.semResultado && <p className="arquivador-detalhe">A rotina não gerou relatório novo (nada para arquivar).</p>}
        </section>
      )}
      {!r && !p && (
        <div className="card gh-blank"><Icone nome="arquivo" /><h4>Nada rodando agora</h4><p>A organização das 9h roda sozinha todo dia. Para organizar antes, use o Organizar agora.</p></div>
      )}
    </>
  );
}

function Conversa({ vm }: { vm: Vm }) {
  const fim = useRef<HTMLDivElement>(null);
  const ms = vm.conversa.mensagens;
  // desce até a mensagem mais nova (como no Claude)
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [ms.length]);
  if (!ms.length) return <div className="card gh-blank"><Icone nome="robo" /><h4>Sem conversa ainda</h4><p>As respostas do Claude aparecem aqui enquanto ele organiza.</p></div>;
  return (
    <>
      <p className="arquivador-etapa">As respostas do Claude que roda a organização neste PC (as últimas {ms.length}; os comandos que ele roda ficam de fora){vm.conversa.atualizada ? ' · atualizada ' + vm.conversa.atualizada : ''}.</p>
      <div className="arquivador-conversa">
        {ms.map(m => (
          <div key={m.chave} className={'arquivador-msg ' + m.quem}>
            <span className="arquivador-msg-hora">{m.quem === 'voce' ? 'Você' : 'Claude'} · {m.hora}</span>
            <TextoDoClaude texto={m.texto} />
          </div>
        ))}
        <div ref={fim} />
      </div>
    </>
  );
}

function Relatorio({ vm }: { vm: Vm }) {
  const r = vm.relatorioDoDia;
  if (!r) return <div className="card gh-blank"><Icone nome="fileText" /><h4>Sem relatório hoje</h4><p>O relatório da rodada aparece aqui quando a organização começa. Os das execuções antigas ficam em Execuções.</p></div>;
  return (
    <>
      <p className="arquivador-etapa">{r.arquivo} · atualizado {r.quando}</p>
      <pre className="arquivador-relatorio">{r.texto}</pre>
    </>
  );
}

function Hoje({ vm, ver }: { vm: Vm; ver: (id: string) => void }) {
  if (!vm.hoje) return <div className="card gh-blank"><Icone nome="calendar" /><h4>Nenhuma rodada hoje</h4><p>As rodadas da organização de hoje aparecem aqui, somadas.</p></div>;
  return (
    <>
      <Numeros numeros={vm.hoje.numeros} />
      <Cartao titulo={vm.hoje.rodadas + (vm.hoje.rodadas === 1 ? ' rodada' : ' rodadas')}>
        {vm.rodadasHoje.map(x => (
          <Linha key={x.id} rotulo={'Rodada das ' + x.hora} dica={x.arquivados + ' arquivados · ' + x.clientes + (x.clientes === 1 ? ' cliente' : ' clientes') + (x.semCliente ? ' · ' + x.semCliente + ' sem cliente' : '')}>
            <button type="button" className="btn btn-outline" onClick={() => ver(x.id)}>Ver</button>
          </Linha>
        ))}
      </Cartao>
    </>
  );
}

function Execucoes({ vm }: { vm: Vm }) {
  if (!vm.execucoes.length) return <div className="card gh-blank"><Icone nome="clock" /><h4>Nenhuma execução ainda</h4></div>;
  const dias: { dia: string; itens: Vm['execucoes'] }[] = [];
  for (const x of vm.execucoes) { const d = dias[dias.length - 1]; if (d && d.dia === x.dia) d.itens.push(x); else dias.push({ dia: x.dia, itens: [x] }); }
  const det = vm.detalheAberto;
  return (
    <>
      {dias.map(d => (
        <section key={d.dia}>
          <p className="arquivador-dia">{d.dia}</p>
          <ul className="arquivador-execs">
            {d.itens.map(x => (
              <li key={x.id}>
                <button type="button" className="arquivador-exec-linha" aria-expanded={vm.execucaoAberta === x.id} onClick={() => vm.abrirExecucao(x.id)}>
                  <b>{x.hora}</b>
                  <span>{x.arquivados} arquivados · {x.clientes} {x.clientes === 1 ? 'cliente' : 'clientes'}{x.semCliente ? ' · ' : ''}{x.semCliente ? <span className="arquivador-aviso">{x.semCliente} sem cliente</span> : null}</span>
                  <span className="fraco">{x.id.slice(5)}</span>
                  <Icone nome={vm.execucaoAberta === x.id ? 'caretDown' : 'chevronRight'} />
                </button>
                {vm.execucaoAberta === x.id && det && (
                  <div className="arquivador-exec-aberta">
                    {det.clientes.length > 0 && (
                      <ul className="arquivador-clientes">{det.clientes.map(c => <li key={c.chave}><span>{c.rotulo}</span><b>{c.n}</b></li>)}</ul>
                    )}
                    {!det.carregado ? <p className="arquivador-etapa">Carregando o relatório…</p> : (
                      <>
                        {det.resposta && <div className="arquivador-msg claude"><span className="arquivador-msg-hora">Mensagem final do Claude</span><TextoDoClaude texto={det.resposta} /></div>}
                        {det.relatorio ? <pre className="arquivador-relatorio curto">{det.relatorio}</pre> : <p className="arquivador-etapa">Esta execução não tem relatório guardado.</p>}
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function JanelaDoArquivador({ vm, fechar }: { vm: Vm; fechar: () => void }) {
  const [topico, setTopico] = useState<Topico>('agora');
  const topicos: TopicoDaJanela<Topico>[] = [
    { id: 'agora', rotulo: 'Agora', icone: vm.ocupado ? 'girar' : 'arquivo' },
    { id: 'conversa', rotulo: 'Conversa do Claude', icone: 'robo' },
    { id: 'relatorio', rotulo: 'Relatório', icone: 'fileText' },
    { id: 'hoje', rotulo: 'Hoje', icone: 'calendar', contador: vm.hoje?.rodadas },
    { id: 'execucoes', rotulo: 'Execuções', icone: 'clock' },
  ];
  const p = vm.pedido;
  return (
    <JanelaLateral rotulo="Arquivar" topicos={topicos} topico={topico} mudar={setTopico} fechar={fechar} classe="arquivador-janela"
      resumo={(
        <div className="usuario-quem arquivador-quem">
          <span className={'arquivador-selo' + (vm.ocupado ? ' ativo' : '')}><Icone nome={vm.ocupado ? 'girar' : 'arquivo'} /></span>
          <b>{vm.ocupado ? vm.rotulo : 'Parado'}</b>
          <span className={'arquivador-pc' + (vm.ligado ? ' ligado' : '')}><span className="arquivador-ponto" aria-hidden="true" />{vm.pc}</span>
        </div>
      )}
      pe={(
        <>
          {vm.podePedir && <p className="arquivador-nota">{vm.notaAoPedir}{vm.exemplos ? ' (Exemplo: nada sai daqui.)' : ''}</p>}
          <span className="tarefas-barra-espaco" />
          {p?.podeCancelar && <button type="button" className="btn btn-outline" onClick={() => vm.cancelar(p.id)}>Cancelar o pedido</button>}
          {vm.podePedir && (
            <button type="button" className="btn btn-primary" disabled={vm.pedindo} onClick={() => void vm.pedir()}>
              {vm.pedindo ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="arquivo" />}Organizar agora
            </button>
          )}
        </>
      )}>
      {topico === 'agora' && <Agora vm={vm} />}
      {topico === 'conversa' && <Conversa vm={vm} />}
      {topico === 'relatorio' && <Relatorio vm={vm} />}
      {topico === 'hoje' && <Hoje vm={vm} ver={id => { vm.verExecucao(id); setTopico('execucoes'); }} />}
      {topico === 'execucoes' && <Execucoes vm={vm} />}
    </JanelaLateral>
  );
}
