// O Relatório Bancário (a etapa Bancos da Tarefa): só olhar. Em cima, o período e quantos bancos; cada banco na linha
// da Importação (o logo e, no canto direito, o saldo inicial pequeno e o final grande) e, embaixo, os dois gráficos do
// catálogo: as colunas de entradas × saídas por mês e o ranking do que passou pelo banco. Clicar numa categoria do
// ranking mostra a relação dos lançamentos dela embaixo (Vitor, 06/10/2026).
import { Alerta, Icone, LogoBanco } from '@nads/ui';
import { useState } from 'react';
import { useRelatorioDosBancos } from './useRelatorioDosBancos';

type Banco = ReturnType<typeof useRelatorioDosBancos>['bancos'][number];

export function RelatorioDosBancos() {
  const vm = useRelatorioDosBancos();
  return (
    <section>
      <div className="imp-topo">
        <span className="imp-periodo-info"><Icone nome="calendar" />{vm.periodo}</span>
        <span className="imp-topo-num"><Icone nome="landmark" /><b>{vm.bancos.length}</b> {vm.bancos.length === 1 ? 'banco' : 'bancos'}</span>
        <span className="imp-topo-meio" />
      </div>
      {vm.semSocios && <Alerta titulo="Sem sócios no Cadastro" texto="Informe os sócios em Cadastro › Empresa para a transferência para o sócio aparecer separada." />}
      <div className="imp-lista">
        {vm.bancos.map(b => <BlocoDoBanco key={b.id} b={b} />)}
      </div>
    </section>
  );
}

function BlocoDoBanco({ b }: { b: Banco }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const cat = b.categorias.find(c => c.id === aberta) || null;
  return (
    <div className="imp-bloco">
      <div className="imp-linha">
        <span className="imp-ico imp-logo"><LogoBanco banco={b.marca} cor={b.temExtrato} /></span>
        <div className="imp-txt"><span><b>{b.nome}</b>{b.conta && <span className="imp-conta">{b.conta}</span>}</span></div>
        <span className="imp-topo-meio" />
        {/* no canto direito: o saldo inicial pequeno e o final grande */}
        {b.temExtrato && (
          <div style={{ textAlign: 'right' }}>
            <p className="stat-label">Saldo inicial {b.saldoInicial}</p>
            <p className="stat-value" title="Saldo final do período">{b.saldoFinal}</p>
          </div>
        )}
      </div>
      {b.temExtrato ? (
        <>
          <div className="dash-grid" style={{ padding: '0 12px 12px' }}>
            <div className="painel">
              <div className="painel-head"><p className="painel-titulo">Entradas × saídas por mês</p></div>
              <div className="chart">
                {b.meses.map(m => (
                  <div key={m.mes} className="chart-col" title={m.titulo}>
                    <span className="chart-plot">
                      <span className="chart-bar ent" style={{ height: m.alturaEnt + 'px' }} />
                      <span className="chart-bar sai" style={{ height: m.alturaSai + 'px' }} />
                    </span>
                    <span className="chart-lbl">{m.rotulo}</span>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <span><i className="chart-dot" style={{ background: 'var(--danger)' }} />Entradas</span>
                <span><i className="chart-dot" style={{ background: 'var(--success)' }} />Saídas</span>
              </div>
            </div>
            <div className="painel">
              <div className="painel-head"><p className="painel-titulo">O que passou pelo banco</p></div>
              <div className="rank">
                {b.categorias.map(c => (
                  <button key={c.id} type="button" className="rank-item" aria-pressed={aberta === c.id}
                    title={aberta === c.id ? 'Fechar a relação' : 'Ver os lançamentos'} onClick={() => setAberta(a => (a === c.id ? null : c.id))}>
                    <span className="rank-nome">{aberta === c.id ? <b>{c.rotulo}</b> : c.rotulo}</span>
                    <span className="rank-val">{c.valor}</span>
                    <span className="rank-barra"><span style={{ width: c.largura + '%', background: c.entrada ? 'var(--danger)' : 'var(--success)' }} /></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* a relação dos lançamentos da categoria clicada (a mesma tabela do movimento da Importação) */}
          {cat && (
            <div className="imp-mov-caixa">
              <div className="imp-mov-topo">
                <span className="imp-mov-periodo"><b>{cat.rotulo}</b> · {cat.valor}</span>
              </div>
              <div className="imp-mov">
                <table className="table-compact">
                  <thead><tr><th>Data</th><th>Descrição</th><th className="num">Valor</th></tr></thead>
                  <tbody>
                    {cat.lancamentos.map((l, i) => (
                      <tr key={i}><td style={{ whiteSpace: 'nowrap' }}>{l.data}</td><td className="wrap">{l.historico}</td><td className="num">{l.valor}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : <p className="hint" style={{ padding: '0 12px 12px' }}>Sem extrato deste banco no período (importe na Importação).</p>}
    </div>
  );
}
