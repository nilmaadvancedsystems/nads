// Etapa do Creditor no Fiscal: os títulos que precisam de baixa (o passo a passo para marcar saiu; Vitor, 05/10/2026).
import { creditor as cr } from '@nads/core';
import { useFiscal } from './useFiscal';

export function Fiscal() {
  const vm = useFiscal();
  return (
    <section>
      <div className="card">
        <div className="card-head">
          <h3>Títulos para baixar</h3>
          <span className="hint">{vm.total.qtd} título(s) · <span className="num">{cr.brl(vm.total.cobrado)}</span></span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>NF</th><th>Sacado</th><th>Liquidação</th><th className="num">Valor</th><th className="num">Mora/acrésc.</th><th className="num">Desconto</th><th className="num">Cobrado</th></tr></thead>
            <tbody>
              {vm.titulos.map(t => (
                <tr key={t.id}>
                  <td>{t.nf}</td><td>{t.sacado}</td><td>{t.liquidacao || 'sem data'}</td>
                  <td className="num">{cr.brl(t.valor)}</td>
                  <td className="num">{t.acrescimos ? cr.brl(t.acrescimos) : '—'}</td>
                  <td className="num">{t.desconto ? cr.brl(t.desconto) : '—'}</td>
                  <td className="num"><b>{cr.brl(t.cobrado)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-ghost" type="button" onClick={vm.voltar}>← Voltar</button>
        <button className="btn btn-primary" type="button" onClick={vm.continuar}>Continuar para as contas</button>
      </div>
    </section>
  );
}
