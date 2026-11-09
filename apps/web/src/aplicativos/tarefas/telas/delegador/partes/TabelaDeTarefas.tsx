// A tabela da Central de tarefas (28/10/2026, as colunas do "Minhas Tarefas" do Toriba): Status (a bolinha), Título (com o
// número e quantos anexos e pareceres tem), Prioridade, Prazo (vermelho quando atrasada), Cliente e a pessoa (quem delegou,
// o responsável ou de/para quem, conforme a aba). A linha inteira abre a tarefa; o título é o botão (o teclado chega nele).
import { Icone } from '@nads/ui';
import type { tarefas } from '@nads/core';
import { SeloDaPrioridade, SeloDoStatus } from './SelosDaTarefa';

export interface LinhaDaTabelaDeTarefas {
  id: string;
  numero: number;
  titulo: string;
  status: { rotulo: string; tom: 'warn' | 'info' | 'ok' | 'neutral' };
  prioridade: { valor: 'baixa' | 'normal' | 'alta' | 'urgente'; rotulo: string };
  prazo: string;
  atrasada: boolean;
  cliente: string;
  /** quantos clientes além do primeiro */
  maisClientes?: number;
  /** todos, um por linha (a dica da célula) */
  clientes?: string;
  pessoa: string;
  acoes?: tarefas.delegadas.AcaoDaTarefa[];
  movimento?: string;
  anexos: number;
  pareceres: number;
}

const ICONE_DA_ACAO = { iniciar: 'play', retomar: 'play', pausar: 'clock', concluir: 'check' } as const;

export function TabelaDeTarefas({ linhas, colunaDaPessoa, colunaExtra, abrir, fazerAcao }: {
  linhas: readonly LinhaDaTabelaDeTarefas[]; colunaDaPessoa: string; colunaExtra?: 'acoes' | 'movimento' | null;
  abrir: (id: string) => void; fazerAcao?: (id: string, status: tarefas.delegadas.Status) => void;
}) {
  return (
    <div className="table-wrap tdl-tabela">
      <table className="table-compact">
        <thead>
          <tr><th>Status</th><th>Título</th><th>Prioridade</th><th>Prazo</th><th>Cliente</th><th>{colunaDaPessoa}</th>{colunaExtra === 'movimento' && <th>Andamento</th>}{colunaExtra === 'acoes' && <th />}</tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.id} className="tdl-linha" onClick={() => abrir(l.id)}>
              <td><SeloDoStatus rotulo={l.status.rotulo} tom={l.status.tom} /></td>
              <td className="tdl-titulo">
                <button type="button" className="tdl-abrir" onClick={e => { e.stopPropagation(); abrir(l.id); }} title={'Abrir a tarefa ' + l.numero}>
                  <span className="fraco num">{l.numero}</span>
                  <span className="tdl-titulo-texto">{l.titulo}</span>
                </button>
                {(l.anexos > 0 || l.pareceres > 0) && (
                  <span className="tdl-contas">
                    {l.anexos > 0 && <span className="fraco tdl-conta" title={l.anexos === 1 ? '1 anexo' : l.anexos + ' anexos'}><Icone nome="clipe" width={14} height={14} />{l.anexos}</span>}
                    {l.pareceres > 0 && <span className="fraco tdl-conta" title={l.pareceres === 1 ? '1 parecer' : l.pareceres + ' pareceres'}><Icone nome="mensagem" width={14} height={14} />{l.pareceres}</span>}
                  </span>
                )}
              </td>
              <td><SeloDaPrioridade valor={l.prioridade.valor} rotulo={l.prioridade.rotulo} /></td>
              <td className={'num tdl-prazo' + (l.atrasada ? ' tdl-atrasada' : '')} title={l.atrasada ? 'Atrasada' : undefined}>{l.prazo || <span className="fraco">—</span>}</td>
              <td title={l.clientes || l.cliente || undefined}><span className="tdl-cliente-linha"><span className="tdl-cliente">{l.cliente || <span className="fraco">—</span>}</span>{!!l.maisClientes && l.maisClientes > 0 && <span className="fraco">+{l.maisClientes}</span>}</span></td>
              <td className="tdl-pessoa">{l.pessoa}</td>
              {colunaExtra === 'movimento' && <td className="fraco">{l.movimento}</td>}
              {colunaExtra === 'acoes' && (
                <td><div className="tdl-acoes-linha">
                  {l.acoes?.map(a => (
                    <button key={a.id} type="button" className="btn btn-outline" onClick={e => { e.stopPropagation(); fazerAcao?.(l.id, a.status); }}>
                      <Icone nome={ICONE_DA_ACAO[a.id]} width={14} height={14} />{a.rotulo}
                    </button>
                  ))}
                </div></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
