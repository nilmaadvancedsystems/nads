// Contas ligadas (chips com ×) e o campo "Adicionar"/"Vincular conta" com a lista do plano.
// Origem: conferencia.html renderNaturezaDePara (~L2112-2126), servContasHtml (~L4450),
// ndpRenderAddLista/grupoTag (~L2344-2363), foco/blur/abrir (~L2364-2393).
import { Icone } from '@nads/ui';
import type { ReactNode } from 'react';
import { classeGrupo, type Vinculo } from '../useConfiguracoes';

export function ChipsDeContas({ v }: { v: Vinculo }) {
  if (!v.chips.length) return null;
  return (
    <div className="ndp-chips">
      {v.chips.map(ch => (
        <span key={ch.codigo} className="ndp-chip">
          {ch.texto}
          <button type="button" title="Desvincular" onClick={() => v.desvincular(ch.codigo)}>&times;</button>
        </span>
      ))}
    </div>
  );
}

/** .ndp-add: botão que vira campo de busca; `extra` = botão ao lado que some com o campo aberto. */
export function CampoVincular({ v, rotulo, titulo, extra }: { v: Vinculo; rotulo: string; titulo: string; extra?: (escondido: boolean) => ReactNode }) {
  return (
    <div className={'ndp-add' + (v.aberto ? ' aberto' : '')}>
      <button type="button" className="btn ndp-add-btn" title={titulo} hidden={v.aberto} onClick={v.abrir}><Icone nome="plus" />{rotulo}</button>
      {extra?.(v.aberto)}
      <div className="ndp-add-campo" hidden={!v.aberto}>
        {v.aberto && (
          <input type="text" className="ndp-add-input" placeholder="Vincular conta — nome ou código" autoComplete="off" autoFocus
            value={v.busca} onChange={ev => v.digitar(ev.target.value)} onFocus={v.focar} onBlur={v.sair} />
        )}
        <div className="table-wrap scroll-list ndp-add-lista" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 30, boxShadow: 'var(--shadow-lg)' }} hidden={!v.lista}>
          {v.lista && (!v.lista.length
            ? <p className="empty" style={{ padding: '10px 12px' }}>Nenhuma conta encontrada.</p>
            : (
              <table>
                <tbody>
                  {v.lista.map(a => (
                    <tr key={a.codigo}>
                      <td style={{ width: 84, paddingRight: 0 }}><span className={classeGrupo(a.grupo)}>{classeGrupo(a.grupo) === 'grupo-tag' ? null : a.grupo}</span></td>
                      <td className="num" style={{ width: 70 }}>{a.codigo}</td>
                      <td className="wrap">{a.nome}</td>
                      <td className="num" style={{ width: 96 }}><button type="button" className="btn btn-primary" onClick={() => v.escolher(a.codigo)}>Vincular</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </div>
    </div>
  );
}
