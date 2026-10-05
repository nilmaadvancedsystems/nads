// ViewModel de Contábil › Configurações (Vitor, 05/10/2026: "uma aba de configurações dentro do contábil, só para
// configurar históricos"): os códigos de histórico do Creditor (principal, mora e desconto), os mesmos para todas as
// empresas. Grava quando sai do campo, só se mudou.
import { creditor as cr } from '@nads/core';
import { useCarregando } from '@nads/ui';
import { useHistoricosDoEscritorio } from '../../../../extratudo/ferramentas/creditor/dados/repo';

const ROTULO: Record<cr.CampoHistorico, string> = {
  histPrincipal: 'Histórico do principal', histJuros: 'Histórico da mora', histDesconto: 'Histórico do desconto',
};

export function useConfiguracoesContabil() {
  const { historicos, carregados, salvar } = useHistoricosDoEscritorio();
  useCarregando(!carregados);
  return {
    carregados,
    campos: cr.CAMPOS_HISTORICO.map(k => ({ id: k, rotulo: ROTULO[k], valor: historicos[k], padrao: cr.HISTORICOS_PADRAO[k] })),
    mudar: (k: cr.CampoHistorico, v: string) => {
      const novo = v.trim() || cr.HISTORICOS_PADRAO[k];
      if (novo !== historicos[k]) salvar({ ...historicos, [k]: novo });
    },
  };
}
