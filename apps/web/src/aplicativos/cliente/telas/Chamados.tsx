// Solicitações e chamados da Área do Cliente (Vitor, 16/10/2026, do protótipo): a abertura rápida (assunto, prioridade, o
// pedido e um anexo), o histórico de chamados e a conversa com a resposta. No PC, o histórico à esquerda e a conversa à
// direita; no celular, um embaixo do outro, e a tela desce até a conversa quando a pessoa escolhe um chamado.
import { Icone } from '@nads/ui';
import { useEffect, useId, useRef } from 'react';
import { ConversaDoChamado } from '../partes/ConversaDoChamado';
import { useChamados } from './useChamados';
import type { DaCasca } from './useAreaCliente';

const SELO: Record<string, string> = { respondido: 'badge badge-ok', concluido: 'badge badge-neutral', aberto: 'badge', 'em andamento': 'badge badge-warn' };

export function Chamados(props: DaCasca) {
  const vm = useChamados(props);
  const idAnexo = useId();
  const detalhe = useRef<HTMLElement>(null);
  const alvo = vm.aberto?.id ?? '';
  // no celular a conversa fica embaixo da lista: leva a pessoa até ela
  useEffect(() => {
    if (alvo && window.matchMedia('(max-width: 1023px)').matches) detalhe.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [alvo]);

  return (
    <>
      <section className="card">
        <div className="card-head"><h3>Abrir um chamado</h3></div>
        <div className="cli-form tres">
          <div className="field">
            <label htmlFor="cli-tipo">Assunto</label>
            <select id="cli-tipo" value={vm.tipo} onChange={e => vm.mudarTipo(e.target.value)}>
              <option value="" disabled>Escolha</option>
              {vm.tipos.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cli-prio">Prioridade</label>
            <select id="cli-prio" value={vm.prioridade} onChange={e => vm.mudarPrioridade(e.target.value)}>
              {vm.prioridades.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={idAnexo}>Anexo (opcional, até {vm.limite})</label>
            <div className="cli-anexo">
              <label className="file-picker" htmlFor={idAnexo}><Icone nome="upload" width={16} height={16} />{vm.anexo ? vm.anexo.name : 'Escolher arquivo'}</label>
              <input id={idAnexo} type="file" className="sr-only" accept={vm.aceitar} onChange={e => { vm.mudarAnexo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
              {vm.anexo && <button type="button" className="btn btn-ghost" onClick={() => vm.mudarAnexo(null)}>Tirar</button>}
            </div>
          </div>
          <div className="field cli-largo">
            <label htmlFor="cli-texto">O que você precisa</label>
            <textarea id="cli-texto" rows={4} value={vm.texto} onChange={e => vm.mudarTexto(e.target.value)} placeholder="Escreva do seu jeito. Se for sobre um funcionário, diga o nome." />
          </div>
        </div>
        {vm.erro && <p className="cli-erro" role="alert" style={{ marginBottom: 12 }}>{vm.erro}</p>}
        <div className="cli-botoes">
          <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={() => void vm.criar()}>Enviar chamado</button>
        </div>
      </section>

      <div className="cli-chamados">
        <section className="card">
          <div className="card-head"><h3>Histórico</h3></div>
          {vm.chamados.length ? (
            <div>
              {vm.chamados.map(c => {
                const ultima = vm.ultimaMensagem(c);
                const on = vm.aberto?.id === c.id;
                return (
                  <button key={c.id} type="button" className={'ag-conversa cli-chamado' + (on ? ' on' : '')} onClick={() => vm.abrir(c.id)} aria-pressed={on}>
                    <span className="ag-conversa-topo">
                      <span className="ag-conversa-titulo">{c.titulo}</span>
                      <span className={SELO[c.situacao]}>{vm.rotuloDaSituacao[c.situacao]}</span>
                      <span className="ag-conversa-ha">{vm.abertoEm(c)}</span>
                    </span>
                    <span className="ag-conversa-pasta">{vm.rotuloDoTipo(c.tipo)} · {c.mensagens.length} mensagem(ns)</span>
                    {ultima && <span className="ag-conversa-linha" style={{ display: 'block' }}><b>{ultima.de === 'escritorio' ? 'Escritório' : 'Você'}:</b> {ultima.texto.split('\n')[0]}</span>}
                  </button>
                );
              })}
            </div>
          ) : <p className="empty">Você ainda não abriu nenhum chamado.</p>}
        </section>

        {vm.aberto ? (
          <section className="card" ref={detalhe}>
            <div className="card-head">
              <h3>{vm.aberto.titulo}</h3>
              <span className={SELO[vm.aberto.situacao]}>{vm.rotuloDaSituacao[vm.aberto.situacao]}</span>
            </div>
            <ConversaDoChamado mensagens={vm.aberto.mensagens} />
            {vm.aceitaResposta ? (
              <div style={{ marginTop: 16 }}>
                <div className="field">
                  <label htmlFor="cli-resposta">Sua resposta</label>
                  <textarea id="cli-resposta" rows={3} value={vm.resposta} onChange={e => vm.mudarResposta(e.target.value)} />
                </div>
                <div className="cli-botoes">
                  <button type="button" className="btn btn-primary" disabled={vm.enviando || !vm.resposta.trim()} onClick={() => void vm.responder()}>Responder</button>
                </div>
              </div>
            ) : <p className="hint" style={{ marginTop: 16 }}>Este chamado foi concluído. Para outro assunto, abra um chamado novo.</p>}
          </section>
        ) : vm.chamados.length > 0 && (
          <section className="card cli-so-pc"><p className="empty">Escolha um chamado para ver a conversa.</p></section>
        )}
      </div>
    </>
  );
}
