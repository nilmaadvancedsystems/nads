// ViewModel da etapa Arquivos: números da conciliação, um arquivo por bandeira e um de saídas por
// mês (vendas sem cartão), cada um em .xls (Excel 97-2003) e .csv, e a prévia por bandeira.
// Origem: conciliadorZINHO.html buildFinalOutputs (~L1817), renderBrandTabs/renderPreviewForBrand
// (~L1918-1946), renderBrandDownloads (~L1947), buildSaidaOutputs (~L2077), renderSaidaDownloads (~L2149).
// O download é direto (as reservas .xls.txt/.html/.txt do original eram só para o visualizador do claude.ai).
import { conciliadorzinho as cz } from '@nads/core';
import { useMemo, useState } from 'react';
import { useSessao } from '../../casca/sessao';

export interface ArquivoPronto { nome: string; bytes?: Uint8Array; texto?: string; tipo: string }

const XLS = 'application/vnd.ms-excel';
const CSV = 'text/csv';

export function useArquivos() {
  const s = useSessao();
  const r = s.estado.resultado;
  const c = s.estado.contas;
  const contas: cz.Contas = { vendas: c.vendas, taxas: c.taxas, caixaPadrao: !!c.caixaPadrao, caixa: c.caixa };

  const bandeiras = useMemo(() => {
    if (!r) return [];
    return r.ordem.flatMap(id => {
      const res = r.conciliacao.porBandeira[id];
      if (!res) return [];
      const linhas = cz.linhasDaBandeira(res, (s.estado.dados[id]?.conta || '').trim(), contas);
      return [{ id, rotulo: cz.bandeira(id).rotulo, res, linhas, nomeBase: cz.nomeBaseBandeira(id, res.meses) }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, s.estado.dados, c]);

  const saidas = useMemo(() => (r ? cz.saidasPorMes(r.conciliacao.sobras, c.vendas.trim()) : []), [r, c.vendas]);
  const [aba, setAba] = useState<cz.IdBandeira | null>(null);
  const previa = bandeiras.find(b => b.id === aba) || bandeiras[0];

  const soma = (f: (x: cz.ResultadoBandeira) => number) => bandeiras.reduce((t, b) => t + f(b.res), 0);
  const centavos = (n: number) => Math.round(n * 100) / 100;

  let nota = 'Data, valor bruto e valor da taxa foram lidos diretamente do(s) extrato(s) de cada bandeira; o cruzamento com as notas fiscais usa a data, o valor bruto e o histórico (NF, CPF/CNPJ e cliente) lidos diretamente da planilha de vendas enviada. Quando duas bandeiras têm um lançamento com a mesma data e o mesmo valor, a bandeira com mais lançamentos no período recebe a nota fiscal primeiro.';
  if (s.estado.excluidos.length) nota += ' Os lançamentos de ' + s.estado.excluidos.map(cz.rotuloMes).join(', ') + ' ficaram de fora porque a planilha de vendas enviada não cobre esse período.';

  return {
    numeros: {
      aprovadas: soma(x => x.aprovadas),
      casadas: soma(x => x.casadas),
      semNota: soma(x => x.semNota),
      bandeiras: bandeiras.length,
      bruto: centavos(soma(x => x.totalBruto)),
      taxas: centavos(soma(x => x.totalTaxa)),
    },
    paridade: s.estado.excluidos.length ? 'dentro dos meses conciliados' : 'com os extratos originais',
    bandeiras: bandeiras.map(b => ({
      id: b.id, rotulo: b.rotulo,
      resumo: b.res.aprovadas + ' lançamentos · ' + b.res.casadas + ' com nota · ' + b.res.semNota + ' sem nota',
      xls: (): ArquivoPronto => ({ nome: b.nomeBase + '.xls', bytes: cz.planilhaXls(b.linhas, 'Conciliacao'), tipo: XLS }),
      csv: (): ArquivoPronto => ({ nome: b.nomeBase + '.csv', texto: cz.textoCsv(b.linhas), tipo: CSV }),
    })),
    saidas: saidas.map(sd => ({
      chave: sd.chave, rotulo: sd.rotulo, resumo: sd.linhas.length + ' nota(s)',
      xls: (): ArquivoPronto => ({ nome: sd.nomeBase + '.xls', bytes: cz.planilhaXls(sd.linhas, 'Saidas'), tipo: XLS }),
      csv: (): ArquivoPronto => ({ nome: sd.nomeBase + '.csv', texto: cz.textoCsv(sd.linhas), tipo: CSV }),
    })),
    abas: bandeiras.map(b => ({ valor: b.id, rotulo: b.rotulo })),
    aba: previa?.id || null,
    setAba,
    previa: previa ? {
      contagem: previa.linhas.length + ' linhas geradas (' + previa.res.aprovadas + ' transações × 2) — ' + previa.rotulo,
      linhas: previa.linhas,
    } : null,
    nota,
    novoProcesso: s.recomecar,
  };
}
