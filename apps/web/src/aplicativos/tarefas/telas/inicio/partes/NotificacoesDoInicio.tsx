// As Notificações do Início novo: a comunicação da equipe (Vitor, 13/11/2026: "Reuniões, avisos vai ficar fixado nessa
// pagina, links de estudos da legislação, etc, comunicação de equipe em geral (sem chats)"). No print, as notificações em
// lista à esquerda e o detalhe à direita: aqui, os comunicados (os fixados em cima) e o escolhido, com o tipo, quem, quando,
// o dia da reunião e o link. O admin e o diretor publicam (Novo comunicado), fixam e apagam; todos leem. Em cima da lista,
// as reuniões (pedidas pelo Sênior ou marcadas pelo Diretor), com o detalhe e as ações à direita (ReunioesDoInicio). O aviso
// que pede confirmação tem o Recebido; quem escreveu vê quem marcou e quem falta. Só os destinatários veem o aviso.
import { BotaoFechar, CampoData, Icone, MenuSuspenso, useJanela, Vazio, type NomeIcone } from '@nads/ui';
import { useRef, useState } from 'react';
import { Propriedade } from '../../financeiro/partes/Propriedade';
import type { useInicio } from '../useInicio';
import { useNovoComunicado, type useInicioNovo } from '../useInicioNovo';
import { DetalheDaReuniao, EscolherPessoas, SeloDaReuniao } from './ReunioesDoInicio';

const ICONE_DO_TIPO: Record<string, NomeIcone> = { aviso: 'alert', reuniao: 'calendar', estudo: 'lampada', geral: 'mensagem' };
const ESCOLHA = 'btn btn-ghost registro-escolha';

/** a janela do Novo comunicado (o + Adicionar aviso do Diretor e do Dono: Reunião ou Aviso geral) */
export function NovoComunicado({ fechar, tipo = 'aviso' }: { fechar: () => void; tipo?: 'aviso' | 'reuniao' | 'estudo' | 'geral' }) {
  const vm = useNovoComunicado(fechar, tipo);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay">
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label="Novo comunicado">
        <header className="registro-topo">
          <span className="registro-caminho"><b>Novo comunicado</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <input className="tdl-janela-titulo" type="text" value={vm.titulo} maxLength={vm.maiorTitulo} autoFocus placeholder="Título" aria-label="Título do comunicado" onChange={e => vm.setTitulo(e.target.value)} />
          <div className="registro-props">
            <Propriedade icone="list" rotulo="Tipo">
              <MenuSuspenso rotulo={vm.rotuloDoTipo} className={ESCOLHA} titulo="O tipo do comunicado" flutuante largura={240}
                itens={vm.tipos.map(t => ({ rotulo: t.rotulo, icone: ICONE_DO_TIPO[t.valor], marcado: t.valor === vm.tipo, onClick: () => vm.setTipo(t.valor) }))} />
            </Propriedade>
            {vm.tipo === 'reuniao' && (
              <Propriedade icone="calendar" rotulo="Dia e hora">
                <span className="tdl-prazo-campos">
                  <CampoData rotulo="Dia da reunião" valor={vm.data} onMudar={vm.setData} />
                  <input type="time" value={vm.hora} aria-label="Hora da reunião" onChange={e => vm.setHora(e.target.value)} />
                </span>
              </Propriedade>
            )}
            <Propriedade icone="usuario" rotulo="Para quem">
              <span className="ini-destino">
                <MenuSuspenso rotulo={vm.destino === 'todos' ? 'Todos' : vm.destino === 'setor' ? 'Setores' : 'Pessoas'} className={ESCOLHA} titulo="Para quem é o aviso" flutuante largura={200}
                  itens={[
                    { rotulo: 'Todos', marcado: vm.destino === 'todos', onClick: () => vm.setDestino('todos') },
                    { rotulo: 'Setores', marcado: vm.destino === 'setor', onClick: () => vm.setDestino('setor') },
                    { rotulo: 'Pessoas', marcado: vm.destino === 'pessoas', onClick: () => vm.setDestino('pessoas') },
                  ]} />
                {vm.destino === 'setor' && vm.opcoesDeSetor.map(s => (
                  <button key={s.id} type="button" className={'chip-f' + (vm.setores.includes(s.id) ? ' on' : '')} aria-pressed={vm.setores.includes(s.id)} onClick={() => vm.alternarSetor(s.id)}>{s.rotulo}</button>
                ))}
                {vm.destino === 'pessoas' && <EscolherPessoas equipe={vm.equipe} escolhidas={vm.pessoas} alternar={vm.alternarPessoa} />}
              </span>
            </Propriedade>
            {vm.podePedirConfirmacao && <label className="tdl-ja-fazendo"><input type="checkbox" checked={vm.pedeConfirmacao} onChange={e => vm.setPedeConfirmacao(e.target.checked)} />Pedir confirmação (cada um marca "Recebido")</label>}
            <Propriedade icone="link" rotulo="Link">
              <input type="url" value={vm.link} onChange={e => vm.setLink(e.target.value)} placeholder={vm.tipo === 'estudo' ? 'O link do estudo (https://…)' : 'Opcional (https://…)'} aria-label="Link" />
            </Propriedade>
          </div>
          <div className="field">
            <label htmlFor="ini-comunicado-texto">Texto</label>
            <textarea id="ini-comunicado-texto" rows={5} value={vm.texto} onChange={e => vm.setTexto(e.target.value)} placeholder="O que a equipe precisa saber"
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.publicar(); } }} />
          </div>
          {vm.faltam < 100 && <span className={'hint' + (vm.faltam < 0 ? ' cor-entrada' : '')}>{vm.faltam} caracteres</span>}
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.publicando || !!vm.problema} title={vm.problema || 'Publicar (Ctrl+Enter)'} onClick={() => void vm.publicar()}>
            <Icone nome="envelope" />{vm.publicando ? 'Publicando…' : 'Publicar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** podeMexer: fixar, soltar e apagar, só o Diretor e o Dono (Vitor, 13/11/2026: "Quem pode soltar aviso é só diretor e dono"; o nível
 * simulado do ⚡ vale); os outros só leem */
export function NotificacoesDoInicio({ vm, mural, podeMexer }: { vm: ReturnType<typeof useInicioNovo>; mural: ReturnType<typeof useInicio>; podeMexer: boolean }) {
  const c = vm.comunicado;
  const r = vm.reuniao;
  return (
    <section className="ini-lista">
      {!vm.carregandoMural && !vm.comunicados.length && !vm.reunioesNaLista.length ? (
        <section className="card"><Vazio icone="sino" titulo="Nada por aqui" texto="Os avisos, as reuniões e os estudos da equipe aparecem aqui." /></section>
      ) : (
        <div className="ini-notificacoes">
          <div className="ini-coluna">
          {vm.reunioesNaLista.length > 0 && (
            <section className="card ini-cartao">
              <div className="card-head"><h3>Reuniões</h3></div>
              {vm.reunioesNaLista.map(x => (
                <button key={x.id} type="button" className={'popover-item ini-comunicado' + (r?.id === x.id ? ' ativo' : '')} aria-pressed={r?.id === x.id} onClick={() => vm.escolherComunicado(x.id)}>
                  <Icone nome="calendar" />
                  <span className="popover-texto"><b>{x.titulo}</b><br /><span className="hint">{x.quandoTexto} · {x.criadaPor.nome}</span></span>
                  <SeloDaReuniao x={x} />
                </button>
              ))}
            </section>
          )}
          <section className="card ini-cartao">
            <div className="card-head"><h3>Comunicados da equipe</h3></div>
            {vm.comunicados.map(x => (
              <button key={x.id} type="button" className={'popover-item ini-comunicado' + (c?.id === x.id ? ' ativo' : '')} aria-pressed={c?.id === x.id} onClick={() => vm.escolherComunicado(x.id)}>
                <Icone nome={ICONE_DO_TIPO[x.tipo || 'aviso']} />
                <span className="popover-texto">
                  <b>{x.tituloNaLista}</b>
                  <br /><span className="hint">{x.fixado && <><Icone nome="mapaPin" width={12} height={12} /> Fixado · </>}{x.tipoRotulo} · {x.por} · {x.quandoFoi}</span>
                </span>
                {x.precisaReceber && <span className="badge badge-suave badge-warn">Marcar recebido</span>}
              </button>
            ))}
            {!vm.comunicados.length && <Vazio compacto icone="sino" titulo="Nenhum comunicado" />}
          </section>
          </div>
          {r && <DetalheDaReuniao x={r} vm={vm.reunioesVm} />}
          {!r && c && (
            <section className="card ini-detalhe">
              <div className="ini-detalhe-topo">
                <h2>{c.titulo || c.tipoRotulo}</h2>
                {podeMexer && (
                  <span className="ini-detalhe-acoes">
                    <button type="button" className="btn btn-outline" onClick={() => void mural.fixar(c.id, !c.fixado)}><Icone nome="mapaPin" />{c.fixado ? 'Soltar' : 'Fixar no alto'}</button>
                    <button type="button" className="btn btn-outline btn-danger" onClick={() => void mural.apagar(c.id)}><Icone nome="lixeira" />Apagar</button>
                  </span>
                )}
              </div>
              <div className="registro-props">
                <Propriedade icone={ICONE_DO_TIPO[c.tipo || 'aviso']} rotulo="Tipo"><span>{c.tipoRotulo}{c.fixado && <span className="fraco"> · fixado</span>}</span></Propriedade>
                <Propriedade icone="usuario" rotulo="Quem"><span>{c.por}</span></Propriedade>
                <Propriedade icone="clock" rotulo="Publicado"><span title={new Date(c.em).toLocaleString('pt-BR')}>{c.quandoFoi}</span></Propriedade>
                {c.reuniao && <Propriedade icone="calendar" rotulo="Reunião"><b>{c.reuniao}</b></Propriedade>}
                {c.link && <Propriedade icone="link" rotulo="Link"><a href={c.link} target="_blank" rel="noopener noreferrer">{c.link}</a></Propriedade>}
                {c.para && <Propriedade icone="usuario" rotulo="Para"><span>{c.destino}</span></Propriedade>}
                {c.acompanha && <Propriedade icone="checkCircle" rotulo="Recebido"><span>{(c.recebidos || []).map(x => x.nome).join(', ') || 'Ninguém ainda'}{c.faltaReceber.length > 0 && <><br /><span className="fraco">Falta: {c.faltaReceber.join(', ')}</span></>}</span></Propriedade>}
              </div>
              <p className="ini-detalhe-texto">{c.texto}</p>
              {c.pedeConfirmacao && !c.acompanha && (
                <div className="ini-reuniao-linha">
                  {c.jaRecebi ? <span className="badge badge-suave badge-ok">Você marcou como recebido</span>
                    : <><span>Este aviso pede que você confirme que leu.</span><button type="button" className="btn btn-primary" onClick={() => void vm.marcarRecebido(c.id)}><Icone nome="check" />Recebido</button></>}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
