// Ajuste de saldo negativo (cheque_especial.html, "Passo 1" + resultado ~L279-338).
import type { empresas } from '@nads/core';
import { Alerta, baixarBytes, CampoArquivo, Icone } from '@nads/ui';
import { AcoesDoTopo } from '../../../../../../comum/topo';
import { Resultado } from './partes/Resultado';
import { useAjuste } from './useAjuste';

export function Ajuste({ empresa }: { empresa: empresas.EmpresaDoEscritorio }) {
  const vm = useAjuste(empresa);
  const baixar = (f: 'xlsx' | 'xls') => { const a = vm.arquivoParaBaixar(f); if (a) baixarBytes(a.bytes, a.nome, a.tipo); };
  return (
    <section>
      <AcoesDoTopo>
        {vm.resultado && vm.resultado.res.lancamentos.length > 0 && (
          <>
            <button className="btn btn-outline" type="button" onClick={() => baixar('xls')}><Icone nome="download" />Baixar .xls (97-2003)</button>
            <button className="btn btn-primary" type="button" onClick={() => baixar('xlsx')}><Icone nome="download" />Baixar .xlsx</button>
          </>
        )}
      </AcoesDoTopo>

      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="landmark" /></span>Relatório de saldo diário</h3>
        <div className="import-box-row">
          <CampoArquivo id="fSaldo" arquivo={vm.arquivo} onEscolher={f => { void vm.escolherArquivo(f); }} aceitar={vm.aceitar} />
          {vm.infoArquivo && <span className="hint">{vm.infoArquivo}</span>}
        </div>
        <p className="hint">Colunas Data e Saldo (com C/D no final) · .csv, .xls ou .xlsx.</p>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="fBanco">Conta bancária</label>
            <input type="text" id="fBanco" inputMode="numeric" placeholder="ex: 10509" autoComplete="off" value={vm.contaBanco} onChange={e => vm.setContaBanco(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fCheque">Conta cheque especial</label>
            <input type="text" id="fCheque" inputMode="numeric" placeholder="ex: 90503" autoComplete="off" value={vm.contaCheque} onChange={e => vm.setContaCheque(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fHistorico">Código do histórico</label>
            <input type="text" id="fHistorico" inputMode="numeric" placeholder="ex: 92029" autoComplete="off" value={vm.historico} onChange={e => vm.setHistorico(e.target.value)} />
          </div>
        </div>

        {/* sem o "D = saldo positivo, C = negativo" (Vitor, 13/10/2026: o sistema já sabe ler; vale sempre o do nosso sistema) */}
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" type="button" disabled={!vm.podeGerar} onClick={vm.gerar}>Gerar lançamentos</button>
        </div>
      </div>

      {vm.aviso && <Alerta titulo={vm.aviso.titulo} texto={vm.aviso.texto} onFechar={vm.fecharAviso} />}
      {vm.resultado && <Resultado r={vm.resultado} />}
    </section>
  );
}
