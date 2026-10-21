// A linha do tempo do Painel do robô (21/10/2026): uma linha por coisa que o robô fez, a mais nova em cima. O que
// aconteceu em negrito, o detalhe embaixo (quebra a linha, nunca corta), o tipo num selo suave (o erro em vermelho) e
// quando à direita. Feita das linhas com selo da entrega (ent-linhas) e do selo suave.
import { entregas } from '@nads/core';

export function LinhaDoTempoDoRobo({ itens, agora, comRobo = true }: { itens: readonly entregas.AtividadeDoRobo[]; agora: number; comRobo?: boolean }) {
  return (
    <ul className="ent-linhas robo-linhas">
      {itens.map(a => (
        <li key={a.id} className={a.erro ? 'robo-linha-erro' : undefined}>
          <div className="robo-linha-texto">
            <b>{a.texto}</b>
            {(a.detalhe || comRobo) && (
              <span className="fraco">{[a.detalhe, comRobo ? entregas.NOMES_DOS_ROBOS[a.robo] : ''].filter(Boolean).join(' · ')}</span>
            )}
          </div>
          <span className={'badge badge-suave ' + (a.erro ? 'badge-bad' : 'badge-neutral')} title={a.erro ? 'Deu erro' : undefined}>
            {(a.erro ? 'Erro · ' : '') + entregas.rotuloDoTipo(a.tipo)}
          </span>
          <span className="fraco robo-quando">{entregas.quandoNoPainel(a.em, agora)}</span>
        </li>
      ))}
    </ul>
  );
}
