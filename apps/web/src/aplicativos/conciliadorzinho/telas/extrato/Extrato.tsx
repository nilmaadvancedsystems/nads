// Etapa Extrato da <bandeira> (conciliadorZINHO.html buildBrandStepSections ~L1222).
import type { conciliadorzinho as cz } from '@nads/core';
import { Alerta, CampoArquivos, Icone } from '@nads/ui';
import { useExtrato } from './useExtrato';

export function Extrato({ bandeira }: { bandeira: cz.IdBandeira }) {
  const vm = useExtrato(bandeira);
  return (
    <section>
      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="cartao" /></span>Extrato da {vm.rotulo}</h3>
        <div className="import-box-row">
          <CampoArquivos id={'fExtrato-' + bandeira} aceitar={vm.aceitar} onEscolher={fs => { void vm.adicionar(fs); }} />
        </div>
        <p className="hint">Colunas: Data, Valor Bruto e Valor da Taxa · .csv, .xls ou .xlsx · pode mandar vários arquivos.</p>

        {vm.falhas.length > 0 && (
          <Alerta titulo={vm.falhas.length === 1 ? 'Não foi possível ler um dos arquivos' : 'Não foi possível ler ' + vm.falhas.length + ' dos arquivos'} onFechar={vm.fecharFalhas}>
            {vm.falhas.map((f, i) => <p key={i} className="alert-text"><b>{f.nome}</b>: {f.motivo}</p>)}
          </Alerta>
        )}

        {vm.arquivos.length > 0 && (
          <div className="arquivo-lista">
            {vm.arquivos.map(a => (
              <div key={a.id} className="arquivo-item">
                <Icone nome="check" />
                <span className="arquivo-txt"><span className="arquivo-nome">{a.nome}</span><span className="hint">{a.info}</span></span>
                <button type="button" className="file-clear" title="Remover arquivo" aria-label="Remover arquivo" onClick={() => vm.remover(a.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        {vm.meses.length > 0 && (
          <>
            <p className="hint" style={{ marginTop: 12 }}>Competências identificadas:</p>
            <div className="chip-row" style={{ marginTop: 6 }}>
              {vm.meses.map(m => <span key={m.rotulo} className="badge badge-neutral">{m.rotulo} · <span className="num">{m.qtd} lançamentos</span></span>)}
            </div>
          </>
        )}

        <div className="field" style={{ marginTop: 16, maxWidth: 280 }}>
          <label htmlFor={'fConta-' + bandeira}>Conta contábil da {vm.rotulo}</label>
          <input type="text" id={'fConta-' + bandeira} inputMode="numeric" placeholder="ex: 21105" autoComplete="off" value={vm.conta} onChange={e => vm.setConta(e.target.value)} />
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-ghost" type="button" onClick={vm.voltar}>← Voltar</button>
        <button className="btn btn-primary" type="button" disabled={!vm.podeContinuar} onClick={() => { void vm.continuar(); }}>{vm.textoContinuar}</button>
      </div>
    </section>
  );
}
