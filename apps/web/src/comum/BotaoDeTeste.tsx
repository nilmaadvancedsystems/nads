// O ⚡ do modo desenvolvedor ao lado do importar (Vitor, 06/10/2026: "deixa o raiozinho em tudo que é para importar"):
// o mesmo botão de ícone da linha de importação; uma opção, implanta direto; mais de uma, abre o menu. Sem opção, nada.
// Os dados de teste ficam só na tela (no modo desenvolvedor, nada vai para o banco).
import { Icone, MenuSuspenso } from '@nads/ui';

export interface ItemDeTeste { rotulo: string; onClick: () => void }

export function BotaoDeTeste({ itens, desabilitado }: { itens: readonly ItemDeTeste[]; desabilitado?: boolean }) {
  if (!itens.length) return null;
  if (itens.length === 1) {
    const [i] = itens;
    return (
      <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={desabilitado} onClick={i.onClick}
        title={'Dados de teste: ' + i.rotulo} aria-label={'Dados de teste: ' + i.rotulo}>
        <Icone nome="zap" />
      </button>
    );
  }
  return (
    <MenuSuspenso rotulo="" icone="zap" className="gh-topo-btn gh-topo-menu imp-mes-menu" direita dica="Dados de teste"
      itens={itens.map(i => ({ rotulo: i.rotulo, icone: 'zap' as const, desabilitado, onClick: i.onClick }))} />
  );
}
