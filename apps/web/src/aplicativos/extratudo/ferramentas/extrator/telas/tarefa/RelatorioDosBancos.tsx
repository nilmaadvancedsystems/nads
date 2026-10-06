// O relatório dos bancos (a etapa Bancos da Tarefa): só olhar. Em cima, o período e quantos bancos; cada banco na linha
// da Importação (o logo, o saldo inicial e o final no meio) e, embaixo, os dois gráficos do catálogo: as colunas de
// entradas × saídas por mês e o ranking do que passou pelo banco.
import { Alerta, Icone, LogoBanco } from '@nads/ui';
import { useRelatorioDosBancos } from './useRelatorioDosBancos';

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
        {vm.bancos.map(b => (
          <div key={b.id} className="imp-bloco">
            <div className="imp-linha">
              <span className="imp-ico imp-logo"><LogoBanco banco={b.marca} cor={b.temExtrato} /></span>
              <div className="imp-txt"><span><b>{b.nome}</b>{b.conta && <span className="imp-conta">{b.conta}</span>}</span></div>
              <div className="imp-resumo">{b.temExtrato && <div>{b.resumo.map(t => <span key={t}>{t}</span>)}</div>}</div>
            </div>
            {b.temExtrato ? (
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
                      <div key={c.id} className="rank-item">
                        <span className="rank-nome">{c.rotulo}</span>
                        <span className="rank-val">{c.valor}</span>
                        <span className="rank-barra"><span style={{ width: c.largura + '%', background: c.entrada ? 'var(--danger)' : 'var(--success)' }} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : <p className="hint" style={{ padding: '0 12px 12px' }}>Sem extrato deste banco no período (importe na Importação).</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
