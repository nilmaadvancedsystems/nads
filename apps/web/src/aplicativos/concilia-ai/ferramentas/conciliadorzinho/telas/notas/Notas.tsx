// Etapa Notas fiscais (conciliadorZINHO.html #step-2 ~L592).
import { Alerta, CampoArquivo, Icone } from '@nads/ui';
import { useNotas } from './useNotas';

export function Notas() {
  const vm = useNotas();
  const escolhido = vm.arquivoNome ? new File([], vm.arquivoNome) : null;
  return (
    <section>
      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="fileText" /></span>Planilha de vendas</h3>
        <div className="import-box-row">
          <CampoArquivo id="fVendas" arquivo={escolhido} aceitar={vm.aceitar} onEscolher={f => { void vm.escolher(f); }} />
          {vm.lendo ? <span className="hint">Lendo arquivo…</span> : vm.info && <span className="hint">{vm.info}</span>}
        </div>
        <p className="hint">A planilha de vendas do mesmo período · .xls ou .xlsx · coluna C = Data, G = Valor Bruto, I = Histórico.</p>
      </div>

      {vm.aviso && (
        <Alerta titulo={vm.aviso.titulo} texto={vm.aviso.texto} onFechar={vm.fecharAviso}>
          {vm.aviso.outroArquivo && (
            <div style={{ marginTop: 8 }}>
              <label className="btn btn-outline" htmlFor="fVendas">Escolher outro arquivo</label>
            </div>
          )}
        </Alerta>
      )}

      <div className="btn-row">
        <button className="btn btn-ghost" type="button" onClick={vm.voltar}>← Voltar</button>
        {vm.podeContinuar && <button className="btn btn-primary" type="button" onClick={vm.continuar}>Continuar</button>}
      </div>
    </section>
  );
}
