// O bloco "Feedbacks" da empresa (Vitor, 19/10/2026: o sênior deixa um recado para a equipe, com a prioridade): o
// formulário curto (o texto e a prioridade) para quem escreve e a lista, com a prioridade no selo suave, quem escreveu,
// quando e se já foi resolvido. Na janela da empresa do Cadastro e na página da empresa. Peça do catálogo (Listas).
import { empresas } from '@nads/core';
import { BotaoAcao, BotaoIcone, Icone, Segmentado, Vazio } from '@nads/ui';

type Prioridade = empresas.feedbacks.Prioridade;

/** A cor do selo pela prioridade: alta vermelho, média amarelo, baixa neutro. */
export const SELO_DA_PRIORIDADE: Record<Prioridade, string> = { alta: 'badge-bad', media: 'badge-warn', baixa: 'badge-neutral' };

export interface LinhaDoFeedback {
  id: string;
  texto: string;
  prioridade: Prioridade;
  autor: string;
  /** 'dd/mm/aaaa' */
  data: string;
  resolvido: boolean;
  /** "Resolvido por Nilma em 12/10/2026" ('' enquanto aberto) */
  resolucao: string;
  /** o autor, o diretor ou o admin: resolve, reabre e apaga */
  podeMexer: boolean;
}

export interface BlocoDeFeedbacksProps {
  linhas: readonly LinhaDoFeedback[];
  abertos: number;
  carregando?: boolean;
  /** por que não leu (a regra do banco) */
  erro?: string;
  /** o sênior, o diretor e o admin escrevem; os outros só leem */
  podeEscrever: boolean;
  texto: string;
  prioridade: Prioridade;
  aoMudarTexto: (v: string) => void;
  aoMudarPrioridade: (p: Prioridade) => void;
  aoEnviar: () => void;
  enviando?: boolean;
  /** o feedback que está gravando (resolver, reabrir, apagar) */
  ocupado?: string | null;
  aoResolver: (id: string, resolvido: boolean) => void;
  aoApagar: (id: string) => void;
}

export function BlocoDeFeedbacks(p: BlocoDeFeedbacksProps) {
  const restam = empresas.feedbacks.TEXTO_MAXIMO - p.texto.trim().length;
  return (
    <section className="card fb-bloco">
      <div className="card-head">
        <h3>Feedbacks</h3>
        {p.abertos > 0 && <span className="badge badge-neutral">{p.abertos === 1 ? '1 em aberto' : p.abertos + ' em aberto'}</span>}
      </div>
      <div className="fb-corpo">
        {p.podeEscrever && (
          <div className="fb-novo">
            <div className="field">
              <label htmlFor="fb-texto">Novo feedback para a equipe</label>
              <textarea id="fb-texto" rows={2} value={p.texto} maxLength={empresas.feedbacks.TEXTO_MAXIMO + 50} placeholder="Ex.: o cliente atrasa o extrato; cobrar até o dia 5."
                onChange={e => p.aoMudarTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) p.aoEnviar(); }} />
            </div>
            <div className="fb-novo-pe">
              <span className="fraco">Prioridade</span>
              <Segmentado valor={p.prioridade} onMudar={p.aoMudarPrioridade}
                opcoes={[...empresas.feedbacks.PRIORIDADES].reverse().map(x => ({ valor: x.id, rotulo: x.rotulo }))} />
              <span className={'fraco fb-restam' + (restam < 0 ? ' cor-entrada' : '')}>{restam < 100 ? restam + ' caracteres' : ''}</span>
              <BotaoAcao className="btn btn-primary" carregando={p.enviando} textoCarregando="Enviando…" disabled={!p.texto.trim() || restam < 0} onClick={p.aoEnviar}>
                <Icone nome="aviao" width={16} height={16} />Enviar
              </BotaoAcao>
            </div>
          </div>
        )}
        {p.carregando ? <p className="fraco">Procurando os feedbacks…</p>
          : p.erro ? <p className="fraco">Não deu para ler os feedbacks: {p.erro}</p>
          : !p.linhas.length ? <Vazio compacto icone="mensagem" texto="Nenhum feedback sobre esta empresa." />
          : (
            <ul className="fb-lista">
              {p.linhas.map(l => (
                <li key={l.id} className={'fb-item' + (l.resolvido ? ' resolvido' : '')}>
                  <div className="fb-item-topo">
                    <span className={'badge badge-suave ' + SELO_DA_PRIORIDADE[l.prioridade]}>{empresas.feedbacks.rotuloDaPrioridade(l.prioridade)}</span>
                    <b>{l.autor || 'Alguém da equipe'}</b>
                    <span className="fraco num">{l.data}</span>
                    {l.resolvido && <span className="badge badge-suave badge-ok">Resolvido</span>}
                    {l.podeMexer && (
                      <span className="fb-acoes">
                        <BotaoAcao className="btn btn-ghost" carregando={p.ocupado === l.id} textoCarregando="Gravando…" onClick={() => p.aoResolver(l.id, !l.resolvido)}
                          title={l.resolvido ? 'Voltar o feedback para em aberto' : 'Marcar o feedback como resolvido'}>
                          <Icone nome={l.resolvido ? 'repeat' : 'checkCircle'} width={16} height={16} />{l.resolvido ? 'Reabrir' : 'Resolver'}
                        </BotaoAcao>
                        <BotaoIcone icone="lixeira" titulo="Apagar o feedback" disabled={p.ocupado === l.id} onClick={() => p.aoApagar(l.id)} />
                      </span>
                    )}
                  </div>
                  <p className="fb-texto">{l.texto}</p>
                  {l.resolucao && <p className="hint">{l.resolucao}</p>}
                </li>
              ))}
            </ul>
          )}
        {!p.podeEscrever && <p className="fraco">Os feedbacks são escritos pelo sênior, pelo diretor e pelo admin.</p>}
      </div>
    </section>
  );
}
