// Etapa 3 do Creditor: o passo a passo no Fiscal (baixar os clientes no Gerenciador de Duplicatas,
// exportar para o Contábil e exportar a planilha), com os títulos que precisam de baixa.
import { creditor as cr } from '@nads/core';
import { Icone } from '@nads/ui';
import { useFiscal } from './useFiscal';

export function Fiscal() {
  const vm = useFiscal();
  return (
    <section>
      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="checklist" /></span>Passo a passo · {vm.empresa}</h3>
        <p className="hint" style={{ marginTop: 0 }}>Faça cada passo no sistema e marque aqui. A próxima etapa abre com os três marcados.</p>
        <ol className="passos">
          {vm.passos.map(p => (
            <li key={p.id}>
              <label className={'passo' + (p.feito ? ' feito' : '')}>
                <input type="checkbox" checked={p.feito} onChange={e => vm.marcar(p.id, e.target.checked)} />
                <span className="passo-n">{p.feito ? <Icone nome="check" width={12} height={12} /> : p.n}</span>
                <span>
                  <span className="passo-titulo">{p.titulo}</span>
                  <span className="passo-texto">{p.texto}</span>
                </span>
              </label>
            </li>
          ))}
        </ol>
      </div>

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
        <button className="btn btn-primary" type="button" disabled={!vm.podeContinuar} onClick={vm.continuar}>
          {vm.podeContinuar ? 'Continuar para o sistema' : 'Faltam ' + vm.faltam + ' passo(s)'}
        </button>
      </div>
    </section>
  );
}
