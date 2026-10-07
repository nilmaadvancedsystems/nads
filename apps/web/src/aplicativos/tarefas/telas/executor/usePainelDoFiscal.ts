// ViewModel da "checklist disfarçada" do Fiscal (Vitor, 06/10/2026: "com tabelinha, gráfico para evitar de ficar sem
// graça; o que pode ser importado coloque para importar"): as notas importadas na Conferência (a mesma do Contábil) e a
// contagem do SIEG, resumidas para o painel de cada tarefa; e a janela de importar (os relatórios da tarefa).
import { tarefas as t } from '@nads/core';
import { useMemo, useState } from 'react';
import { useNotasDaConferencia } from '../../../concilia-ai/importadosNaEtapa';
import { useExecucoes, useSieg } from '../../dados/repo';

const VAZIO: t.painel.NotasDoPainel = { entradas: [], saidas: [], tomados: [], prestados: [] };

export const ROTULO_DO_RELATORIO: Record<t.RelatorioImportavel, string> = { entradas: 'Entradas', saidas: 'Saídas', tomados: 'Tomados', prestados: 'Prestados' };

export function usePainelDoFiscal(empresa: string, codigo: string, competencia: string, meses: readonly string[]) {
  const lidas = useNotasDaConferencia(empresa);
  const sieg = useSieg();
  const cont = codigo ? sieg.contagem(codigo, competencia) : null;
  const n = lidas || VAZIO;
  const chave = (meses.length ? meses : [competencia]).join(',');
  const { entradas, saidas, tomados, prestados } = n;
  const resumo = useMemo(() => {
    const p = chave.split(',');
    return {
      importado: t.painel.importadoNoPeriodo({ entradas, saidas, tomados, prestados }, p),
      saidas: t.painel.resumoDeNotas(saidas, p),
      entradas: t.painel.resumoDeNotas(entradas, p),
      prestados: t.painel.resumoDeServicos(prestados, p),
      receita: t.painel.composicao(saidas, p, prestados),
      base: t.painel.composicao(saidas, p),
      issRetido: t.painel.retencoes(tomados, prestados, p, 'issRet'),
      inssRetido: t.painel.retencoes(tomados, prestados, p, 'inss'),
      // a verificação (Vitor, 07/10/2026): os itens por NCM/CST/CEST, os serviços com o que cada nota retém, as interestaduais
      fiscalSaidas: t.painel.porNcmCstCest(saidas, p),
      fiscalEntradas: t.painel.porNcmCstCest(entradas, p),
      servicos: t.painel.servicosComRetencoes(tomados, prestados, p),
      interestaduais: t.painel.interestaduais(entradas, p),
    };
  }, [entradas, saidas, tomados, prestados, chave]);
  const c = cont?.dados || null;
  // a folha do DP (Vitor, 07/10/2026: "trazer quanto é gasto em folha do DP"): o total que o DP informou na etapa Folha
  // de pagamento do mesmo mês (pelo código da empresa)
  const dp = useExecucoes(competencia, 'dp');
  const exDp = codigo ? dp.execucoes.find(e => String(e.codigo) === codigo) : null;
  const folhaDoDp = exDp?.valores?.folha ?? null;
  // a janela de importar: os relatórios da tarefa, um por tópico
  const [importando, setImportando] = useState<{ relatorios: t.RelatorioImportavel[]; atual: t.RelatorioImportavel } | null>(null);
  return {
    carregado: !!lidas,
    folhaDoDp,
    ...resumo,
    /** a contagem do SIEG do mês (null = ainda não contou) */
    sieg: c ? {
      emitidasNFe: c.emitidas.NFe + c.emitidas.NFCe,
      recebidasNFe: c.recebidas.NFe,
      modelos: t.sieg.TIPOS_DE_NOTA.map(x => ({ rotulo: x.rotulo, emitidas: c.emitidas[x.id], recebidas: c.recebidas[x.id] })).filter(x => x.emitidas || x.recebidas),
    } : null,
    importando,
    importar: (relatorios: t.RelatorioImportavel[]) => setImportando({ relatorios, atual: relatorios[0] }),
    trocarRelatorio: (r: t.RelatorioImportavel) => setImportando(v => (v ? { ...v, atual: r } : v)),
    fecharImportacao: () => setImportando(null),
  };
}

export type VmPainelDoFiscal = ReturnType<typeof usePainelDoFiscal>;
