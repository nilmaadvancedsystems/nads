// ViewModel de Financeiro › Resultado (22/10/2026; melhorado no mesmo dia: "quero melhorar a aba de resultados" — o ano
// mês a mês, agrupar pelo plano, ver os lançamentos, exportar e o período): a visão (o comparativo ou o ano mês a mês),
// o período do comparativo (mês, trimestre ou ano) e a referência, as linhas pela árvore do plano (os grupos abrem e
// fecham; começam fechados, só os de cima), a conta aberta (os lançamentos dela) e a planilha.
import { financeiro } from '@nads/core';
import { baixarBytes } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useCaixa } from '../../dados/repo';
import { hoje } from './formatosDaNota';

export type VisaoDoResultado = 'comparativo' | 'ano';
export const VISOES_DO_RESULTADO: { valor: VisaoDoResultado; rotulo: string }[] = [
  { valor: 'comparativo', rotulo: 'Comparativo' }, { valor: 'ano', rotulo: 'Ano mês a mês' },
];
export const PERIODOS_DO_RESULTADO: { valor: financeiro.PeriodoDoResultado; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês' }, { valor: 'trimestre', rotulo: 'Trimestre' }, { valor: 'ano', rotulo: 'Ano' },
];

/** a linha na ordem de desenhar: com a fundura, se tem filhos e se está aberta */
export interface LinhaVisivel { linha: financeiro.LinhaDoResultado; tipo: financeiro.TipoDeLancamento; temFilhos: boolean; aberta: boolean }

export function useResultadoPorConta() {
  const repo = useCaixa();
  const lanc = repo.lancamentos();
  const plano = repo.plano();
  const dia = hoje();
  const [visao, setVisao] = useState<VisaoDoResultado>('comparativo');
  const [periodo, setPeriodo] = useState<financeiro.PeriodoDoResultado>('mes');
  const [mes, setMes] = useState(() => financeiro.competenciaAnterior(dia));
  const [ano, setAno] = useState(() => Number(dia.slice(0, 4)));
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const [vendo, setVendo] = useState<{ conta: string; rotulo: string; tipo: financeiro.TipoDeLancamento } | null>(null);

  const anos = useMemo(() => {
    const s = new Set(lanc.lista.map(l => Number(l.data.slice(0, 4))));
    s.add(Number(dia.slice(0, 4)));
    return [...s].filter(Number.isFinite).sort((a, b) => b - a);
  }, [lanc.lista, dia]);
  const ref = periodo === 'ano' && visao === 'comparativo' ? ano + '-01' : mes;
  const colunas = useMemo(() => (visao === 'ano' ? financeiro.colunasDoAno(ano) : financeiro.colunasComparativas(periodo, ref)), [visao, ano, periodo, ref]);
  const r = useMemo(() => financeiro.resultadoEmColunas(lanc.lista, plano.lista, colunas), [lanc.lista, plano.lista, colunas]);

  const chave = (tipo: string, l: financeiro.LinhaDoResultado) => tipo + ':' + l.conta;
  const visiveis = (ls: financeiro.LinhaDoResultado[], tipo: financeiro.TipoDeLancamento): LinhaVisivel[] => ls.flatMap(l => {
    const aberta = abertos.has(chave(tipo, l));
    return [{ linha: l, tipo, temFilhos: l.filhos.length > 0, aberta }, ...(aberta ? visiveis(l.filhos, tipo) : [])];
  });
  // todos os grupos (para o Abrir tudo)
  const grupos = (ls: financeiro.LinhaDoResultado[], tipo: string): string[] => ls.flatMap(l => (l.filhos.length ? [chave(tipo, l), ...grupos(l.filhos, tipo)] : []));
  const todosOsGrupos = [...grupos(r.entradas, 'E'), ...grupos(r.saidas, 'S')];
  const tudoAberto = todosOsGrupos.length > 0 && todosOsGrupos.every(g => abertos.has(g));

  // os lançamentos da conta: no comparativo, os do período escolhido; no ano, os do ano todo
  const de = colunas[0].de;
  const ate = visao === 'ano' ? colunas[colunas.length - 1].ate : colunas[0].ate;
  const titulo = visao === 'ano' ? 'Resultado de ' + ano + ', mês a mês' : 'Resultado de ' + colunas[0].rotulo + ' comparado';
  const lancamentosVistos = vendo ? financeiro.lancamentosDaConta(lanc.lista, plano.lista, vendo.conta, vendo.tipo, de, ate) : [];

  return {
    carregando: !lanc.carregada || !plano.carregada,
    erro: lanc.erro || plano.erro,
    exemplos: repo.exemplos,
    visao, setVisao, visoes: VISOES_DO_RESULTADO,
    periodo, setPeriodo, periodos: PERIODOS_DO_RESULTADO,
    mes, setMes, ano, setAno, anos,
    /** escolhe o mês na visão de mês ou trimestre; o ano, na de ano */
    escolheMes: visao === 'comparativo' && periodo !== 'ano',
    colunas: r.colunas,
    comparativo: visao === 'comparativo',
    entradas: visiveis(r.entradas, 'E'),
    saidas: visiveis(r.saidas, 'S'),
    totais: r.totais,
    vazio: !r.entradas.length && !r.saidas.length,
    alternar(l: LinhaVisivel) {
      const k = chave(l.tipo, l.linha);
      setAbertos(a => { const n = new Set(a); if (n.has(k)) n.delete(k); else n.add(k); return n; });
    },
    tudoAberto,
    abrirTudo: () => setAbertos(tudoAberto ? new Set() : new Set(todosOsGrupos)),
    /** a conta aberta e os lançamentos dela */
    vendo: vendo ? { ...vendo, periodo: visao === 'ano' ? String(ano) : colunas[0].rotulo, lancamentos: lancamentosVistos, total: lancamentosVistos.reduce((s, x) => s + Math.round(x.valor * 100), 0) / 100 } : null,
    ver: (l: LinhaVisivel) => setVendo({ conta: l.linha.conta, rotulo: l.linha.rotulo, tipo: l.tipo }),
    fecharVer: () => setVendo(null),
    exportar() {
      baixarBytes(financeiro.planilhaDoResultado(r, titulo, visao === 'ano'), titulo + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    },
  };
}
