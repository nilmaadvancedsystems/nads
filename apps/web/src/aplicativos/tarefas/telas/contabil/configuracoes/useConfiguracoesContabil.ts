// ViewModel de Contábil › Configurações (Vitor, 05/10/2026: "uma aba de configurações dentro do contábil, só para
// configurar históricos"): os códigos de histórico do Creditor (principal, mora e desconto), os mesmos para todas as
// empresas; e os textos e códigos das etapas que exportam Excel (03/11/2026: Honorários, Pró-labore, Adiantamento
// salarial, INSS, FGTS e Cheque especial), também para todas as empresas. Grava quando sai do campo, só se mudou.
import { creditor as cr, tarefas as tf } from '@nads/core';
import { useCarregando, useRetorno } from '@nads/ui';
import { useHistoricosDoEscritorio } from '../../../../extratudo/ferramentas/creditor/dados/repo';
import { useHistoricosDoContabil } from '../../../dados/useModelosDeHistorico';

const ROTULO: Record<cr.CampoHistorico, string> = {
  histPrincipal: 'Histórico do principal', histJuros: 'Histórico da mora', histDesconto: 'Histórico do desconto',
};

export interface ItemDeHistorico {
  id: tf.IdDoHistorico;
  rotulo: string;
  valor: string;
  padrao: string;
  variaveis: readonly tf.VariavelDoHistorico[];
  codigo: boolean;
}

export interface EtapaDeHistorico { nome: string; itens: ItemDeHistorico[] }

/** As etapas na ordem do registro (uma seção por etapa). */
function etapasDoRegistro(modelos: tf.ModelosDoHistorico): EtapaDeHistorico[] {
  const nomes: string[] = [];
  for (const h of tf.HISTORICOS_DO_CONTABIL) if (!nomes.includes(h.etapa)) nomes.push(h.etapa);
  return nomes.map(nome => ({
    nome,
    itens: tf.HISTORICOS_DO_CONTABIL.filter(h => h.etapa === nome).map(h => ({
      id: h.id, rotulo: h.rotulo, valor: modelos[h.id], padrao: h.padrao, variaveis: h.variaveis, codigo: !!h.codigo,
    })),
  }));
}

export function useConfiguracoesContabil() {
  const { historicos, carregados, salvar } = useHistoricosDoEscritorio();
  const { toast } = useRetorno();
  const contabil = useHistoricosDoContabil(toast);
  useCarregando(!carregados || !contabil.carregados);
  return {
    carregados,
    campos: cr.CAMPOS_HISTORICO.map(k => ({ id: k, rotulo: ROTULO[k], valor: historicos[k], padrao: cr.HISTORICOS_PADRAO[k] })),
    mudar: (k: cr.CampoHistorico, v: string) => {
      const novo = v.trim() || cr.HISTORICOS_PADRAO[k];
      if (novo !== historicos[k]) salvar({ ...historicos, [k]: novo });
    },
    carregadosDoContabil: contabil.carregados,
    etapas: etapasDoRegistro(contabil.modelos),
    /** grava um texto ou código; devolve false (e avisa) quando o código não é só dígitos até o limite */
    mudarHistorico: (id: tf.IdDoHistorico, v: string): boolean => {
      const def = tf.definicaoDoHistorico(id);
      const limpo = v.trim();
      if (def.codigo && limpo && !tf.codigoValido(limpo)) {
        toast('O código do histórico tem só números, até ' + tf.LIMITE_DO_CODIGO + ' dígitos.');
        return false;
      }
      const novo = limpo || def.padrao; // em branco = volta ao padrão
      if (novo !== contabil.modelos[id]) contabil.salvar({ ...contabil.modelos, [id]: novo });
      return true;
    },
  };
}
