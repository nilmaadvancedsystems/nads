// Uma guia já paga em linha na Área do Cliente (Vitor, 17/10/2026), na mesma grade da LinhaDeGuia: a logo do órgão (ou o
// ✓), o nome e o "Pago em", o selo Pago, o valor mais discreto e o comprovante como ícone. Peça do catálogo (Listas).
import { formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import type { GuiaPaga } from '../dados/areaCliente';
import { SiglaDaGuia } from './SiglaDaGuia';

export function LinhaDePaga({ paga, ocupado, onComprovante }: { paga: GuiaPaga; ocupado?: boolean; onComprovante: (id: string) => void }) {
  return (
    <li className="cli-linha cli-linha-guia cli-paga">
      <span className="cli-g-logo">
        {paga.tipo ? <SiglaDaGuia tipo={paga.tipo} tamanho={40} /> : <span className="cli-sigla pago" style={{ width: 40, height: 40 }} aria-hidden="true"><Icone nome="check" width={18} height={18} /></span>}
      </span>
      <div className="cli-g-txt">
        <b>{paga.nome}</b>
        <p className="hint">Pago em {paga.pagoEm}</p>
      </div>
      <span className="cli-g-selo"><span className="badge badge-ok">Pago</span></span>
      <span className="cli-g-valor cli-valor">{formatos.reais(paga.valor)}</span>
      <span className="cli-g-acoes">
        {paga.temComprovante && (
          <button type="button" className="icon-btn" disabled={ocupado} title="Baixar o comprovante" aria-label={'Baixar o comprovante de ' + paga.nome} onClick={() => onComprovante(paga.id)}>
            <Icone nome="fileDown" width={16} height={16} />
          </button>
        )}
      </span>
    </li>
  );
}
