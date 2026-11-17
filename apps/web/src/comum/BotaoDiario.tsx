// O botãozinho ao lado do upload de um razão: usa o razão que o robô do Alterdata puxou na Importação (Vitor, 06/11/2026:
// "não vai ter mais a função de diário, apenas razões do lançamento"), em vez de subir o razão de cada conta. Sem o razão
// do robô, o clique avisa para puxá-lo (quem chama decide). O nome ficou BotaoDiario: o guardado ainda chama de diario.
import { Icone } from '@nads/ui';
import { ROBO_NAS_ETAPAS, roboNasEtapas } from './contabilDaEmpresa';

// O robô de Vitor (o do PC dele) só na etapa de Importação por enquanto (Vitor, 17/11/2026: "o botao vitor, deixa so na etapa
// de importacao por enquanto, ao longo do tempo iremos aperfeicoando"): nas outras etapas, só com o robô liberado para todos.
export function BotaoDiario({ onClick, titulo = 'Usar o razão que o robô puxou do Alterdata', desabilitado, naImportacao }: { onClick: () => void; titulo?: string; desabilitado?: boolean; naImportacao?: boolean }) {
  if (!(naImportacao ? roboNasEtapas() : ROBO_NAS_ETAPAS)) return null;
  return (
    <button type="button" className="icon-btn icon-btn-sm imp-btn" onClick={onClick} disabled={desabilitado} title={titulo} aria-label={titulo}>
      <Icone nome="robo" />
    </button>
  );
}
