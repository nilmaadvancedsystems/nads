// Os feedbacks da equipe (Vitor, 07/10/2026: "abra uma janela flutuante", aberta no pé da gaveta ☰, junto da versão):
// à esquerda Novos / Vistos / Feitos / Todos; à direita cada feedback com o print (clicar amplia), o texto, quem,
// quando, a tela e a versão; Visto e Feito. A prioridade (Vitor, 19/10/2026) no selo suave, com o filtro (Todas, Alta,
// Média, Baixa) e a ordem (Mais novos ou Prioridade) em cima da lista.
import { Alerta, BotaoFechar, BotaoIcone, Esqueleto, Icone, Segmentado, useJanela, Vazio, BotaoAcao } from '@nads/ui';
import { useRef, useState } from 'react';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import { PRIORIDADES, type PrioridadeDoFeedback, type SituacaoDoFeedback } from '../../dados/feedback';
import { useFeedbacks } from './useFeedbacks';

const SELO = { novo: 'badge-warn', visto: 'badge-neutral', resolvendo: 'badge-suave badge-warn', feito: 'badge-ok' } as const;
const NOME = { novo: 'Novo', visto: 'Visto', resolvendo: 'Resolvendo', feito: 'Feito' } as const;
export const ICONE_DO_FILTRO = { novo: 'envelope', visto: 'olho', resolvendo: 'clock', feito: 'check', '': 'relatorio', bug: 'alert' } as const;
const ANALISE = { pendente: 'Na fila do robô', analisando: 'O robô está investigando', pronta: '', erro: 'O robô não conseguiu analisar', '': '' } as const;
const VEREDITO = { erro: { selo: 'badge-bad', rotulo: 'Erro do sistema' }, analise: { selo: 'badge-warn', rotulo: 'Precisa da sua análise' } } as const;

/** O selo do bug (o veredito do report, ou em que pé está a análise do robô). */
function SeloDoBug({ f }: { f: { tipo: string; analise: keyof typeof ANALISE; veredito: 'erro' | 'analise' | null } }) {
  if (f.tipo !== 'bug') return null;
  if (f.veredito) return <span className={'badge ' + VEREDITO[f.veredito].selo}>{VEREDITO[f.veredito].rotulo}</span>;
  return <span className="badge badge-neutral">{ANALISE[f.analise] || 'Bug'}</span>;
}
const TODOS = 'todos';
const SELO_DA_PRIORIDADE = { alta: 'badge-bad', media: 'badge-warn', baixa: 'badge-neutral' } as const;

/** A prioridade no selo suave (os mandados antes dela não têm selo). */
function SeloDaPrioridade({ p }: { p: PrioridadeDoFeedback | null }) {
  if (!p) return null;
  return <span className={'badge badge-suave ' + SELO_DA_PRIORIDADE[p]} title="Prioridade">{PRIORIDADES.find(x => x.valor === p)?.rotulo}</span>;
}

export function JanelaDosFeedbacks({ fechar }: { fechar: () => void }) {
  const vm = useFeedbacks();
  const topicos: TopicoDaJanela<string>[] = vm.filtros.map(f => ({ id: f.valor || TODOS, rotulo: f.rotulo, icone: ICONE_DO_FILTRO[f.valor], contador: f.qtd }));
  return (
    <JanelaLateral rotulo="Feedbacks" topicos={topicos} topico={vm.filtro || TODOS} mudar={id => vm.setFiltro(id === TODOS ? '' : id as SituacaoDoFeedback | 'bug')} fechar={fechar}
      classe="feedbacks-janela" resumo={<div className="usuario-quem"><b>Feedbacks</b></div>}>
      <ListaDosFeedbacks vm={vm} />
    </JanelaLateral>
  );
}

/**
 * O miolo dos Feedbacks: a prioridade e a ordem em cima, a lista e, por cima dela, o feedback aberto e o print ampliado.
 * Na janela ☰ da Tarefas (acima) e na página Feedbacks do site do admin (21/10/2026), com o mesmo ViewModel.
 */
export function ListaDosFeedbacks({ vm }: { vm: ReturnType<typeof useFeedbacks> }) {
  return (
    <>
      <div className="feedback-filtros">
        <Segmentado valor={vm.prioridade} onMudar={vm.setPrioridade} opcoes={vm.prioridades} />
        <span className="tarefas-barra-espaco" />
        <span className="hint">Ordem</span>
        <Segmentado valor={vm.ordem} onMudar={vm.setOrdem} opcoes={[{ valor: 'recentes', rotulo: 'Mais novos' }, { valor: 'prioridade', rotulo: 'Prioridade' }]} />
      </div>
      {vm.carregando ? <Esqueleto linhas={6} /> : !vm.lista.length ? <Vazio icone="mensagem" titulo="Nenhum feedback" /> : (
        <ul className="feedback-lista">
          {vm.lista.map(f => (
            <li key={f.id}>
              <button type="button" className="card feedback-item feedback-abre" onClick={() => vm.abrir(f.id)}>
                {f.imagem && <span className="feedback-mini"><img src={f.imagem} alt="" /></span>}
                <span className="feedback-conteudo">
                  <span className="feedback-quem">
                    {f.pedido && <b>{f.pedido}</b>}
                    <b>{f.nome || f.email || '—'}</b>
                    <span className="fraco">{f.quando}</span>
                    <SeloDaPrioridade p={f.prioridade} />
                    <SeloDoBug f={f} />
                    <span className={'badge ' + SELO[f.status]}>{NOME[f.status]}</span>
                  </span>
                  <span className="feedback-txt feedback-txt-curto">{f.tipo === 'bug' && f.empresa ? f.empresa + ' · ' : ''}{f.texto}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {vm.aberto && <JanelaDoFeedback f={vm.aberto} fechar={vm.fecharAberto} ampliar={vm.setAberta} marcar={vm.marcar} baixar={(id, i) => { void vm.baixarArquivoDoBug(id, i); }} baixarTudo={vm.baixarTudo} copiar={vm.copiarSolicitacao} />}
      {vm.aberta && (
        <div className="modal-overlay pessoal-fundo feedback-zoom" onMouseDown={() => vm.setAberta('')}>
          <img src={vm.aberta} alt="O print do feedback" />
        </div>
      )}
    </>
  );
}

/** A solicitação inteira numa janela flutuante por cima da lista: o print (clicar amplia), o texto, quem, quando, a tela
 * e a versão; embaixo Visto / Feito / Reabrir. O Esc fecha só esta janela. */
function JanelaDoFeedback({ f, fechar, ampliar, marcar, baixar, baixarTudo, copiar }: {
  f: NonNullable<ReturnType<typeof useFeedbacks>['aberto']>; fechar: () => void; ampliar: (img: string) => void; marcar: (id: string, s: SituacaoDoFeedback) => void;
  baixar: (id: string, i: number) => void;
  baixarTudo: (id: string) => Promise<void>;
  copiar: (id: string) => void;
}) {
  const [zipando, setZipando] = useState(false);
  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela)
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="pessoal-janela feedback-janela" role="dialog" aria-modal="true" aria-label={'Feedback de ' + (f.nome || f.email)}>
        <header className="pessoal-topo">
          <h2>{f.pedido ? f.pedido + ' · ' : ''}{f.nome || f.email || '—'}</h2>
          <span className="fraco">{f.quando}</span>
          <SeloDaPrioridade p={f.prioridade} />
          <SeloDoBug f={f} />
          <span className={'badge ' + SELO[f.status]}>{NOME[f.status]}</span>
          <span className="tarefas-barra-espaco" />
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="feedback-corpo">
          {f.imagem && (
            <button type="button" className="feedback-imagem feedback-amplia" title="Ampliar" onClick={() => ampliar(f.imagem)}>
              <img src={f.imagem} alt="O print do feedback" />
            </button>
          )}
          {/* o bug em blocos (Vitor, 28/10/2026: "melhorar para o usuário interpretar, tá muito bagunçado"): o que a pessoa
              disse, onde foi e o que o robô achou; o feedback comum fica no texto */}
          {f.lido ? (
            <>
              <section className="feedback-bloco">
                <p className="feedback-rotulo">O que a pessoa disse</p>
                <p className="feedback-txt feedback-disse">{f.lido.comentario || 'Sem comentário.'}</p>
              </section>
              <section className="feedback-bloco">
                <p className="feedback-rotulo">Onde foi</p>
                <dl className="ent-dados">{f.lido.campos.map(c => <div key={c.rotulo}><dt>{c.rotulo}</dt><dd>{c.valor}</dd></div>)}</dl>
              </section>
            </>
          ) : <p className="feedback-txt">{f.texto}</p>}
          {/* todos os arquivos (do bug ou anexados ao feedback), cada um no seu botão (26/10/2026) */}
          {f.arquivos.length > 0 && f.arquivos.map((a, i) => (
            <button key={i} type="button" className="btn btn-outline" onClick={() => baixar(f.id, i)}><Icone nome="download" />{a.nome}</button>
          ))}
          {/* tudo num .zip (Vitor, 27/10/2026): a pasta com o número do ticket e o nome da pessoa, com o print e os arquivos; por
              último e em outra cor (27/10/2026) */}
          {f.arquivos.length > 0 && (
            <BotaoAcao className="btn btn-success" carregando={zipando} textoCarregando="Juntando os arquivos"
              onClick={() => { setZipando(true); void baixarTudo(f.id).finally(() => setZipando(false)); }}>
              <Icone nome="download" />Baixar tudo (.zip)
            </BotaoAcao>
          )}
          {/* o report do robô do suporte (termina em "Realmente, isso é erro do sistema" ou "Precisa da sua análise") */}
          {f.lido && (
            <section className="feedback-bloco">
              <p className="feedback-rotulo">O que o robô achou</p>
              {!f.lido.report ? <p className="hint">{ANALISE[f.analise] || 'Sem report ainda.'}</p>
                : f.lido.report.falhou ? (
                  <Alerta naLinha titulo="O robô não conseguiu investigar" texto={f.lido.report.motivo}>
                    <p className="hint feedback-detalhe">Erro: {f.lido.report.detalhe}</p>
                  </Alerta>
                ) : <p className="feedback-txt feedback-relatorio">{f.lido.report.corpo}</p>}
            </section>
          )}
          {!f.lido && <span className="fraco feedback-onde">{f.tela}{f.versao ? ' · ' + f.versao : ''}</span>}
        </div>
        <footer className="usuario-pe">
          {/* o texto da solicitação, para colar (Vitor, 27/10/2026) */}
          <button type="button" className="btn btn-outline" title="Copiar o texto da solicitação" onClick={() => copiar(f.id)}><Icone nome="copiar" />Copiar solicitação</button>
          <span className="tarefas-barra-espaco" />
          {f.status === 'novo' && <button type="button" className="btn btn-outline" onClick={() => marcar(f.id, 'visto')}><Icone nome="olho" />Visto</button>}
          {/* Resolvendo (Vitor, 26/10/2026): quem mandou é avisado no Tarefas */}
          {(f.status === 'novo' || f.status === 'visto') && <button type="button" className="btn btn-outline" title="Avisa quem mandou que está sendo resolvido" onClick={() => marcar(f.id, 'resolvendo')}><Icone nome="clock" />Resolvendo</button>}
          {f.status !== 'feito' && <button type="button" className="btn btn-primary" onClick={() => marcar(f.id, 'feito')}><Icone nome="check" />Feito</button>}
          {f.status === 'feito' && <button type="button" className="btn btn-outline" onClick={() => marcar(f.id, 'novo')}>Reabrir</button>}
        </footer>
      </div>
    </div>
  );
}

/** Os Feedbacks no pé da gaveta ☰ (só o admin): só o ícone do envelope (28/10/2026), com quantos novos no título. */
export function ItemDosFeedbacks({ abrir }: { abrir: () => void }) {
  const novos = useFeedbacks().filtros[0].qtd;
  return <BotaoIcone icone="envelope" titulo={'Feedbacks' + (novos > 0 ? ' (' + novos + (novos === 1 ? ' novo)' : ' novos)') : '')} onClick={abrir} />;
}
