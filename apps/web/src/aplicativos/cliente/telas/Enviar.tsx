// O enviar documentos da Área do Cliente (Vitor, 16/10/2026; dentro da aba Documentos): o cliente escolhe o que está
// mandando (extrato, nota, comprovante), solta os arquivos e vê o recibo de tudo o que o escritório já recebeu.
import { formatos } from '@nads/core';
import { AreaDeSoltar } from '../partes/AreaDeSoltar';
import { useEnviar } from './useEnviar';
import type { DaCasca } from './useAreaCliente';

export function Enviar(props: DaCasca) {
  const vm = useEnviar(props);
  return (
    <div className="cli-duas metade">
      <section className="card">
        <div className="card-head"><h3>Enviar ao escritório</h3></div>
        <div className="field">
          <label>O que você está mandando?</label>
          <div className="chip-row" role="radiogroup" aria-label="Tipo do documento" style={{ margin: 0 }}>
            {vm.tipos.map(t => (
              <button key={t.valor} type="button" role="radio" aria-checked={vm.tipo === t.valor} className={'chip-f' + (vm.tipo === t.valor ? ' on' : '')}
                onClick={() => vm.mudarTipo(t.valor)}>{t.rotulo}</button>
            ))}
          </div>
        </div>
        <AreaDeSoltar aceitar={vm.aceitar} desabilitada={vm.enviando} dica={'PDF, JPG, PNG, XML ou ZIP · até ' + vm.limite + ' cada'} onArquivos={vm.enviar} />
        {vm.erros.length > 0 && (
          <ul className="cli-erros" role="alert">{vm.erros.map(e => <li key={e} className="cli-erro">{e}</li>)}</ul>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h3>Recebidos pelo escritório</h3></div>
        {vm.recibos.length ? (
          <ul>
            {vm.recibos.map(r => (
              <li key={r.id} className="cli-linha">
                <div className="cli-linha-txt">
                  <b>{r.nome}</b>
                  <p className="hint">{vm.rotuloDoTipo(r.tipo)} · {vm.legivel(r.tamanho)} · {formatos.dataHora(r.recebidoEm)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="empty">Você ainda não enviou nenhum arquivo.</p>}
      </section>
    </div>
  );
}
