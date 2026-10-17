// Uma guia em linha na Área do Cliente (Vitor, 16/10/2026: "o mais simples possível", sem "cara de IA"): o nome da guia,
// o vencimento, o valor e o Baixar; o selo só quando venceu ("vence hoje" vai no texto); o copiar da linha digitável é um
// link discreto, quando tem. Peça do catálogo (Listas).
import { areaCliente as ac, formatos } from '@nads/core';

export function LinhaDeGuia({ guia, codigo, ocupado, onBaixar, onCopiar }: { guia: ac.GuiaDoCliente; codigo?: string; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void }) {
  return (
    <li className="cli-linha">
      <div className="cli-linha-txt">
        <b>{ac.ROTULO_DA_GUIA[guia.tipo]}</b>{guia.situacao === 'vencida' && <span className="badge badge-bad">Vencida</span>}
        <p className={'hint' + (guia.situacao === 'vence hoje' ? ' cli-hoje' : '')}>{guia.situacao === 'vence hoje' ? 'Vence hoje' : 'Vence em ' + guia.vencimento}</p>
      </div>
      <div className="cli-linha-dir">
        {codigo && onCopiar && <button type="button" className="btn btn-ghost" onClick={() => onCopiar(codigo)}>Copiar código</button>}
        <span className="cli-valor">{formatos.reais(guia.valor)}</span>
        <button type="button" className="btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)} title={guia.temPdf ? undefined : 'O arquivo ainda não chegou'}>
          {ocupado ? 'Baixando…' : 'Baixar'}
        </button>
      </div>
    </li>
  );
}
