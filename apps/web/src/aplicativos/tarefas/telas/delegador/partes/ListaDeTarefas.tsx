// A lista de tarefas (09/11/2026: "dá uma repaginada total"), no jeito da lista de issues do GitHub: uma linha por tarefa,
// com a marca do status, o título (a prioridade só quando pede atenção, e o clipe e o balão) e, embaixo, o status, o número,
// o cliente e o último movimento; à direita o prazo (vermelho quando atrasada), a pessoa e os botões de quem faz.
// Agrupada por prazo; a linha inteira abre a tarefa e o título é o botão (o teclado chega nele).
import { Icone, type NomeIcone } from '@nads/ui';
import type { tarefas } from '@nads/core';
import { SeloDaPrioridade } from './SelosDaTarefa';

export interface LinhaDaListaDeTarefas {
  id: string;
  numero: number;
  titulo: string;
  status: { valor: tarefas.delegadas.Status; rotulo: string };
  prioridade: { valor: 'baixa' | 'normal' | 'alta' | 'urgente'; rotulo: string };
  prazo: string;
  atrasada: boolean;
  cliente: string;
  /** quantos clientes além do primeiro */
  maisClientes?: number;
  /** todos, um por linha (a dica) */
  clientes?: string;
  pessoa: string;
  acoes?: tarefas.delegadas.AcaoDaTarefa[];
  movimento?: string;
  anexos: number;
  pareceres: number;
}

/** rotulo vazio: a lista sem a faixa do grupo (as concluídas) */
export interface GrupoDaListaDeTarefas { id: string; rotulo: string; linhas: readonly LinhaDaListaDeTarefas[] }

/** a cor (as do painel) e o ícone de cada situação: a marca da linha e os filtros do topo da lista */
export const DA_SITUACAO: Record<string, { tom: 'neutro' | 'aviso' | 'info' | 'roxo' | 'laranja' | 'ok'; icone: NomeIcone }> = {
  '': { tom: 'neutro', icone: 'checklist' },
  pendente: { tom: 'aviso', icone: 'caixaEntrada' },
  andamento: { tom: 'info', icone: 'play' },
  pausada: { tom: 'roxo', icone: 'clock' },
  atrasadas: { tom: 'laranja', icone: 'alert' },
  concluida: { tom: 'ok', icone: 'check' },
  cancelada: { tom: 'neutro', icone: 'x' },
};

const ICONE_DA_ACAO = { iniciar: 'play', retomar: 'play', pausar: 'clock', concluir: 'check' } as const;

/** a inicial da pessoa ("de Fulano" e "para Fulano" nas concluídas contam pelo nome) */
const inicialDe = (pessoa: string) => pessoa.replace(/^(de|para) /, '').charAt(0).toUpperCase();

function Linha({ l, colunaDaPessoa, comAcoes, abrir, fazerAcao }: {
  l: LinhaDaListaDeTarefas; colunaDaPessoa: string; comAcoes: boolean;
  abrir: (id: string) => void; fazerAcao?: (id: string, status: tarefas.delegadas.Status) => void;
}) {
  const s = DA_SITUACAO[l.status.valor];
  const pedeAtencao = l.prioridade.valor === 'urgente' || l.prioridade.valor === 'alta';
  return (
    <li className={'tdl-linha' + (comAcoes ? ' com-acoes' : '')} title="Abrir a tarefa" onClick={() => abrir(l.id)}>
      <span className={'tdl-marca painel-' + s.tom} title={l.status.rotulo} aria-hidden="true"><Icone nome={s.icone} width={13} height={13} /></span>
      <div className="tdl-corpo">
        <div className="tdl-corpo-titulo">
          <button type="button" className="tdl-abrir" onClick={e => { e.stopPropagation(); abrir(l.id); }} title="Abrir a tarefa">
            <span className="tdl-titulo-texto">{l.titulo}</span>
          </button>
          {pedeAtencao && <SeloDaPrioridade valor={l.prioridade.valor} rotulo={l.prioridade.rotulo} />}
          {l.anexos > 0 && <span className="fraco tdl-conta" title={l.anexos === 1 ? '1 anexo' : l.anexos + ' anexos'}><Icone nome="clipe" width={14} height={14} />{l.anexos}</span>}
          {l.pareceres > 0 && <span className="fraco tdl-conta" title={l.pareceres === 1 ? '1 parecer' : l.pareceres + ' pareceres'}><Icone nome="mensagem" width={14} height={14} />{l.pareceres}</span>}
        </div>
        <p className="tdl-meta">
          <span>{l.status.rotulo}</span>
          {l.cliente && <span className="tdl-meta-cliente" title={l.clientes || l.cliente}>{l.cliente}{!!l.maisClientes && l.maisClientes > 0 && ' +' + l.maisClientes}</span>}
          {l.movimento && <span className="tdl-meta-cliente">{l.movimento}</span>}
        </p>
      </div>
      <span className={'tdl-prazo num' + (l.atrasada ? ' tdl-atrasada' : '')} title={l.atrasada ? 'Atrasada' : 'Prazo'}>
        {l.prazo ? <><Icone nome="calendar" width={14} height={14} />{l.prazo}</> : <span className="fraco">Sem prazo</span>}
      </span>
      <span className="tdl-quem" title={colunaDaPessoa + ': ' + l.pessoa}>
        <span className="tdl-avatar" aria-hidden="true">{inicialDe(l.pessoa)}</span>
        <span className="tdl-quem-nome">{l.pessoa}</span>
      </span>
      {comAcoes && (
        <div className="tdl-acoes-linha">
          {l.acoes?.map(a => (
            <button key={a.id} type="button" className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); fazerAcao?.(l.id, a.status); }}>
              <Icone nome={ICONE_DA_ACAO[a.id]} width={14} height={14} />{a.rotulo}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

export function ListaDeTarefas({ grupos, colunaDaPessoa, comAcoes = false, abrir, fazerAcao }: {
  grupos: readonly GrupoDaListaDeTarefas[]; colunaDaPessoa: string; comAcoes?: boolean;
  abrir: (id: string) => void; fazerAcao?: (id: string, status: tarefas.delegadas.Status) => void;
}) {
  return (
    <div className="tdl-grupos">
      {grupos.map(g => (
        <section key={g.id} aria-label={g.rotulo || 'Tarefas'}>
          {g.rotulo && <h4 className={'tdl-grupo' + (g.id === 'atrasadas' ? ' tdl-atrasada' : '')}>{g.rotulo}<span className="tdl-aba-qtd">{g.linhas.length}</span></h4>}
          <ul className="tdl-linhas">
            {g.linhas.map(l => <Linha key={l.id} l={l} colunaDaPessoa={colunaDaPessoa} comAcoes={comAcoes} abrir={abrir} fazerAcao={fazerAcao} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
