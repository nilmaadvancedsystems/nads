// Financeiro › Equipe › Por cliente (Vitor, 19/11/2026): os clientes do mês, cada um com os serviços (o valor completo) e os
// insumos; o clique abre as transações dele.
import { carteira, formatos } from '@nads/core';
import { Icone, useCarregando, Vazio } from '@nads/ui';
import { Fragment } from 'react';
import { SeletorDoMes } from './comum';
import { usePorCliente } from './usePorCliente';

const dataCurta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

export function PorCliente() {
  const vm = usePorCliente();
  useCarregando(!vm.carregada);
  const t = vm.totais;
  return (
    <section className="dp-painel por-cliente">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...vm.m} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      <div className="stat-grid dp-numeros">
        <div className="stat painel-numero painel-neutro"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="predio" /></span><p className="stat-label">Clientes no mês</p><p className="stat-value num">{t.clientes}</p></div>
        <div className="stat painel-numero painel-neutro"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="checklist" /></span><p className="stat-label">Serviços</p><p className="stat-value num">{formatos.reais(t.servicos)}</p></div>
        <div className="stat painel-numero painel-neutro"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="impressora" /></span><p className="stat-label">Insumos</p><p className="stat-value num">{formatos.reais(t.insumos)}</p></div>
      </div>
      <section className="card dp-lista">
        {vm.carregada && !vm.lista.length ? (
          <Vazio icone="predio" titulo={vm.busca ? 'Nenhum cliente com essa busca' : 'Nada em ' + carteira.mesPorExtenso(vm.m.mes)} texto="Os serviços registrados nas comissões e os insumos do mês aparecem aqui, juntos por cliente." />
        ) : (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Cliente</th><th className="num">Serviços</th><th className="num">Insumos</th><th className="num">Total</th></tr></thead>
              <tbody>
                {vm.lista.map(c => {
                  const aberto = vm.aberto === c.chave;
                  return (
                    <Fragment key={c.chave}>
                      <tr className={'linha-abre' + (aberto ? ' por-cliente-aberto' : '')} tabIndex={0} aria-expanded={aberto} title={aberto ? 'Fechar' : 'Ver as transações'}
                        onClick={() => vm.alternar(c.chave)} onKeyDown={e => { if (e.key === 'Enter') vm.alternar(c.chave); }}>
                        <td>
                          <Icone nome={aberto ? 'chevronDown' : 'chevronRight'} width={14} height={14} />{' '}
                          {c.codigo != null && <span className="num fraco">{c.codigo} · </span>}
                          <span className="ini-empresa">{c.nome}</span>
                          {c.codigo == null && <span className="fraco"> · avulso</span>}
                        </td>
                        <td className="num">{c.servicos.length ? <>{formatos.reais(c.totalServicos)} <span className="fraco">({c.servicos.length})</span></> : '—'}</td>
                        <td className="num">{c.insumos.length ? <>{formatos.reais(c.totalInsumos)} <span className="fraco">({c.insumos.length})</span></> : '—'}</td>
                        <td className="num"><b>{formatos.reais(c.totalServicos + c.totalInsumos)}</b></td>
                      </tr>
                      {aberto && (
                        <tr className="por-cliente-detalhe">
                          <td colSpan={4}>
                            <ul className="por-cliente-transacoes">
                              {c.servicos.map(s => (
                                <li key={'s' + s.id}>
                                  <span className="num fraco">{dataCurta(s.data)}</span>
                                  <span><Icone nome="checklist" width={14} height={14} /> {s.servico}</span>
                                  <span className="fraco">{s.pessoa}</span>
                                  <b className="num">{s.valor ? formatos.reais(s.valor) : '—'}</b>
                                </li>
                              ))}
                              {c.insumos.map(x => (
                                <li key={'i' + x.id}>
                                  <span className="num fraco">{dataCurta(x.data)}</span>
                                  <span><Icone nome="impressora" width={14} height={14} /> {x.insumo} × {x.quantidade.toLocaleString('pt-BR')}</span>
                                  <span className="fraco">{x.pessoa}</span>
                                  <b className="num">{x.valor ? formatos.reais(x.valor) : '—'}</b>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
