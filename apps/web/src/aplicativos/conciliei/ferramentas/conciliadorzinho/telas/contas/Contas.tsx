// Etapa Contas contábeis (conciliadorZINHO.html #step-3 ~L610).
import { Segmentado } from '@nads/ui';
import { useContas } from './useContas';

export function Contas() {
  const vm = useContas();
  return (
    <section>
      <div className="card">
        <p className="page-desc" style={{ marginTop: 0 }}>As contas padrão dos lançamentos.</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="fRevenda">Conta de vendas</label>
            <input type="text" id="fRevenda" inputMode="numeric" placeholder="ex: 31201" autoComplete="off" value={vm.vendas} onChange={e => vm.setVendas(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fTaxa">Conta de taxas</label>
            <input type="text" id="fTaxa" inputMode="numeric" placeholder="ex: 41850" autoComplete="off" value={vm.taxas} onChange={e => vm.setTaxas(e.target.value)} />
          </div>
          <div className="field">
            <label id="caixaLabel">O caixa é 10101?</label>
            <Segmentado<'sim' | 'nao' | ''> valor={vm.caixaPadrao === null ? '' : vm.caixaPadrao ? 'sim' : 'nao'}
              opcoes={[{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]} onMudar={v => vm.setCaixaPadrao(v === 'sim')} />
          </div>
          {vm.caixaPadrao === false && (
            <div className="field">
              <label htmlFor="fCaixa">Conta do caixa</label>
              <input type="text" id="fCaixa" inputMode="numeric" placeholder="ex: 10102" autoComplete="off" value={vm.caixa} onChange={e => vm.setCaixa(e.target.value)} />
            </div>
          )}
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn-ghost" type="button" onClick={vm.voltar}>← Voltar</button>
        <button className="btn btn-success" type="button" disabled={!vm.valido} onClick={vm.concluir}>Concluir conciliação</button>
      </div>
    </section>
  );
}
