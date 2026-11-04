// O botãozinho de Diário ao lado do upload de um razão (Vitor, 2026-11): usa o Diário do Alterdata que já está na
// Importação, em vez de subir o razão de cada conta. Sem o Diário, o clique avisa para importá-lo (quem chama decide).
import { Icone } from '@nads/ui';

export function BotaoDiario({ onClick, titulo = 'Usar o Diário (PDF) deste razão', desabilitado }: { onClick: () => void; titulo?: string; desabilitado?: boolean }) {
  return (
    <button type="button" className="icon-btn icon-btn-sm imp-btn" onClick={onClick} disabled={desabilitado} title={titulo} aria-label={titulo}>
      <Icone nome="relatorio" />
    </button>
  );
}
