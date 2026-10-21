// Os feedbacks da equipe (Vitor, 07/10/2026: "abra uma janela flutuante", aberta no pé da gaveta ☰, junto da versão):
// à esquerda Novos / Vistos / Feitos / Todos; à direita cada feedback com o print (clicar amplia), o texto, quem,
// quando, a tela e a versão; Visto e Feito. A prioridade (Vitor, 19/10/2026) no selo suave, com o filtro (Todas, Alta,
// Média, Baixa) e a ordem (Mais novos ou Prioridade) em cima da lista.
import { BotaoFechar, Esqueleto, Icone, Segmentado, useJanela, Vazio } from '@nads/ui';
import { useRef } from 'react';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import { PRIORIDADES, type PrioridadeDoFeedback, type SituacaoDoFeedback } from '../../dados/feedback';
import { useFeedbacks } from './useFeedbacks';

const SELO = { novo: 'badge-warn', visto: 'badge-neutral', feito: 'badge-ok' } as const;
const NOME = { novo: 'Novo', visto: 'Visto', feito: 'Feito' } as const;
export const ICONE_DO_FILTRO = { novo: 'envelope', visto: 'olho', feito: 'check', '': 'relatorio', bug: 'alert' } as const;
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
      {vm.aberto && <JanelaDoFeedback f={vm.aberto} fechar={vm.fecharAberto} ampliar={vm.setAberta} marcar={vm.marcar} baixar={id => { void vm.baixarArquivoDoBug(id); }} />}
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
function JanelaDoFeedback({ f, fechar, ampliar, marcar, baixar }: {
  f: NonNullable<ReturnType<typeof useFeedbacks>['aberto']>; fechar: () => void; ampliar: (img: string) => void; marcar: (id: string, s: SituacaoDoFeedback) => void;
  baixar: (id: string) => void;
}) {
  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela)
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="pessoal-janela feedback-janela" role="dialog" aria-modal="true" aria-label={'Feedback de ' + (f.nome || f.email)}>
        <header className="pessoal-topo">
          <h2>{f.nome || f.email || '—'}</h2>
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
          {f.tipo === 'bug' && (
            <p className="feedback-txt"><b>{f.empresa || '—'}</b>{f.caminho ? ' · ' + f.caminho : ''}</p>
          )}
          <p className="feedback-txt">{f.texto}</p>
          {f.tipo === 'bug' && f.arquivo && (
            <button type="button" className="btn btn-outline" onClick={() => baixar(f.id)}><Icone nome="download" />{f.arquivo.nome}</button>
          )}
          {/* o report do robô do suporte (termina em "Realmente, isso é erro do sistema" ou "Precisa da sua análise") */}
          {f.tipo === 'bug' && (f.relatorio ? <p className="feedback-txt feedback-relatorio">{f.relatorio}</p> : <p className="hint">{ANALISE[f.analise] || 'Sem report ainda.'}</p>)}
          <span className="fraco feedback-onde">{f.tela}{f.versao ? ' · ' + f.versao : ''}</span>
        </div>
        <footer className="usuario-pe">
          <span className="tarefas-barra-espaco" />
          {f.status === 'novo' && <button type="button" className="btn btn-outline" onClick={() => marcar(f.id, 'visto')}><Icone nome="olho" />Visto</button>}
          {f.status !== 'feito' && <button type="button" className="btn btn-primary" onClick={() => marcar(f.id, 'feito')}><Icone nome="check" />Feito</button>}
          {f.status === 'feito' && <button type="button" className="btn btn-outline" onClick={() => marcar(f.id, 'novo')}>Reabrir</button>}
        </footer>
      </div>
    </div>
  );
}

/** O item Feedbacks no pé da gaveta ☰ (só o admin), com quantos novos. */
export function ItemDosFeedbacks({ abrir }: { abrir: () => void }) {
  const novos = useFeedbacks().filtros[0].qtd;
  return (
    <button type="button" className="drawer-item" onClick={abrir}>
      <Icone nome="envelope" />Feedbacks{novos > 0 && <span className="menu-contador drawer-contador">{novos}</span>}
    </button>
  );
}
