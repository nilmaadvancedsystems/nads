// Etapa 5 do Creditor: o arquivo do sistema (recebimentos de clientes), a planilha exportada do Contábil
// depois da baixa no Fiscal.
import { creditor as cr } from '@nads/core';
import { Alerta, CampoArquivo, Icone } from '@nads/ui';
import { useSistema } from './useSistema';

export function Sistema() {
  const vm = useSistema();
  return (
    <section>
      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="fileText" /></span>Arquivo do sistema</h3>
        <div className="import-box-row">
          <CampoArquivo id="fSistema" arquivo={null} aceitar={vm.aceitar} onEscolher={f => { void vm.escolherArquivo(f); }} />
        </div>
        <p className="hint">A planilha exportada do Contábil depois da baixa no Fiscal: .xls, .xlsx ou .csv com as colunas Contrapartida, Valor e NF (ou um Histórico com "NF 1234"). Cliente e Histórico, quando houver.</p>
        <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
          <button className="btn btn-ghost" type="button" onClick={vm.exemplo}>Testar com o exemplo</button>
        </div>
        {vm.erro && <Alerta titulo="Não foi possível ler o arquivo do sistema" texto={vm.erro} onFechar={vm.fecharErro} />}
      </div>

      {vm.lido && (
        <div className="card">
          <div className="card-head">
            <h3>{vm.lido.qtd} recebimento(s) · {vm.lido.origem}</h3>
            {vm.lido.semValor > 0 && <span className="badge badge-warn">{vm.lido.semValor} sem valor</span>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Linha</th><th>NF</th><th>Cliente</th><th>Contrapartida</th><th>Histórico</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {vm.previa.map(l => (
                  <tr key={l.linha}><td className="num">{l.linha}</td><td>{l.nf}</td><td>{l.cliente}</td><td>{l.contrapartida}</td><td>{l.historico}</td><td className="num">{l.valor == null ? '—' : cr.brl(l.valor)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {vm.restantes > 0 && <p className="hint">… e mais {vm.restantes} linha(s).</p>}
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-ghost" type="button" onClick={vm.voltar}>← Voltar</button>
        <button className="btn btn-primary" type="button" disabled={!vm.podeContinuar} onClick={vm.continuar}>Continuar para o cruzamento</button>
      </div>
    </section>
  );
}
