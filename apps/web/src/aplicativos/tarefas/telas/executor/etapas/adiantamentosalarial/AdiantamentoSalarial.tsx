// A etapa Adiantamento salarial (Vitor, 16/10/2026): a linha do razão (como a da folha: o importar; importado, o check que
// vira × e tira), a grade dos meses — o descontado na folha, o pagamento e o dia dele, o dia certo (15 ou o útil antes), o
// saldo (tem de zerar) e o que falta — e, faltando pagamento, as duas contas e o .xls de importação do Alterdata, na linha.
import { Icone } from '@nads/ui';
import { useId } from 'react';
import { useAdiantamentoSalarial } from './useAdiantamentoSalarial';

export function AdiantamentoSalarial() {
  const vm = useAdiantamentoSalarial();
  const id = useId();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Adiantamento salarial</h2></div></header>
      <div className="imp-lista">
        <div className={'imp-bloco' + (vm.ok ? ' imp-ok' : '')}>
          <div className="imp-linha">
            <span className="imp-ico"><Icone nome="dinheiro" /></span>
            <div className="imp-txt">
              <span><b>Adiantamento salarial</b>{vm.arquivo && <span className="imp-conta">{vm.arquivo}</span>}</span>
            </div>
            <div className="imp-resumo">{vm.resumo.length > 0 && <div>{vm.resumo.map(x => <span key={x}>{x}</span>)}</div>}</div>
            <div className="imp-grupos">
              {/* faltando pagamento: as duas contas digitadas e o .xls do Alterdata (o desenho dos pagamentos do Pró-labore) */}
              {vm.qtd > 0 && (
                <div className="imp-grupo" aria-label="Os pagamentos que faltam">
                  <input type="text" inputMode="numeric" placeholder="Adiantamento" aria-label="Conta do adiantamento (débito)" title="O código da conta do Adiantamento salarial (débito)"
                    value={vm.contaAdiantamento} onChange={e => vm.digitarContaAdiantamento(e.target.value)} style={{ width: 104 }} />
                  <input type="text" inputMode="numeric" placeholder="Banco" aria-label="Conta do banco (crédito)" title="O código da conta do banco que pagou (crédito)"
                    value={vm.contaBanco} onChange={e => vm.digitarContaBanco(e.target.value)} style={{ width: 96 }} />
                  <button type="button" className="icon-btn icon-btn-sm" disabled={!vm.podeExportar} onClick={vm.baixarXls}
                    title={vm.podeExportar ? 'Importar no meu Sistema: o .xls do Alterdata com ' + (vm.qtd === 1 ? 'o pagamento que falta' : 'os ' + vm.qtd + ' pagamentos que faltam') : 'Informe as duas contas'}
                    aria-label="Importar no meu Sistema"><Icone nome="download" /></button>
                </div>
              )}
              <div className="imp-grupo" aria-label="Razão do Adiantamento salarial">
                <span className="imp-rotulo">Razão</span>
                {vm.temRazao ? (
                  <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.remover} title="O razão do Adiantamento salarial: importado. Clique para excluir." aria-label="Excluir o razão do Adiantamento salarial">
                    <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                  </button>
                ) : (
                  <>
                    <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title="Importar o razão do Adiantamento salarial (XLS da conciliação do Alterdata)" aria-label="Importar o razão do Adiantamento salarial"><Icone nome="upload" /></label>
                    <input id={id} type="file" accept=".xls,.xlsx,.ods" className="sr-only"
                      onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void vm.importar(f); }} />
                  </>
                )}
              </div>
            </div>
          </div>
          {vm.temRazao && vm.meses.length > 0 && (
            <div className="table-wrap" style={{ margin: '0 16px 16px' }}>
              <table className="table-compact">
                <thead><tr><th />{vm.meses.map(m => <th key={m.mes} className="num">{m.rotulo}</th>)}</tr></thead>
                <tbody>
                  <tr><th scope="row">Desconto na folha</th>{vm.meses.map(m => <td key={m.mes} className="num">{m.provisao}</td>)}</tr>
                  <tr><th scope="row">Pagamento</th>{vm.meses.map(m => <td key={m.mes} className="num" title={m.diaDoPagamento ? 'Pago em ' + m.diaDoPagamento : undefined}>{m.pagamento || '—'}</td>)}</tr>
                  <tr><th scope="row">Pago em</th>{vm.meses.map(m => <td key={m.mes} className={'num' + (m.foraDoDia ? ' ext-neg' : '')} title={m.foraDoDia ? 'Fora do dia certo (' + m.dataEsperada + ')' : undefined}>{m.diaDoPagamento || '—'}</td>)}</tr>
                  <tr><th scope="row">Dia certo</th>{vm.meses.map(m => <td key={m.mes} className="num hint">{m.dataEsperada}</td>)}</tr>
                  <tr><th scope="row">Saldo</th>{vm.meses.map(m => <td key={m.mes} className={'num' + (m.zerou ? '' : ' ext-neg')}>{m.saldo}</td>)}</tr>
                  <tr><th scope="row">Falta pagar</th>{vm.meses.map(m => <td key={m.mes} className={'num' + (m.falta ? ' ext-neg' : '')}>{m.falta || '—'}</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
