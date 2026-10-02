// O "?" do executor (Vitor, 02/10/2026: "reformule para uma tabelinha, com um botão de resolver; o programa leva o
// usuário até o problema, destacando"): o que falta, uma linha cada, e o Resolver de cada um. Quem não tem lugar na
// tela (ex.: "a Conferência carregar") fica sem o botão.
import { classeDaJanela, Icone } from '@nads/ui';

export interface ItemQueFalta { texto: string; alvo: string | null }

export function JanelaOQueFalta({ itens, onResolver, onFechar }: { itens: ItemQueFalta[]; onResolver: (alvo: string) => void; onFechar: () => void }) {
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) onFechar(); }}>
      <div className={classeDaJanela({ icone: 'ajuda' }) + ' falta-janela'} role="dialog" aria-modal="true" aria-labelledby="faltaTitulo">
        <div className="modal-icon"><Icone nome="ajuda" /></div>
        <h3 id="faltaTitulo">Para seguir, falta</h3>
        <div className="table-wrap falta-tabela">
          <table className="table-compact">
            <tbody>
              {itens.map((it, i) => (
                <tr key={i}>
                  <td className="wrap">{it.texto}</td>
                  <td className="num">
                    {it.alvo && <button type="button" className="btn" onClick={() => onResolver(it.alvo as string)}>Resolver</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" autoFocus onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
