// Etapa 1 do Creditor: o relatório de liquidação do banco (PDF ou planilha).
import { creditor as cr } from '@nads/core';
import { Alerta, CampoArquivo, Icone } from '@nads/ui';
import { useBanco } from './useBanco';

export function Banco() {
  const vm = useBanco();
  return (
    <section>
      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="landmark" /></span>Relatório de liquidação do banco</h3>
        <div className="import-box-row">
          <CampoArquivo id="fBanco" arquivo={null} aceitar={vm.aceitar} onEscolher={f => { void vm.escolherArquivo(f); }} />
        </div>
        <p className="hint">PDF exportado pelo banco (Sicoob: "Relatório - Títulos por Período"), .xls, .xlsx ou .csv. A leitura acontece aqui no navegador: nada sai da máquina.</p>
        <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
          <button className="btn btn-ghost" type="button" onClick={vm.exemplo}>Testar com o exemplo</button>
        </div>
        {vm.lendo && <p className="hint" style={{ marginTop: 8 }}>Lendo…</p>}
        {vm.erro && <Alerta titulo="Não foi possível ler o relatório" texto={vm.erro} onFechar={vm.fecharErro} />}
      </div>

      {vm.lido && (
        <Alerta tom="ok" titulo={'Lido: ' + vm.lido.titulos + ' título(s) em ' + vm.lido.grupos + ' grupo(s)'}>
          <p className="alert-text">
            Origem: {vm.lido.origem} · {vm.lido.dias} dia(s) de liquidação · valor somado <span className="num">{cr.brl(vm.lido.valor)}</span>
            {vm.lido.ignorados > 0 && <> · {vm.lido.ignorados} baixa(s) por pedido do cedente ficaram de fora</>}
          </p>
          {vm.lido.avisos.map((a, i) => <p key={i} className="alert-text">{a}</p>)}
        </Alerta>
      )}

      <div className="btn-row">
        <button className="btn btn-primary" type="button" disabled={!vm.podeContinuar} onClick={vm.continuar}>Continuar para a conferência</button>
      </div>
    </section>
  );
}
