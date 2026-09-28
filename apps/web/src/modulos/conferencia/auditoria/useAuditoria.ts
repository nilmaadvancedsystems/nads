// ViewModel da Auditoria (histórico único, mais novo primeiro) e o "Remover" da marcação automática.
// Origem: conferencia.html renderAuditoria (~L3623-3651), clique [data-hist-remover] (~L3668-3677).
import { conferencia as c } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useSessao } from '../sessao';

export function useAuditoria() {
  const s = useSessao();
  const { toast } = useRetorno();
  const linhas = c.linhasAuditoria(s.empresa);

  function remover(r: { chave: string; texto: string }) {
    s.aplicar(x => c.removerMarcaAutomatica(x, r.chave, r.texto, new Date()));
    toast('Marcação automática removida.');
  }

  return { linhas, remover };
}
