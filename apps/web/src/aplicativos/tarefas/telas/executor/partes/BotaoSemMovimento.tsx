// O "Não houve mais movimento" dos adiantamentos (Vitor, 26/10/2026): marcado, fica como o "Conferido" do Verificar por
// conta (o check e o fundo cheio); clicar de novo desfaz.
import { Icone } from '@nads/ui';

export function BotaoSemMovimento({ marcado, onClick }: { marcado: boolean; onClick: () => void }) {
  return marcado
    ? <button type="button" className="btn vc-conferido-on" title="Marcado: a etapa não cobra nada. Clique para desfazer." onClick={onClick}><Icone nome="check" />Não houve mais movimento</button>
    : <button type="button" className="btn btn-outline" title="A conta não teve mais movimento no período: a etapa não cobra o razão nem a correção" onClick={onClick}>Não houve mais movimento</button>;
}
