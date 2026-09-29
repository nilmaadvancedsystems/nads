// Etapa 6 do Creditor: cruzamento banco × sistema pela NF, com as decisões das divergências.
import { creditor as cr } from '@nads/core';
import { Segmentado, Stat } from '@nads/ui';
import { Fragment } from 'react';
import { Celula } from '../conferencia/partes/Celula';
import { useCruzamento, type Filtro } from './useCruzamento';

const BADGE: Record<cr.SituacaoCruzamento, string> = {
  ok: 'badge badge-ok', dividido: 'badge badge-neutral', 'valor-diverge': 'badge badge-bad', 'cliente-diverge': 'badge badge-warn', 'nao-encontrada': 'badge badge-bad',
};

export function Cruzamento() {
  const vm = useCruzamento();
  return (
    <section>
      <div className="dash-grid" style={{ marginBottom: 16 }}>
        <Stat rotulo="Batem" valor={vm.resumo.ok} grande={false} />
        <Stat rotulo="Duplicatas juntas" valor={vm.resumo.divididos} grande={false} />
        <Stat rotulo="Para decidir" valor={vm.resumo.pendentes + ' de ' + vm.resumo.decidir} cor={vm.resumo.pendentes ? 'entrada' : undefined} grande={false} />
        <Stat rotulo="Excluídos" valor={vm.resumo.excluidos} grande={false} />
        {vm.resumo.aprendidas > 0 && <Stat rotulo="Contas aprendidas" valor={vm.resumo.aprendidas} grande={false} />}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Títulos</h3>
          <Segmentado<Filtro> valor={vm.filtro} onMudar={vm.setFiltro}
            opcoes={[{ valor: 'todos', rotulo: 'Todos' }, { valor: 'avisos', rotulo: 'Com aviso' }, { valor: 'decidir', rotulo: 'Para decidir' }]} />
        </div>
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table>
            <thead>
              <tr><th>NF</th><th>Liquidação</th><th>Sacado (banco)</th><th>Cliente (sistema)</th><th className="num">Valor banco</th><th className="num">Valor sistema</th><th>Contrapartida</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {vm.linhas.map(l => (
                <Fragment key={l.id}>
                  <tr className={l.decisao?.tipo === 'excluir' ? 'linha-excluida' : l.precisa && !l.resolvida ? 'bad' : ''}>
                    <td>{l.nf}</td>
                    <td>{l.liquidacao}</td>
                    <td>{l.sacado}</td>
                    <td>{l.cliente || '—'}</td>
                    <td className="num">{cr.brl(l.valorBanco)}</td>
                    <td className="num">{l.valorSistema == null ? '—' : cr.brl(l.valorSistema)}</td>
                    <td>{l.contrapartida || '—'}</td>
                    <td><span className={BADGE[l.situacao]}>{l.rotulo}</span></td>
                  </tr>
                  {(l.nota || l.precisa) && (
                    <tr className="linha-nota">
                      <td colSpan={8}>
                        {l.nota && <span className="hint" style={{ marginRight: 12 }}>{l.nota}</span>}
                        {l.precisa && (l.decisao && l.resolvida ? (
                          <span className="decisao">
                            <b>{l.decisao.tipo === 'excluir' ? 'Fica fora do arquivo.' : l.decisao.tipo === 'confirmar' ? 'Usar o valor do banco.' : l.aprendida ? 'Conta aprendida do cliente (já conciliado antes).' : 'Contrapartida informada.'}</b>
                            {l.decisao.tipo === 'manual' && (
                              <>
                                <Celula valor={l.decisao.contrapartida} largura={90} rotulo="Contrapartida" onGravar={v => vm.manual(l.id, 'contrapartida', v)} />
                                <Celula valor={l.decisao.historico} largura={260} rotulo="Histórico" placeholder={l.historicoPadrao} onGravar={v => vm.manual(l.id, 'historico', v)} />
                              </>
                            )}
                            {l.aprendida
                              ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => vm.excluir(l.id)}>Excluir título</button>
                              : <button className="btn btn-ghost btn-sm" type="button" onClick={() => vm.desfazer(l.id)}>Desfazer</button>}
                          </span>
                        ) : (
                          <span className="decisao">
                            {l.temLinha && <button className="btn btn-outline btn-sm" type="button" onClick={() => vm.confirmar(l.id)}>{l.situacao === 'cliente-diverge' ? 'É o mesmo cliente' : 'Usar valor do banco'}</button>}
                            {!l.temLinha && (
                              <>
                                <Celula valor={l.decisao?.tipo === 'manual' ? l.decisao.contrapartida : ''} largura={90} rotulo="Contrapartida" placeholder="Contrapartida" onGravar={v => vm.manual(l.id, 'contrapartida', v)} />
                                <Celula valor={l.decisao?.tipo === 'manual' ? l.decisao.historico : ''} largura={260} rotulo="Histórico" placeholder={l.historicoPadrao} onGravar={v => vm.manual(l.id, 'historico', v)} />
                              </>
                            )}
                            <button className="btn btn-ghost btn-sm" type="button" onClick={() => vm.excluir(l.id)}>Excluir título</button>
                          </span>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!vm.linhas.length && <p className="hint">Nada neste filtro.</p>}
      </div>

      <div className="btn-row">
        <button className="btn btn-ghost" type="button" onClick={vm.voltar}>← Voltar</button>
        <button className="btn btn-primary" type="button" disabled={!vm.podeContinuar} onClick={vm.continuar}>
          {vm.resumo.pendentes ? 'Faltam ' + vm.resumo.pendentes + ' decisão(ões)' : 'Continuar para os lançamentos'}
        </button>
      </div>
    </section>
  );
}
