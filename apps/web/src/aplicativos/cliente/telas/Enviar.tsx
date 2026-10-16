// A aba Enviar da Área do Cliente (Vitor, 16/10/2026): o cliente escolhe o que está mandando (extrato, nota, comprovante),
// solta os arquivos e vê o recibo de tudo o que o escritório já recebeu.
import { formatos } from '@nads/core';
import { AreaDeSoltar } from '../partes/AreaDeSoltar';
import { useEnviar } from './useEnviar';
import type { DaCasca } from './useAreaCliente';

export function Enviar(props: DaCasca) {
  const vm = useEnviar(props);
  return (
    <>
      <section className="card">
        <h3>Enviar documentos ao escritório</h3>
        <div className="field">
          <label>O que você está mandando?</label>
          <div className="chip-row" role="radiogroup" aria-label="Tipo do documento" style={{ margin: 0 }}>
            {vm.tipos.map(t => (
              <button key={t.valor} type="button" role="radio" aria-checked={vm.tipo === t.valor} className={'chip-f' + (vm.tipo === t.valor ? ' on' : '')}
                onClick={() => vm.mudarTipo(t.valor)}>{t.rotulo}</button>
            ))}
          </div>
        </div>
        <AreaDeSoltar aceitar={vm.aceitar} desabilitada={vm.enviando} dica="PDF, JPG, PNG, XML ou ZIP · até 15 MB cada" onArquivos={vm.enviar} />
        {vm.erros.length > 0 && (
          <ul className="cli-erros" role="alert">{vm.erros.map(e => <li key={e} className="hint ext-neg">{e}</li>)}</ul>
        )}
      </section>

      <section className="card">
        <h3>Recibos dos arquivos enviados</h3>
        {vm.recibos.length ? (
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Arquivo</th><th>Tipo</th><th className="num">Tamanho</th><th>Recebido em</th></tr></thead>
              <tbody>
                {vm.recibos.map(r => (
                  <tr key={r.id}>
                    <td className="wrap">{r.nome}</td>
                    <td className="wrap">{vm.rotuloDoTipo(r.tipo)}</td>
                    <td className="num">{vm.legivel(r.tamanho)}</td>
                    <td>{formatos.dataHora(r.recebidoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="hint">Você ainda não enviou nenhum arquivo.</p>}
      </section>
    </>
  );
}
