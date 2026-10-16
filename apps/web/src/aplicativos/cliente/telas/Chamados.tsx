// A aba Chamados da Área do Cliente (Vitor, 16/10/2026): a lista de conversas com o escritório, abrir um chamado novo
// (assunto + texto) e responder dentro da conversa. No PC, a lista à esquerda e a conversa (ou o chamado novo) à direita;
// no celular, um embaixo do outro, e a tela desce até a conversa quando a pessoa escolhe um chamado.
import { Icone } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { ConversaDoChamado } from '../partes/ConversaDoChamado';
import { useChamados } from './useChamados';
import type { DaCasca } from './useAreaCliente';

export function Chamados(props: DaCasca) {
  const vm = useChamados(props);
  const detalhe = useRef<HTMLElement>(null);
  const alvo = vm.novo ? 'novo' : vm.aberto?.id ?? '';
  // no celular a conversa fica embaixo da lista: leva a pessoa até ela
  useEffect(() => {
    if (alvo && window.matchMedia('(max-width: 1023px)').matches) detalhe.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [alvo]);

  return (
    <div className="cli-chamados">
      <section className="cli-cartao cli-sem-recheio">
        <div className="cli-cartao-topo">
          <div><h2><Icone nome="mensagem" width={18} height={18} />Seus chamados</h2><p>As conversas com o escritório</p></div>
          <button type="button" className="cli-btn cli-btn-marca" onClick={vm.comecarNovo}><Icone nome="plus" width={16} height={16} />Novo chamado</button>
        </div>
        {vm.chamados.length ? (
          <ul className="cli-chamado-lista">
            {vm.chamados.map(c => {
              const ultima = vm.ultimaMensagem(c);
              const on = vm.aberto?.id === c.id;
              return (
                <li key={c.id}>
                  <button type="button" className={'cli-chamado' + (on ? ' on' : '')} onClick={() => vm.abrir(c.id)} aria-pressed={on}>
                    <span className="cli-chamado-l1">
                      <b>{c.titulo}</b>
                      <span className={'cli-selo ' + (c.situacao === 'respondido' ? 'cli-selo-ok' : c.situacao === 'concluido' ? '' : 'cli-selo-info')}>{vm.rotuloDaSituacao[c.situacao]}</span>
                    </span>
                    {ultima && <span className="cli-chamado-previa">{ultima.de === 'escritorio' ? 'Escritório: ' : 'Você: '}{ultima.texto}</span>}
                    <span className="cli-meta">
                      <span className="cli-etiqueta">{vm.rotuloDoTipo(c.tipo)}</span>
                      {ultima && <span><Icone nome="clock" width={12} height={12} />{vm.quando(ultima.em)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="cli-vazio">
            <span className="cli-vazio-ico"><Icone nome="mensagem" width={26} height={26} /></span>
            <h3>Nenhum chamado ainda</h3>
            <p>Abra um chamado para tirar uma dúvida ou pedir um serviço ao escritório.</p>
          </div>
        )}
      </section>

      {vm.novo ? (
        <section className="cli-cartao" ref={detalhe}>
          <div className="cli-cartao-topo"><div><h2><Icone nome="lapis" width={18} height={18} />Novo chamado</h2><p>O escritório responde por aqui mesmo</p></div></div>
          <div className="cli-campo">
            <label htmlFor="cli-tipo">Sobre o quê?</label>
            <select id="cli-tipo" value={vm.tipo} onChange={e => vm.mudarTipo(e.target.value)}>
              <option value="" disabled>Escolha o assunto</option>
              {vm.tipos.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
          </div>
          <div className="cli-campo">
            <label htmlFor="cli-texto">Conte o que você precisa</label>
            <textarea id="cli-texto" rows={5} value={vm.texto} onChange={e => vm.mudarTexto(e.target.value)} placeholder="Escreva do seu jeito. Se for sobre um funcionário, diga o nome." />
          </div>
          {vm.erro && <p className="cli-erro" role="alert" style={{ marginBottom: 12 }}>{vm.erro}</p>}
          <div className="cli-acoes-form">
            <button type="button" className="cli-btn" onClick={vm.cancelarNovo}>Cancelar</button>
            <button type="button" className="cli-btn cli-btn-marca" disabled={vm.enviando} onClick={vm.criar}><Icone nome="aviao" width={16} height={16} />Enviar chamado</button>
          </div>
        </section>
      ) : vm.aberto ? (
        <section className="cli-cartao" ref={detalhe}>
          <div className="cli-cartao-topo">
            <div><h2>{vm.aberto.titulo}</h2><p>{vm.rotuloDoTipo(vm.aberto.tipo)}</p></div>
            <span className={'cli-selo ' + (vm.aberto.situacao === 'respondido' ? 'cli-selo-ok' : vm.aberto.situacao === 'concluido' ? '' : 'cli-selo-info')}>{vm.rotuloDaSituacao[vm.aberto.situacao]}</span>
          </div>
          <ConversaDoChamado mensagens={vm.aberto.mensagens} />
          {vm.aceitaResposta ? (
            <div className="cli-cartao-pe">
              <div className="cli-campo" style={{ marginBottom: 12 }}>
                <label htmlFor="cli-resposta">Sua resposta</label>
                <textarea id="cli-resposta" rows={3} value={vm.resposta} onChange={e => vm.mudarResposta(e.target.value)} placeholder="Escreva aqui" />
              </div>
              <div className="cli-acoes-form">
                <button type="button" className="cli-btn cli-btn-marca" disabled={vm.enviando || !vm.resposta.trim()} onClick={vm.responder}><Icone nome="aviao" width={16} height={16} />Responder</button>
              </div>
            </div>
          ) : <p className="cli-recado cli-cartao-pe">Este chamado foi concluído. Para outro assunto, abra um chamado novo.</p>}
        </section>
      ) : (
        <section className="cli-cartao cli-vazio cli-detalhe-vazio">
          <span className="cli-vazio-ico"><Icone nome="mensagem" width={26} height={26} /></span>
          <h3>Escolha um chamado</h3>
          <p>Clique num chamado ao lado para ver a conversa, ou abra um novo.</p>
        </section>
      )}
    </div>
  );
}
