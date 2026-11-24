// Outros colaboradores (a novidade 'outros-colaboradores'; Vitor, 24/11/2026): o Sênior, o Diretor e o Dono veem as tarefas
// delegadas para os Juniores e Plenos, só para saber como estão. Um cartão por pessoa (quantas em aberto e atrasadas) com a
// tabela; clicar na linha mostra a descrição e o histórico logo abaixo. Nada de ação: sem caixinha, sem sino, sem abrir para mexer.
import { Icone, Segmentado, Vazio } from '@nads/ui';
import { Fragment } from 'react';
import { createPortal } from 'react-dom';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { SeloDaPrioridade, SeloDoStatus } from '../../delegador/partes/SelosDaTarefa';
import type { PessoaComFoto } from '../useInicioNovo';
import { useOutrosColaboradores, type SituacaoDosColaboradores } from '../useOutrosColaboradores';
import { Foto } from './PainelDoInicio';

const TOM: Record<string, 'warn' | 'info' | 'neutral' | 'ok'> = { pendente: 'warn', andamento: 'info', pausada: 'neutral', concluida: 'ok', cancelada: 'neutral' };

export function OutrosColaboradores({ busca, comFoto, lugarDosFiltros }: { busca: string; comFoto: (p: { uid: string; nome: string }) => PessoaComFoto; lugarDosFiltros?: HTMLElement | null }) {
  const vm = useOutrosColaboradores(busca);
  if (!vm.ve) return <section className="card"><Vazio icone="usuario" titulo="Só o Sênior, o Diretor e o Dono" texto="Outros colaboradores mostra as tarefas dos Juniores e Plenos para quem acompanha a equipe." /></section>;
  const filtros = (
    <>
      <Segmentado<SituacaoDosColaboradores> valor={vm.situacao} onMudar={vm.setSituacao} opcoes={[{ valor: 'abertas', rotulo: 'Em aberto' }, { valor: 'concluidas', rotulo: 'Concluídas' }]} />
      {vm.pessoas.length > 0 && <MenuDeFiltro rotulo="Colaborador" valor={vm.quem} mudar={vm.setQuem} todos="Todos os colaboradores" opcoes={vm.pessoas} />}
    </>
  );
  return (
    <section className="ini-lista">
      {lugarDosFiltros ? createPortal(filtros, lugarDosFiltros) : <div className="tarefas-barra-topo">{filtros}</div>}
      <p className="hint ini-quadro-dica"><Icone nome="lampada" width={13} height={13} />Só para ver: as tarefas delegadas para os Juniores e Plenos. Nada aqui muda a tarefa.</p>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {!vm.carregando && !vm.grupos.length && (
        <section className="card">
          <Vazio icone={vm.vazio ? 'checkCircle' : 'search'} titulo={vm.vazio ? (vm.situacao === 'abertas' ? 'Nenhuma tarefa em aberto' : 'Nenhuma tarefa concluída') : 'Nada com esse filtro'}
            texto={vm.vazio ? 'As tarefas delegadas para os Juniores e Plenos aparecem aqui.' : 'Troque o colaborador ou a busca.'} />
        </section>
      )}
      {vm.grupos.map(g => (
        <section key={g.pessoa.uid} className="card ini-grupo">
          <div className="card-head ini-colab-topo">
            <span className="ini-pessoa"><Foto p={comFoto(g.pessoa)} /><h3>{g.pessoa.nome}</h3></span>
            <span className="fraco">{g.abertas} em aberto{g.atrasadas > 0 && <> · <span className="tdl-atrasada">{g.atrasadas} atrasada{g.atrasadas > 1 ? 's' : ''}</span></>}</span>
          </div>
          <div className="table-wrap">
            <table className="table-compact ini-colab-tabela">
              <thead>
                <tr><th>Tarefa</th><th>Prazo</th><th>Situação</th><th>Prioridade</th><th>Cliente</th><th>Delegada por</th><th>Último movimento</th></tr>
              </thead>
              <tbody>
                {g.linhas.map(l => (
                  <Fragment key={l.id}>
                    <tr className="ini-tr" onClick={() => vm.alternar(l.id)} title={vm.aberta === l.id ? 'Fechar o detalhe' : 'Ver a descrição e o histórico'} aria-expanded={vm.aberta === l.id}>
                      <td title={l.titulo}>{l.partes.titulo}{l.partes.periodo && <><br /><span className="hint">{l.partes.periodo}</span></>}</td>
                      <td className={l.atrasada ? 'tdl-atrasada' : undefined}>{l.prazo}</td>
                      <td><SeloDoStatus rotulo={l.status.rotulo} tom={TOM[l.status.valor] || 'neutral'} /></td>
                      <td><SeloDaPrioridade valor={l.prioridade.valor} rotulo={l.prioridade.rotulo} /></td>
                      <td>{l.cliente ? <span className="ini-empresa">{l.cliente}</span> : '—'}{l.maisClientes > 0 && <span className="fraco"> +{l.maisClientes}</span>}</td>
                      <td>{l.delegadaPor}</td>
                      <td className="fraco">{l.movimento}</td>
                    </tr>
                    {vm.aberta === l.id && (
                      <tr className="ini-colab-detalhe">
                        <td colSpan={7}>
                          <p className="ini-detalhe-texto">{l.descricao || <span className="fraco">Sem descrição.</span>}</p>
                          {l.historico.length > 0 && (
                            <ul className="ini-colab-historico">
                              {l.historico.map((h, i) => <li key={i}><span className="fraco num">{h.quando}</span> <b>{h.por}</b> {h.texto}</li>)}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </section>
  );
}
