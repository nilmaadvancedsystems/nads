// A aba Guias e obrigações da Área do Cliente (Vitor, 16/10/2026, do protótipo): as guias para pagar por mês de referência
// (baixar e copiar a linha digitável), a agenda do mês ao lado das guias já pagas (com o comprovante) e do certificado
// digital.
import { formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { CartaoDeGuia } from '../partes/CartaoDeGuia';
import { Agenda } from './Agenda';
import { useGuias } from './useGuias';
import type { DaCasca } from './useAreaCliente';

export function Guias(props: DaCasca) {
  const vm = useGuias(props);
  return (
    <>
      {vm.vazio ? (
        <section className="card"><p className="empty">Nenhuma guia por enquanto. Quando o escritório gerar, ela aparece aqui.</p></section>
      ) : vm.meses.map(m => (
        <section key={m.competencia}>
          <h2 className="cli-secao">Referente a {formatos.rot(m.competencia)}</h2>
          <div className="cli-grade">
            {m.guias.map(g => <CartaoDeGuia key={g.id} guia={g} codigo={vm.codigos[g.id]} ocupado={vm.baixando === g.id} onBaixar={vm.baixar} onCopiar={c => vm.copiar(c, 'Código')} />)}
          </div>
        </section>
      ))}

      <div className="cli-duas">
        <Agenda area={props.area} hoje={props.hoje} />
        <div className="cli-coluna">
          <section className="card">
            <div className="card-head"><h3>Pagas no mês</h3></div>
            {vm.pagas.length ? (
              <ul>
                {vm.pagas.map(p => (
                  <li key={p.id} className="cli-linha">
                    <div className="cli-linha-txt"><b>{p.nome}</b><p className="hint">Pago em {p.pagoEm} · <span className="num">{formatos.reais(p.valor)}</span></p></div>
                    {p.temComprovante && (
                      <button type="button" className="icon-btn" title="Baixar o comprovante" aria-label={'Baixar o comprovante de ' + p.nome} disabled={vm.baixando === p.id} onClick={() => void vm.comprovante(p.id)}>
                        <Icone nome="download" width={16} height={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="empty">Nenhuma guia paga neste mês.</p>}
          </section>
          {vm.certificado && (
            <section className="card">
              <div className="card-head">
                <h3>Certificado digital</h3>
                {vm.certificado.tom !== 'ok' && <span className={'badge ' + (vm.certificado.tom === 'bad' ? 'badge-bad' : 'badge-warn')}>{vm.certificado.tom === 'bad' ? 'Vencido' : 'Vence logo'}</span>}
              </div>
              <dl className="cli-dados">
                <dt>Tipo</dt><dd>e-CNPJ {vm.certificado.tipo}</dd>
                <dt>Titular</dt><dd>{vm.certificado.titular}</dd>
              </dl>
              <p className="hint" style={{ marginTop: 8 }}>{vm.certificado.texto}</p>
              {vm.certificado.tom !== 'ok' && <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => vm.irPara('chamados')}>Pedir a renovação</button>}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
