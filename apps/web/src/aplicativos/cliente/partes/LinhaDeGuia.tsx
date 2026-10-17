// Uma guia em linha (Visão geral da Área do Cliente, Vitor 16/10/2026; as "Obrigações e guias próximas" do protótipo): o
// nome e a competência, o vencimento, o valor, o selo quando vencida ou vence hoje, copiar a linha digitável (quando tem) e
// baixar. Peça do catálogo (Listas).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SELO_DA_SITUACAO } from './guia';

export function LinhaDeGuia({ guia, codigo, ocupado, onBaixar, onCopiar }: { guia: ac.GuiaDoCliente; codigo?: string; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void }) {
  const selo = SELO_DA_SITUACAO[guia.situacao];
  return (
    <li className="cli-linha">
      <div className="cli-linha-txt">
        <b>{ac.ROTULO_DA_GUIA[guia.tipo]}</b> {selo && <span className={selo}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span>}
        <p className="hint">Vence em {guia.vencimento} · referente a {formatos.rot(guia.competencia)}</p>
      </div>
      <div className="cli-linha-dir">
        <span className="num">{formatos.reais(guia.valor)}</span>
        {codigo && onCopiar && (
          <button type="button" className="icon-btn" title="Copiar a linha digitável" aria-label="Copiar a linha digitável" onClick={() => onCopiar(codigo)}>
            <Icone nome="copiar" width={16} height={16} />
          </button>
        )}
        <button type="button" className="icon-btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)}
          title={guia.temPdf ? 'Baixar a guia' : 'O arquivo ainda não está aqui'} aria-label={'Baixar a guia ' + ac.ROTULO_DA_GUIA[guia.tipo]}>
          <Icone nome="download" width={16} height={16} />
        </button>
      </div>
    </li>
  );
}
