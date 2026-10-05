// Etapa Relatório de Recebimento do Creditor: a conta de cada título (aprendida ou do balancete) e, sem conta, a decisão.
import { creditor as cr } from '@nads/core';
import { Alerta, MenuSuspenso } from '@nads/ui';
import { Fragment } from 'react';
import { Celula } from './partes/Celula';
import { MenuDeConta } from '../../partes/MenuDeConta';
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
      <div className="card">
        <div className="card-head">
          <h3>Títulos</h3>
          {/* Todos / Pendentes no menu suspenso padrão; sem pendência, o Pendentes fica apagado */}
          <MenuSuspenso rotulo={vm.filtro === 'pendentes' ? 'Pendentes' : 'Todos'} className="btn btn-outline" direita dica="Filtrar os títulos"
            itens={([['todos', 'Todos'], ['pendentes', 'Pendentes' + (vm.resumo.decidir ? ' (' + vm.resumo.decidir + ')' : '')]] as [Filtro, string][]).map(([v, r]) => ({
              rotulo: r, marcado: vm.filtro === v, desabilitado: v === 'pendentes' && !vm.resumo.decidir, onClick: () => vm.setFiltro(v),
            }))} />
        </div>
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table>
            <thead>
              {/* uma coluna só para o cliente: o nome no balancete (sem conta ainda, o nome do banco, apagado); Contrapartida virou Conta (Vitor, 05/10/2026) */}
              <tr><th>NF</th><th>Liquidação</th><th>Nome no balancete</th><th className="num">Valor</th><th>Conta</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {vm.linhas.map(l => (
                <Fragment key={l.id}>
                  <tr className={l.decisao?.tipo === 'excluir' ? 'linha-excluida' : l.precisa && !l.resolvida ? 'bad' : ''}>
                    <td>{l.nf}</td>
                    <td>{l.liquidacao}</td>
                    <td>{l.nomeDaConta || <span className="hint" title="O nome do banco: ainda sem conta no balancete">{l.sacado}</span>}</td>
                    <td className="num">{cr.reais(l.valorBanco)}</td>
                    <td>{l.contrapartida || '—'}</td>
                    <td><span className={BADGE[l.situacao]}>{l.rotulo}</span></td>
                  </tr>
                  {(l.nota || l.precisa) && (
                    <tr className="linha-nota">
                      <td colSpan={6}>
                        {l.nota && <span className="hint" style={{ marginRight: 12 }}>{l.nota}</span>}
                        {l.precisa && (l.decisao?.tipo === 'excluir' ? (
                          <span className="decisao">
                            <b>Fica fora do arquivo.</b>
                            <button className="btn" type="button" onClick={() => vm.desfazer(l.id)}>Desfazer</button>
                          </span>
                        ) : (
                          <span className="decisao">
                            {l.opcoes.map(o => (
                              <button key={o.codigo} type="button" title={o.nome}
                                className={'btn ' + (l.decisao?.tipo === 'manual' && l.decisao.contrapartida === o.codigo ? 'btn-primary' : 'btn-outline')}
                                onClick={() => vm.manual(l.id, 'contrapartida', o.codigo)}>
                                {o.codigo}
                              </button>
                            ))}
                            <MenuDeConta valor={l.decisao?.tipo === 'manual' ? l.decisao.contrapartida : ''} contas={vm.contasClientes} onEscolher={v => vm.manual(l.id, 'contrapartida', v)} />
                            <Celula valor={l.decisao?.tipo === 'manual' ? l.decisao.historico : ''} largura={260} rotulo="Histórico" placeholder={l.historicoPadrao} onGravar={v => vm.manual(l.id, 'historico', v)} />
                            <button className="btn" type="button" onClick={() => vm.excluir(l.id)}>Excluir título</button>
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

    </section>
  );
}
