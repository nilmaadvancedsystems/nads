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
  // os XMLs do "Baixar XMLs do SIEG" (Vitor, 08/10/2026: "usa os dados do xml nas tabelas de verificação"): quando há,
  // as tabelas de NCM/CST/CEST e dos serviços saem deles (o item e a retenção vêm da própria nota); sem eles, do Alterdata
  const xmlDados = (codigo ? sieg.notas(codigo, competencia) : null)?.dados || null;
  const doXml = useMemo(() => (xmlDados ? t.sieg.notasDoXml(xmlDados) : null), [xmlDados]);
  const n = lidas || VAZIO;
  const chave = (meses.length ? meses : [competencia]).join(',');
  const { entradas, saidas, tomados, prestados } = n;
  const resumo = useMemo(() => {
    const p = chave.split(',');
    const saidasAlt = t.painel.resumoDeNotas(saidas, p);
    const entradasAlt = t.painel.resumoDeNotas(entradas, p);
    // o XML vale quando trouxe os itens (um resumo grande demais sai sem eles: aí fica o Alterdata)
    const comItens = !!doXml && !doXml.itensCortados;
    const xmlSaidas = comItens && doXml!.saidas.length ? t.painel.porNcmCstCest(doXml!.saidas, p) : null;
    const xmlEntradas = comItens && doXml!.entradas.length ? t.painel.porNcmCstCest(doXml!.entradas, p) : null;
    const xmlServicos = doXml && doXml.prestados.length + doXml.tomados.length ? t.painel.servicosComRetencoes(doXml.tomados, doXml.prestados, p) : null;
    const notasDe = (r: t.painel.ResumoDeNotas) => r.porCfop.flatMap(l => l.notas);
    return {
      importado: t.painel.importadoNoPeriodo({ entradas, saidas, tomados, prestados }, p),
      saidas: saidasAlt,
      entradas: entradasAlt,
      prestados: t.painel.resumoDeServicos(prestados, p),
      receita: t.painel.composicao(saidas, p, prestados),
      base: t.painel.composicao(saidas, p),
      issRetido: t.painel.retencoes(tomados, prestados, p, 'issRet'),
      inssRetido: t.painel.retencoes(tomados, prestados, p, 'inss'),
      // a verificação (Vitor, 07/10/2026): os itens por NCM/CST/CEST, os serviços com o que cada nota retém, as interestaduais
      fiscalSaidas: xmlSaidas || t.painel.porNcmCstCest(saidas, p),
      fiscalEntradas: xmlEntradas || t.painel.porNcmCstCest(entradas, p),
      servicos: xmlServicos || t.painel.servicosComRetencoes(tomados, prestados, p),
      /** de onde saiu cada tabela de verificação */
      doXml: { saidas: !!xmlSaidas, entradas: !!xmlEntradas, servicos: !!xmlServicos },
      /** as notas do XML que o Alterdata ainda não tem (só com o relatório importado daquele lado) */
      faltamSaidas: xmlDados && saidasAlt.qtd ? t.sieg.faltamNoAlterdata(xmlDados.emitidas, notasDe(saidasAlt), 'emitidas') : [],
      faltamEntradas: xmlDados && entradasAlt.qtd ? t.sieg.faltamNoAlterdata(xmlDados.recebidas, notasDe(entradasAlt), 'recebidas') : [],
      interestaduais: t.painel.interestaduais(entradas, p),
    };
  }, [entradas, saidas, tomados, prestados, chave, doXml, xmlDados]);
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
    /** o último "Baixar XMLs do SIEG" (quando e quantos), para dizer de onde vêm as tabelas */
    xml: xmlDados ? { quando: xmlDados.em ? new Date(xmlDados.em).toLocaleDateString('pt-BR') : '', arquivos: xmlDados.arquivos } : null,
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
