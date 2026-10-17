// As regras e os cadastros do LCDPR (o lcdpr/config do Entregas), para todas as telas dele: ao vivo, e gravar o documento
// inteiro (como a página antiga). Erro ao gravar vira o aviso no topo.
import type { lcdpr } from '@nads/core';
import { useCarregando, useRetorno } from '@nads/ui';
import { useLcdpr } from '../../../dados/repo';

export function useRegrasDoLcdpr() {
  const repo = useLcdpr();
  const { aviso } = useRetorno();
  const estado = repo.config();
  useCarregando(!estado.carregada);
  return {
    carregada: estado.carregada,
    config: estado.config,
    erro: estado.erro,
    semDocumento: estado.semDocumento,
    exemplos: repo.exemplos,
    /** as regras de agora (depois de uma pergunta, as do desenho podem ter ficado velhas) */
    atual: () => repo.config().config,
    /** grava (devolve se gravou) */
    async gravar(c: lcdpr.ConfigLcdpr): Promise<boolean> {
      try { await repo.salvar(c); return true; } catch (e) { aviso({ tom: 'erro', titulo: 'Não gravou o LCDPR', texto: e instanceof Error ? e.message : String(e) }); return false; }
    },
  };
}
