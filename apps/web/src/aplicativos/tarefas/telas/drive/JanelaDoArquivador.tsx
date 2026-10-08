// A janela flutuante do Arquivar agora (Vitor, 05/10/2026: "quero uma tela flutuante assim como as outras" e "um
// relatório com as mensagens de resposta do Claude"), no desenho das outras (a JanelaLateral): à esquerda o estado e os
// tópicos — Agora (a organização em andamento com as 10 fases, ou o pedido), Conversa do Claude (o que ele vai
// respondendo enquanto organiza), Relatório (o do dia), Hoje (as rodadas somadas) e Execuções (as últimas, com os
// clientes, o relatório e a mensagem final de cada uma); no pé, Organizar agora.
import { BotaoAcao, Icone, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import type { useArquivadorDoDrive } from './useArquivadorDoDrive';

type Vm = ReturnType<typeof useArquivadorDoDrive>;
type Topico = 'agora' | 'conversa' | 'relatorio' | 'execucoes';

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

/** O Agora enxuto (Vitor, 05/10/2026: "muita informação e tá feio"): um destaque só — organizando (a %, o que está
 * fazendo e a barra), o pedido aberto ou com erro, ou o dia (tudo em dia: os arquivados de hoje, num número grande). */
function Agora({ vm }: { vm: Vm }) {
  const r = vm.rotina;
  const p = vm.pedidoNoAgora ? vm.pedido : null;
  const ab = p && p.status === 'processando';
  if (r || ab) {
    const pct = r ? r.pct : p!.pct;
    const fazendo = r ? r.etapa.replace(/^Fase (\d+) de (\d+): (.*)$/, '$3 · fase $1 de $2') : p!.etapa;
    return (
      <div className="arquivador-hero">
        <span className="arquivador-hero-icone ativo"><Icone nome="girar" /></span>
        <h3>Organizando</h3>
        {pct != null && <b className="arquivador-hero-numero">{pct}%</b>}
        {fazendo && <p className="arquivador-hero-texto">{fazendo}</p>}
        <span className="tarefas-barra larga andando arquivador-hero-barra"><span style={{ width: (pct ?? 8) + '%' }} /></span>
        {r?.lote && <p className="arquivador-hero-texto">{r.lote}</p>}
        <p className="arquivador-hero-nota">{r ? r.detalhe : p!.detalhe}</p>
        {r && r.etapas.length > 0 && (
          <ul className="arquivador-etapas">
            {r.etapas.map(e => <li key={e.chave} className={e.estado}><Icone nome={e.estado === 'feita' ? 'checkCircle' : e.estado === 'erro' ? 'alert' : 'girar'} /><span>{e.nome}</span></li>)}
          </ul>
        )}
      </div>
    );
  }
  if (p) {
    return (
      <div className="arquivador-hero">
        <span className={'arquivador-hero-icone ' + p.status}><Icone nome={ICONES[p.status] || 'arquivo'} /></span>
        <h3>{p.titulo}</h3>
        <p className="arquivador-hero-nota">{p.detalhe}</p>
      </div>
    );
  }
  const n = vm.hoje?.numeros;
  return (
    <div className="arquivador-hero">
      <span className={'arquivador-hero-icone' + (vm.hoje ? ' em-dia' : '')}><Icone nome={vm.hoje ? 'checkCircle' : 'arquivo'} /></span>
      <h3>{vm.hoje ? 'Tudo em dia' : 'Nada rodando agora'}</h3>
      {vm.ultimaRodada && <p className="arquivador-hero-texto">Última rodada {vm.ultimaRodada.quando}</p>}
      {n && (
        <>
          <b className="arquivador-hero-numero">{n[0].valor}</b>
          <p className="arquivador-hero-texto">arquivos arquivados hoje</p>
          <p className="arquivador-hero-nota">{n[1].valor} {n[1].valor === 1 ? 'cliente' : 'clientes'}{n[2].valor ? ' · ' + n[2].valor + ' sem cliente' : ''}</p>
        </>
      )}
      {!n && <p className="arquivador-hero-nota">A organização das 9h roda sozinha todo dia.</p>}
    </div>
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
      {vm.escrever && <Escrever e={vm.escrever} />}
    </>
  );
}

/** A caixa para escrever ao Claude da rotina (só o admin): Enter manda, Shift+Enter quebra a linha. */
function Escrever({ e }: { e: NonNullable<Vm['escrever']> }) {
  return (
    <div className="arquivador-escrever">
      {e.andamento.map(m => (
        <p key={m.id} className={'arquivador-escrever-andamento' + (m.erro ? ' erro' : '')}><b>{m.situacao}</b> · {m.texto}</p>
      ))}
      <form className="arquivador-escrever-caixa" onSubmit={ev => { ev.preventDefault(); void e.mandar(); }}>
        <textarea className="field" rows={2} value={e.rascunho} onChange={ev => e.setRascunho(ev.target.value)} maxLength={4000}
          placeholder={e.semSessao ? 'Sem conversa do Claude neste PC ainda' : 'Escrever para o Claude'} aria-label="Mensagem para o Claude" disabled={e.semSessao}
          onKeyDown={ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); void e.mandar(); } }} />
        <BotaoAcao type="submit" carregando={e.mandando} textoCarregando="Mandando…" disabled={!e.podeMandar}><Icone nome="arrowUp" />Mandar</BotaoAcao>
      </form>
    </div>
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
    { id: 'execucoes', rotulo: 'Histórico', icone: 'clock' },
  ];
  const p = vm.pedido;
  return (
    <JanelaLateral rotulo="Arquivar" topicos={topicos} topico={topico} mudar={setTopico} fechar={fechar} classe="arquivador-janela"
      resumo={(
        <div className="usuario-quem arquivador-quem">
          <span className={'arquivador-selo' + (vm.ocupado ? ' ativo' : '')}><Icone nome={vm.ocupado ? 'girar' : 'arquivo'} /></span>
          <b>Arquivador</b>
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
      {topico === 'execucoes' && <Execucoes vm={vm} />}
    </JanelaLateral>
  );
}
