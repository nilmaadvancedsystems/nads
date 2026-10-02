// O que falta para seguir (Vitor, 02/10/2026): não é mais janela — fica suspenso, como o "Code ▾" do GitHub, no sino do
// cabeçalho (com o número de pendências). Uma linha por pendência e o Resolver, que leva até o problema e o destaca.
// Quem não tem lugar na tela (ex.: "a Conferência carregar") fica sem o botão.
export interface ItemQueFalta { texto: string; alvo: string | null }

export function ListaDoQueFalta({ itens, onResolver, fechar }: { itens: ItemQueFalta[]; onResolver: (alvo: string) => void; fechar: () => void }) {
  return (
    <div className="falta-pop">
      <p className="falta-pop-titulo">Para seguir, falta</p>
      <ul className="falta-lista">
        {itens.map((it, i) => (
          <li key={i}>
            <span className="falta-texto">{it.texto}</span>
            {it.alvo && <button type="button" className="btn" onClick={() => { fechar(); onResolver(it.alvo as string); }}>Resolver</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
