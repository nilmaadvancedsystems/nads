// As Notificações do Início novo: a comunicação da equipe (Vitor, 13/11/2026: "Reuniões, avisos vai ficar fixado nessa
// pagina, links de estudos da legislação, etc, comunicação de equipe em geral (sem chats)"). No print, as notificações em
// lista à esquerda e o detalhe à direita: aqui, os comunicados (os fixados em cima) e o escolhido, com o tipo, quem, quando,
// o dia da reunião e o link. O admin e o diretor publicam (Novo comunicado), fixam e apagam; todos leem. Em cima da lista,
// as reuniões (pedidas pelo Sênior ou marcadas pelo Diretor), com o detalhe e as ações à direita (ReunioesDoInicio). O aviso
// que pede confirmação tem o Recebido; quem escreveu vê quem marcou e quem falta. Só os destinatários veem o aviso.
import { BotaoFechar, CampoData, Icone, MenuSuspenso, useJanela, Vazio, type NomeIcone } from '@nads/ui';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Propriedade } from '../../financeiro/partes/Propriedade';
import type { useInicio } from '../useInicio';
import { useNovoComunicado, type useInicioNovo } from '../useInicioNovo';
import { DetalheDaReuniao, EscolherPessoas, SeloDaReuniao } from './ReunioesDoInicio';

const ICONE_DO_TIPO: Record<string, NomeIcone> = { aviso: 'alert', reuniao: 'calendar', estudo: 'lampada', geral: 'mensagem' };
const ESCOLHA = 'btn btn-ghost registro-escolha';

/**
 * a janela do Novo comunicado (o + Adicionar aviso do Diretor e do Dono › Aviso geral): o Tipo é o jeito do aviso (normal, de
 * datas ou a norma da empresa, com o PDF), o estudo ou o comunicado; o aviso não tem link (Vitor, 13/11/2026)
 */
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
              <MenuSuspenso rotulo={vm.rotuloDoTipo} className={ESCOLHA} titulo="O tipo do comunicado" flutuante largura={280}
                itens={vm.opcoes.map(o => ({ rotulo: o.rotulo, icone: o.jeito === 'norma' ? 'clipe' : o.jeito === 'datas' ? 'calendar' : ICONE_DO_TIPO[o.tipo], marcado: o.marcada, onClick: () => vm.escolher(o) }))} />
            </Propriedade>
            {vm.norma && (
              <Propriedade icone="clipe" rotulo="PDF da norma">
                <span className="ini-destino">
                  {vm.pdf && <span>{vm.pdf.nome}</span>}
                  <label className="btn btn-outline">
                    <Icone nome="upload" />{vm.pdf ? 'Trocar' : 'Anexar o PDF'}
                    <input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void vm.escolherPdf(f); }} />
                  </label>
                  {vm.pdf && <button type="button" className="btn btn-ghost" onClick={vm.tirarPdf}><Icone nome="x" />Tirar</button>}
                </span>
              </Propriedade>
            )}
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
            {/* no modo desenvolvedor todo aviso pede o Recebido; quem cria escolhe fixar na tela inicial (18/11/2026) */}
            {vm.devAviso ? (vm.tipo !== 'reuniao' && <label className="tdl-ja-fazendo"><input type="checkbox" checked={vm.fixarNoInicio} onChange={e => vm.setFixarNoInicio(e.target.checked)} />Fixar na tela inicial (fica sempre no Painel)</label>)
              : vm.podePedirConfirmacao && <label className="tdl-ja-fazendo"><input type="checkbox" checked={vm.pedeConfirmacao} onChange={e => vm.setPedeConfirmacao(e.target.checked)} />Pedir confirmação (cada um marca "Recebido")</label>}
            {vm.temLink && (
              <Propriedade icone="link" rotulo="Link">
                <input type="url" value={vm.link} onChange={e => vm.setLink(e.target.value)} placeholder={vm.tipo === 'estudo' ? 'O link do estudo (https://…)' : 'Opcional (https://…)'} aria-label="Link" />
              </Propriedade>
            )}
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
export function NotificacoesDoInicio({ vm, mural, podeMexer, lugarDosFiltros }: { vm: ReturnType<typeof useInicioNovo>; mural: ReturnType<typeof useInicio>; podeMexer: boolean; lugarDosFiltros?: HTMLElement | null }) {
  // em lista, com os filtros na fileira da busca (Vitor, 18/11/2026: "deixa em modo lista... onde o usuario pode filtrar"; publicada para todos)
  return <section className="ini-lista"><ListaDeNotificacoes vm={vm} mural={mural} podeMexer={podeMexer} lugarDosFiltros={lugarDosFiltros} /></section>;
}

type Comunicado = NonNullable<ReturnType<typeof useInicioNovo>['comunicado']>;

/** O detalhe de um comunicado (o aviso, o estudo, o geral): as Notificações em duas colunas e a lista (modo desenvolvedor) usam. */
export function DetalheDoComunicado({ c, vm, mural, podeMexer, devNovo }: { c: Comunicado; vm: ReturnType<typeof useInicioNovo>; mural: ReturnType<typeof useInicio>; podeMexer: boolean; devNovo: boolean }) {
  return (
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
      {devNovo ? <>
      {/* mais arrumado (Vitor, 18/11/2026: "textos muito embolados, da uma ajeitada"): quem, o tipo e quando numa linha só
          embaixo do título; o texto do aviso em destaque; o Recebido com a contagem, a barra e cada pessoa numa etiqueta */}
      <p className="ini-detalhe-meta">
        <Icone nome={ICONE_DO_TIPO[c.tipo || 'aviso']} />{c.tipoRotulo}{c.fixado && ' · fixado'}
        <span aria-hidden="true">·</span><Icone nome="usuario" />{c.por}
        <span aria-hidden="true">·</span><Icone nome="clock" /><span title={new Date(c.em).toLocaleString('pt-BR')}>{c.quandoFoi}</span>
      </p>
      {c.texto && <p className="ini-detalhe-texto ini-detalhe-corpo">{c.texto}</p>}
      {(c.reuniao || c.link || c.anexo || c.para) && (
        <div className="registro-props">
          {c.reuniao && <Propriedade icone="calendar" rotulo="Reunião"><b>{c.reuniao}</b></Propriedade>}
          {c.link && <Propriedade icone="link" rotulo="Link"><a href={c.link} target="_blank" rel="noopener noreferrer">{c.link}</a></Propriedade>}
          {c.anexo && <Propriedade icone="clipe" rotulo="PDF"><button type="button" className="ini-abrir" title="Baixar" onClick={() => void vm.baixarPdf(c.id)}>{c.anexo.nome}</button></Propriedade>}
          {c.para && <Propriedade icone="usuario" rotulo="Para"><span>{c.destino}</span></Propriedade>}
        </div>
      )}
      {c.acompanha && (() => {
        const recebidos = (c.recebidos || []).map(x => x.nome);
        const total = recebidos.length + c.faltaReceber.length;
        return (
          <div className="ini-recebidos">
            <div className="ini-recebidos-topo">
              <span><Icone nome="checkCircle" /><b>Recebido</b></span>
              <span className="hint num">{recebidos.length} de {total}</span>
            </div>
            <div className="ini-recebidos-barra" aria-hidden="true"><span style={{ width: (total ? Math.round(recebidos.length / total * 100) : 0) + '%' }} /></div>
            <div className="ini-recebidos-pessoas">
              {recebidos.map((n, i) => <span key={'r' + i} className="ini-pessoa ok"><Icone nome="check" />{n}</span>)}
              {c.faltaReceber.map((n, i) => <span key={'f' + i} className="ini-pessoa falta">{n}</span>)}
              {!total && <span className="hint">Ninguém ainda</span>}
            </div>
          </div>
        );
      })()}
      </> : <>
      <div className="registro-props">
        <Propriedade icone={ICONE_DO_TIPO[c.tipo || 'aviso']} rotulo="Tipo"><span>{c.tipoRotulo}{c.fixado && <span className="fraco"> · fixado</span>}</span></Propriedade>
        <Propriedade icone="usuario" rotulo="Quem"><span>{c.por}</span></Propriedade>
        <Propriedade icone="clock" rotulo="Publicado"><span title={new Date(c.em).toLocaleString('pt-BR')}>{c.quandoFoi}</span></Propriedade>
        {c.reuniao && <Propriedade icone="calendar" rotulo="Reunião"><b>{c.reuniao}</b></Propriedade>}
        {c.link && <Propriedade icone="link" rotulo="Link"><a href={c.link} target="_blank" rel="noopener noreferrer">{c.link}</a></Propriedade>}
        {c.anexo && <Propriedade icone="clipe" rotulo="PDF"><button type="button" className="ini-abrir" title="Baixar" onClick={() => void vm.baixarPdf(c.id)}>{c.anexo.nome}</button></Propriedade>}
        {c.para && <Propriedade icone="usuario" rotulo="Para"><span>{c.destino}</span></Propriedade>}
        {c.acompanha && <Propriedade icone="checkCircle" rotulo="Recebido"><span>{(c.recebidos || []).map(x => x.nome).join(', ') || 'Ninguém ainda'}{c.faltaReceber.length > 0 && <><br /><span className="fraco">Falta: {c.faltaReceber.join(', ')}</span></>}</span></Propriedade>}
      </div>
      <p className="ini-detalhe-texto">{c.texto}</p>
      </>}
      {c.pedeConfirmacao && !c.acompanha && (
        <div className="ini-reuniao-linha">
          {c.jaRecebi ? <span className="badge badge-suave badge-ok">Você marcou como recebido</span>
            : <><span>Este aviso pede que você confirme que leu.</span><button type="button" className="btn btn-primary" onClick={() => void vm.marcarRecebido(c.id)}><Icone nome="check" />Recebido</button></>}
        </div>
      )}
    </section>
  );
}

type FiltroDaLista = 'todos' | 'avisos' | 'reunioes' | 'cobrancas';
interface LinhaDaLista { chave: string; id: string; tipo: Exclude<FiltroDaLista, 'todos'>; comunicado?: boolean; icone: NomeIcone; titulo: string; rotulo: string; quem: string; quando: string; pendente: boolean; selo: ReactNode; abrir?: () => void }

/**
 * As Notificações em lista (modo desenvolvedor, 18/11/2026): as cobranças, as reuniões e os comunicados numa lista só, com os
 * filtros do tipo no alto; clicar abre o detalhe logo embaixo da linha (a cobrança abre a tarefa).
 */
function ListaDeNotificacoes({ vm, mural, podeMexer, lugarDosFiltros }: { vm: ReturnType<typeof useInicioNovo>; mural: ReturnType<typeof useInicio>; podeMexer: boolean; lugarDosFiltros?: HTMLElement | null }) {
  const [filtro, setFiltro] = useState<FiltroDaLista>('todos');
  // o "Só pendentes" saiu (Vitor, 18/11/2026: "remove esse so pendentes")
  const soPendentes = false;
  // quem chegou por um card do Painel (a reunião fixada, 24/11/2026) já encontra a linha aberta, com os arquivos
  const [aberta, setAberta] = useState<string | null>(() => (vm.reuniao ? 'r' + vm.reuniao.id : vm.comunicado ? 'a' + vm.comunicado.id : null));
  const linhas: LinhaDaLista[] = [
    ...vm.cobrancas.map(x => ({ chave: 'c' + x.id, id: x.id, tipo: 'cobrancas' as const, icone: x.icone, titulo: x.texto, rotulo: 'Cobrança', quem: '', quando: x.quando, pendente: !!x.aberta,
      selo: x.aberta ? <span className="badge badge-suave badge-warn">Responder</span> : null, abrir: () => vm.abrir(x.tarefa) })),
    ...vm.reunioesNaLista.map(x => ({ chave: 'r' + x.id, id: x.id, tipo: 'reunioes' as const, icone: 'calendar' as NomeIcone, titulo: x.titulo, rotulo: 'Reunião', quem: x.criadaPor.nome, quando: x.quandoTexto,
      pendente: x.minhaPresenca === null && x.acoes.includes('confirmar'), selo: <SeloDaReuniao x={x} /> })),
    // o comunicado de reunião entra no filtro Reuniões; o detalhe dele é o do comunicado (aberto como aviso)
    ...vm.comunicados.map(x => ({ chave: 'a' + x.id, id: x.id, tipo: (x.tipo === 'reuniao' ? 'reunioes' : 'avisos') as LinhaDaLista['tipo'], comunicado: true, icone: (x.fixado ? 'mapaPin' : ICONE_DO_TIPO[x.tipo || 'aviso']) as NomeIcone, titulo: x.tituloNaLista, rotulo: x.tipoRotulo, quem: x.por, quando: x.quandoFoi,
      pendente: !!x.precisaReceber, selo: x.precisaReceber ? <span className="badge badge-suave badge-warn">Marcar recebido</span> : x.fixado ? <span className="badge badge-suave">Fixado</span> : null })),
  ];
  const conta = (f: FiltroDaLista) => linhas.filter(l => (f === 'todos' || l.tipo === f) && (!soPendentes || l.pendente)).length;
  const visiveis = linhas.filter(l => (filtro === 'todos' || l.tipo === filtro) && (!soPendentes || l.pendente));
  const FILTROS: { id: FiltroDaLista; rotulo: string }[] = [{ id: 'todos', rotulo: 'Todos' }, { id: 'avisos', rotulo: 'Avisos' }, { id: 'reunioes', rotulo: 'Reuniões' }, { id: 'cobrancas', rotulo: 'Cobranças' }];
  const filtros = (
    <div className="notif-filtros" role="toolbar" aria-label="Filtrar as notificações">
      <Icone nome="funil" width={16} height={16} />
      {FILTROS.map(f => (
        <button key={f.id} type="button" className={'chip-f' + (filtro === f.id ? ' on' : '')} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
          {f.rotulo} <span className="num">{conta(f.id)}</span>
        </button>
      ))}
    </div>
  );
  const clicar = (l: LinhaDaLista) => {
    if (l.abrir) { l.abrir(); return; }
    if (aberta === l.chave) { setAberta(null); return; }
    vm.escolherComunicado(l.id);
    setAberta(l.chave);
  };
  return (
    <>
      {/* os filtros na fileira da busca, com o ícone (Vitor, 18/11/2026: "alinhe esse filtro na mesma linha da barra de pesquisa") */}
      {lugarDosFiltros ? createPortal(filtros, lugarDosFiltros) : filtros}
      <section className="card notif-lista">
        {visiveis.length ? visiveis.map(l => {
          const aqui = aberta === l.chave;
          return (
            <Fragment key={l.chave}>
              <button type="button" className={'notif-linha' + (aqui ? ' aberta' : '') + (l.pendente ? ' pendente' : '')} aria-expanded={l.abrir ? undefined : aqui} onClick={() => clicar(l)}>
                <span className="notif-icone"><Icone nome={l.icone} /></span>
                <span className="notif-titulo"><b>{l.titulo}</b><span className="hint">{l.rotulo}</span></span>
                <span className="hint notif-quem">{l.quem}</span>
                <span className="hint notif-quando">{l.quando}</span>
                <span className="notif-selo">{l.selo}</span>
                <Icone nome={l.abrir ? 'chevronRight' : aqui ? 'chevronDown' : 'chevronRight'} />
              </button>
              {aqui && (
                <div className="notif-detalhe">
                  {!l.comunicado && vm.reuniao?.id === l.id && <DetalheDaReuniao x={vm.reuniao} vm={vm.reunioesVm} />}
                  {l.comunicado && vm.comunicado?.id === l.id && <DetalheDoComunicado c={vm.comunicado} vm={vm} mural={mural} podeMexer={podeMexer} devNovo />}
                </div>
              )}
            </Fragment>
          );
        }) : <Vazio compacto icone="sino" titulo={soPendentes ? 'Nada pendente' : 'Nada por aqui'} />}
      </section>
    </>
  );
}
