// A aba Enviar da Área do Cliente (Vitor, 16/10/2026): o cliente escolhe o que está mandando (extrato, nota, comprovante),
// solta os arquivos e vê o recibo de tudo o que o escritório já recebeu.
import { formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { AreaDeSoltar } from '../partes/AreaDeSoltar';
import { useEnviar } from './useEnviar';
import type { DaCasca } from './useAreaCliente';

export function Enviar(props: DaCasca) {
  const vm = useEnviar(props);
  return (
    <div className="cli-duas metade">
      <section className="cli-cartao">
        <div className="cli-cartao-topo"><div><h2><Icone nome="aviao" width={18} height={18} />Enviar documentos ao escritório</h2><p>Escolha o tipo e solte os arquivos</p></div></div>
        <div className="cli-campo">
          <span className="cli-rotulo">O que você está mandando?</span>
          <div className="cli-chips" role="radiogroup" aria-label="Tipo do documento">
            {vm.tipos.map(t => (
              <button key={t.valor} type="button" role="radio" aria-checked={vm.tipo === t.valor} className={'cli-chip' + (vm.tipo === t.valor ? ' on' : '')}
                onClick={() => vm.mudarTipo(t.valor)}>{t.rotulo}</button>
            ))}
          </div>
        </div>
        <AreaDeSoltar aceitar={vm.aceitar} desabilitada={vm.enviando} dica="PDF, JPG, PNG, XML ou ZIP · até 15 MB cada" onArquivos={vm.enviar} />
        {vm.erros.length > 0 && (
          <ul className="cli-erros" role="alert">{vm.erros.map(e => <li key={e} className="cli-erro">{e}</li>)}</ul>
        )}
      </section>

      <section className="cli-cartao">
        <div className="cli-cartao-topo"><div><h2><Icone nome="checkCircle" width={18} height={18} />Recibos dos arquivos enviados</h2><p>Tudo o que o escritório já recebeu</p></div></div>
        {vm.recibos.length ? (
          <ul className="cli-lista" style={{ gap: 0 }}>
            {vm.recibos.map(r => (
              <li key={r.id} className="cli-recibo">
                <span className="cli-recibo-ico" aria-hidden="true"><Icone nome="arquivo" width={18} height={18} /></span>
                <span className="cli-recibo-txt">
                  <b>{r.nome}</b>
                  <span className="cli-meta">
                    <span>{vm.rotuloDoTipo(r.tipo)}</span><span className="cli-sep" aria-hidden="true">•</span>
                    <span className="num">{vm.legivel(r.tamanho)}</span><span className="cli-sep" aria-hidden="true">•</span>
                    <span>Recebido em {formatos.dataHora(r.recebidoEm)}</span>
                  </span>
                </span>
                <span className="cli-selo cli-selo-ok">Recebido</span>
              </li>
            ))}
          </ul>
        ) : <p className="cli-recado">Você ainda não enviou nenhum arquivo.</p>}
      </section>
    </div>
  );
}
