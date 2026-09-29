// Etapa Contas do Creditor: a conta de cada título (aprendida ou do balancete) e, sem conta, a decisão.
import { creditor as cr } from '@nads/core';
import { Alerta, Segmentado, Stat } from '@nads/ui';
import { Fragment } from 'react';
import { Celula } from './partes/Celula';
import { useCruzamento, type Filtro } from './useCruzamento';

const BADGE: Record<cr.SituacaoCruzamento, string> = {
  ok: 'badge badge-ok', dividido: 'badge badge-neutral', 'valor-diverge': 'badge badge-bad', 'cliente-diverge': 'badge badge-warn', 'nao-encontrada': 'badge badge-bad',
};

export function Cruzamento() {
  const vm = useCruzamento();
  return (
    <section>
      {vm.semBalancete && (
        <Alerta titulo="Esta empresa não tem balancete" texto="Importe o balancete no contábil para as contas dos clientes virem sozinhas. Até lá, informe a conta de cada cliente (fica aprendida)." />
      )}
      <div className="dash-grid" style={{ marginBottom: 16 }}>
        <Stat rotulo="Com conta" valor={vm.resumo.ok} grande={false} />
        <Stat rotulo="Para decidir" valor={vm.resumo.pendentes + ' de ' + vm.resumo.decidir} cor={vm.resumo.pendentes ? 'entrada' : undefined} grande={false} />
        <Stat rotulo="Excluídos" valor={vm.resumo.excluidos} grande={false} />
        {vm.resumo.aprendidas > 0 && <Stat rotulo="Contas aprendidas" valor={vm.resumo.aprendidas} grande={false} />}
      </div>

      <datalist id="contasClientes">
        {vm.contasClientes.map(c => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
      </datalist>

      <div className="card">
        <div className="card-head">
          <h3>Títulos</h3>
          <Segmentado<Filtro> valor={vm.filtro} onMudar={vm.setFiltro}
            opcoes={[{ valor: 'todos', rotulo: 'Todos' }, { valor: 'avisos', rotulo: 'Com aviso' }, { valor: 'decidir', rotulo: 'Para decidir' }]} />
        </div>
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table>
            <thead>
              <tr><th>NF</th><th>Liquidação</th><th>Sacado (banco)</th><th>Conta no balancete</th><th className="num">Valor</th><th>Contrapartida</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {vm.linhas.map(l => (
                <Fragment key={l.id}>
                  <tr className={l.decisao?.tipo === 'excluir' ? 'linha-excluida' : l.precisa && !l.resolvida ? 'bad' : ''}>
                    <td>{l.nf}</td>
                    <td>{l.liquidacao}</td>
                    <td>{l.sacado}</td>
                    <td>{l.nomeDaConta || '—'}</td>
                    <td className="num">{cr.brl(l.valorBanco)}</td>
                    <td>{l.contrapartida || '—'}</td>
                    <td><span className={BADGE[l.situacao]}>{l.rotulo}</span></td>
                  </tr>
                  {(l.nota || l.precisa) && (
                    <tr className="linha-nota">
                      <td colSpan={7}>
                        {l.nota && <span className="hint" style={{ marginRight: 12 }}>{l.nota}</span>}
                        {l.precisa && (l.decisao?.tipo === 'excluir' ? (
                          <span className="decisao">
                            <b>Fica fora do arquivo.</b>
                            <button className="btn btn-ghost btn-sm" type="button" onClick={() => vm.desfazer(l.id)}>Desfazer</button>
                          </span>
                        ) : (
                          <span className="decisao">
                            {l.opcoes.map(o => (
                              <button key={o.codigo} type="button" title={o.nome}
                                className={'btn btn-sm ' + (l.decisao?.tipo === 'manual' && l.decisao.contrapartida === o.codigo ? 'btn-primary' : 'btn-outline')}
                                onClick={() => vm.manual(l.id, 'contrapartida', o.codigo)}>
                                {o.codigo}
                              </button>
                            ))}
                            <Celula valor={l.decisao?.tipo === 'manual' ? l.decisao.contrapartida : ''} largura={90} rotulo="Contrapartida" placeholder="Conta" lista="contasClientes" onGravar={v => vm.manual(l.id, 'contrapartida', v)} />
                            <Celula valor={l.decisao?.tipo === 'manual' ? l.decisao.historico : ''} largura={260} rotulo="Histórico" placeholder={l.historicoPadrao} onGravar={v => vm.manual(l.id, 'historico', v)} />
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
