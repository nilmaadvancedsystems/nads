// O envio de documentos da Área do Cliente (Vitor, 16/10/2026; abre na janela "Enviar documento" da Central de
// documentos): o tipo (extrato, nota, comprovante, outro), soltar ou escolher os arquivos (até 700 KB cada; vão na hora) e
// o que já foi enviado nesta visita.
import { Icone, type NomeIcone } from '@nads/ui';
import { AreaDeSoltar } from '../partes/AreaDeSoltar';
import { useEnviar } from './useEnviar';
import type { DaCasca } from './useAreaCliente';

const ICONE_DO_TIPO: Record<string, NomeIcone> = { extrato: 'landmark', nota: 'recibo', comprovante: 'check', outro: 'arquivo' };

export function Enviar(props: DaCasca) {
  const vm = useEnviar(props);
  return (
    <>
      {/* o tipo em cartões 2×2 com o ícone (12/11/2026: os chips quebravam em duas linhas tortas) */}
      <div className="cli-envio-tipos" role="radiogroup" aria-label="O que é">
        {vm.tipos.map(t => (
          <button key={t.valor} type="button" role="radio" aria-checked={vm.tipo === t.valor} className={'cli-envio-tipo' + (vm.tipo === t.valor ? ' on' : '')} onClick={() => vm.mudarTipo(t.valor)}>
            <Icone nome={ICONE_DO_TIPO[t.valor] ?? 'arquivo'} width={16} height={16} />{t.rotulo}
          </button>
        ))}
      </div>
      <AreaDeSoltar aceitar={vm.aceitar} desabilitada={vm.enviando} dica={'PDF, JPG, PNG, XML ou ZIP, até ' + vm.limite + ' cada'} onArquivos={arqs => void vm.enviar(arqs)} />
      {vm.erros.length > 0 && <ul className="cli-erros" role="alert">{vm.erros.map(e => <li key={e} className="cli-erro">{e}</li>)}</ul>}
      {vm.enviados.length > 0 && <p className="hint" style={{ marginTop: 12 }}>Enviados agora: {vm.enviados.join(', ')}.</p>}
    </>
  );
}
