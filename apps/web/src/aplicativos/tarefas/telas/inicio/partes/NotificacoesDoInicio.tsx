// As Notificações do Início novo: a comunicação da equipe (Vitor, 13/11/2026: "Reuniões, avisos vai ficar fixado nessa
// pagina, links de estudos da legislação, etc, comunicação de equipe em geral (sem chats)"). No print, as notificações em
// lista à esquerda e o detalhe à direita: aqui, os comunicados (os fixados em cima) e o escolhido, com o tipo, quem, quando,
// o dia da reunião e o link. O admin e o diretor publicam (Novo comunicado), fixam e apagam; todos leem.
import { BotaoFechar, CampoData, Icone, MenuSuspenso, useJanela, Vazio, type NomeIcone } from '@nads/ui';
import { useRef, useState } from 'react';
import { Propriedade } from '../../financeiro/partes/Propriedade';
import type { useInicio } from '../useInicio';
import { useNovoComunicado, type useInicioNovo } from '../useInicioNovo';

const ICONE_DO_TIPO: Record<string, NomeIcone> = { aviso: 'alert', reuniao: 'calendar', estudo: 'lampada', geral: 'mensagem' };
const ESCOLHA = 'btn btn-ghost registro-escolha';

function NovoComunicado({ fechar }: { fechar: () => void }) {
  const vm = useNovoComunicado(fechar);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay">
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label="Novo comunicado">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="sino" />Notificações<Icone nome="chevronRight" /><b>Novo comunicado</b></span>
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

export function NotificacoesDoInicio({ vm, mural }: { vm: ReturnType<typeof useInicioNovo>; mural: ReturnType<typeof useInicio> }) {
  const [novo, setNovo] = useState(false);
  const c = vm.comunicado;
  return (
    <section className="ini-lista">
      {mural.escreve && (
        <div className="tarefas-barra-topo">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-primary" onClick={() => setNovo(true)}><Icone nome="plus" />Novo comunicado</button>
        </div>
      )}
      {!vm.carregandoMural && !vm.comunicados.length ? (
        <section className="card"><Vazio icone="sino" titulo="Nada por aqui" texto="Os avisos, as reuniões e os estudos da equipe aparecem aqui." /></section>
      ) : (
        <div className="ini-notificacoes">
          <section className="card ini-cartao">
            <div className="card-head"><h3>Comunicados da equipe</h3></div>
            {vm.comunicados.map(x => (
              <button key={x.id} type="button" className={'popover-item ini-comunicado' + (c?.id === x.id ? ' ativo' : '')} aria-pressed={c?.id === x.id} onClick={() => vm.escolherComunicado(x.id)}>
                <Icone nome={ICONE_DO_TIPO[x.tipo || 'aviso']} />
                <span className="popover-texto">
                  <b>{x.tituloNaLista}</b>
                  <br /><span className="hint">{x.fixado && <><Icone nome="mapaPin" width={12} height={12} /> Fixado · </>}{x.tipoRotulo} · {x.por} · {x.quandoFoi}</span>
                </span>
              </button>
            ))}
          </section>
          {c && (
            <section className="card ini-detalhe">
              <div className="ini-detalhe-topo">
                <h2>{c.titulo || c.tipoRotulo}</h2>
                {mural.escreve && (
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
              </div>
              <p className="ini-detalhe-texto">{c.texto}</p>
            </section>
          )}
        </div>
      )}
      {novo && <NovoComunicado fechar={() => setNovo(false)} />}
    </section>
  );
}
