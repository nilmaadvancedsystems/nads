// O botãozinho ao lado do upload de um razão: usa o razão que o robô do Alterdata puxou na Importação (Vitor, 06/11/2026:
// "não vai ter mais a função de diário, apenas razões do lançamento"), em vez de subir o razão de cada conta. Sem o razão
// do robô, o clique avisa para puxá-lo (quem chama decide). O nome ficou BotaoDiario: o guardado ainda chama de diario.
import { Icone } from '@nads/ui';
import { ROBO_NAS_ETAPAS } from './contabilDaEmpresa';

export function BotaoDiario({ onClick, titulo = 'Usar o razão que o robô puxou do Alterdata', desabilitado }: { onClick: () => void; titulo?: string; desabilitado?: boolean }) {
  if (!ROBO_NAS_ETAPAS) return null;
  return (
    <button type="button" className="icon-btn icon-btn-sm imp-btn" onClick={onClick} disabled={desabilitado} title={titulo} aria-label={titulo}>
      <Icone nome="robo" />
    </button>
  );
}
