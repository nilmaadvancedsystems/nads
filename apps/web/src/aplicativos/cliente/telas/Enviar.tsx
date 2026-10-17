// O enviar ao escritório da Área do Cliente (Vitor, 16/10/2026; dentro de Documentos): soltar ou escolher o arquivo, dizer o
// que é e Enviar (até 700 KB cada); embaixo, os últimos que o escritório recebeu.
import { AreaDeSoltar } from '../partes/AreaDeSoltar';
import { useEnviar } from './useEnviar';
import type { DaCasca } from './useAreaCliente';

export function Enviar(props: DaCasca) {
  const vm = useEnviar(props);
  return (
    <>
      <AreaDeSoltar aceitar={vm.aceitar} desabilitada={vm.enviando} dica={'PDF, JPG, PNG, XML ou ZIP, até ' + vm.limite + ' cada'} onArquivos={vm.escolher} />
      {vm.erros.length > 0 && <ul className="cli-erros" role="alert">{vm.erros.map(e => <li key={e} className="cli-erro">{e}</li>)}</ul>}
      {vm.arquivos.length > 0 && (
        <ul style={{ marginTop: 8 }}>
          {vm.arquivos.map(a => (
            <li key={a.name} className="cli-linha">
              <div className="cli-linha-txt">{a.name} <span className="hint">{vm.legivel(a.size)}</span></div>
              <button type="button" className="btn btn-ghost" onClick={() => vm.tirar(a.name)}>Tirar</button>
            </li>
          ))}
        </ul>
      )}
      <div className="chip-row" role="radiogroup" aria-label="O que é" style={{ margin: '16px 0 0' }}>
        {vm.tipos.map(t => (
          <button key={t.valor} type="button" role="radio" aria-checked={vm.tipo === t.valor} className={'chip-f' + (vm.tipo === t.valor ? ' on' : '')} onClick={() => vm.mudarTipo(t.valor)}>{t.rotulo}</button>
        ))}
      </div>
      <div className="cli-acao">
        <button type="button" className="btn btn-primary" disabled={vm.enviando || !vm.arquivos.length} onClick={() => void vm.enviar()}>{vm.enviando ? 'Enviando…' : 'Enviar'}</button>
      </div>

      {vm.recibos.length > 0 && (
        <>
          <p className="cli-subsecao">O escritório já recebeu</p>
          <ul>
            {vm.recibos.map(r => (
              <li key={r.id} className="cli-linha">
                <div className="cli-linha-txt">{r.nome}</div>
                <span className="hint" style={{ margin: 0 }}>{vm.rotuloDoTipo(r.tipo)}, {vm.dataHora(r.recebidoEm)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
