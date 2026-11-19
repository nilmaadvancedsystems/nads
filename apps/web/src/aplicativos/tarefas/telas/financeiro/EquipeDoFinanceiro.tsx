// Financeiro › Equipe (Vitor, 19/11/2026: "Deixa so uma aba 'equipe', onde voce vai colocar Enviar holerites, insumos, comissoes da
// equipe, em um menu lateral"): as três telas da equipe numa aba só, escolhidas no menu da esquerda (a escolhida fica no endereço,
// ?parte=). Para o Diretor e o Dono.
import { Icone, type NomeIcone } from '@nads/ui';
import { useSearchParams } from 'react-router';
import { ComissoesDaEquipe } from '../carteira/ComissoesDaEquipe';
import { EnviarHolerites } from '../carteira/EnviarHolerites';
import { Insumos } from '../carteira/Insumos';

const PARTES: readonly { id: string; rotulo: string; icone: NomeIcone }[] = [
  { id: 'comissoes', rotulo: 'Comissões da equipe', icone: 'checklist' },
  { id: 'holerites', rotulo: 'Enviar holerites', icone: 'upload' },
  { id: 'insumos', rotulo: 'Insumos', icone: 'impressora' },
];

export function EquipeDoFinanceiro() {
  const [busca, setBusca] = useSearchParams();
  const parte = PARTES.find(p => p.id === busca.get('parte'))?.id || 'comissoes';
  return (
    <div className="fin-equipe">
      <nav className="fin-equipe-menu" aria-label="Equipe">
        {PARTES.map(p => (
          <button key={p.id} type="button" className={'fin-equipe-item' + (p.id === parte ? ' ativo' : '')} aria-current={p.id === parte ? 'page' : undefined}
            onClick={() => setBusca(b => { const n = new URLSearchParams(b); n.set('parte', p.id); return n; }, { replace: true })}>
            <Icone nome={p.icone} />{p.rotulo}
          </button>
        ))}
      </nav>
      <div className="fin-equipe-corpo">
        {parte === 'holerites' ? <EnviarHolerites /> : parte === 'insumos' ? <Insumos /> : <ComissoesDaEquipe />}
      </div>
    </div>
  );
}
