// ViewModel da Auditoria do Extrator: importações e exclusões, mais novo primeiro.
import { extrator as x } from '@nads/core';
import { useSessao } from '../../casca/sessao';

export function useAuditoria() {
  const s = useSessao();
  return { linhas: x.linhasAuditoria(s.empresa) };
}
