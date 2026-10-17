// O envio de documentos da Área do Cliente (Vitor, 16/10/2026; abre na janela "Enviar documento" da Central de
// documentos): o tipo (extrato, nota, comprovante, outro), soltar ou escolher os arquivos (até 700 KB cada; vão na hora) e
// o que já foi enviado nesta visita.
import { AreaDeSoltar } from '../partes/AreaDeSoltar';
import { useEnviar } from './useEnviar';
import type { DaCasca } from './useAreaCliente';

export function Enviar(props: DaCasca) {
  const vm = useEnviar(props);
  return (
    <>
      <div className="chip-row" role="radiogroup" aria-label="O que é" style={{ margin: '0 0 12px' }}>
        {vm.tipos.map(t => (
          <button key={t.valor} type="button" role="radio" aria-checked={vm.tipo === t.valor} className={'chip-f' + (vm.tipo === t.valor ? ' on' : '')} onClick={() => vm.mudarTipo(t.valor)}>{t.rotulo}</button>
        ))}
      </div>
      <AreaDeSoltar aceitar={vm.aceitar} desabilitada={vm.enviando} dica={'PDF, JPG, PNG, XML ou ZIP, até ' + vm.limite + ' cada'} onArquivos={arqs => void vm.enviar(arqs)} />
      {vm.erros.length > 0 && <ul className="cli-erros" role="alert">{vm.erros.map(e => <li key={e} className="cli-erro">{e}</li>)}</ul>}
      {vm.enviados.length > 0 && <p className="hint" style={{ marginTop: 12 }}>Enviados agora: {vm.enviados.join(', ')}.</p>}
    </>
  );
}
