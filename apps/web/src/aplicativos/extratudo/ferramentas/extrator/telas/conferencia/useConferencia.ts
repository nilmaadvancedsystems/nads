// ViewModel de Conferência › Extrato × sistema: escolhe o mês e a tolerância de data, confere
// (core: extrator.conferir) e filtra por situação e busca. Os números do topo filtram a tabela.
import { formatos, extrator as x } from '@nads/core';
import { useMemo } from 'react';
import { useSessao, type FiltroSituacao } from '../../casca/sessao';

export const LIMITE_LINHAS = 1000;
export const TOLERANCIAS = [0, 1, 2, 3, 5, 7];

const STATS: { id: x.Situacao; rotulo: string }[] = [
  { id: 'ok', rotulo: 'Conferidos' },
  { id: 'faltando', rotulo: 'Faltando no sistema' },
  { id: 'diferente', rotulo: 'Diferentes' },
  { id: 'amais', rotulo: 'A mais no sistema' },
  { id: 'duplicado', rotulo: 'Duplicados' },
];

const FILTROS: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: 'pendencias', rotulo: 'Pendências' },
  { valor: 'faltando', rotulo: 'Faltando' },
  { valor: 'diferente', rotulo: 'Diferentes' },
  { valor: 'amais', rotulo: 'A mais' },
  { valor: 'duplicado', rotulo: 'Duplicados' },
  { valor: 'ok', rotulo: 'Conferidos' },
  { valor: 'todos', rotulo: 'Tudo' },
];

/** doArquivo: só os arquivos de um banco (a etapa da Tarefas, quando a empresa tem mais de um) */
export function useConferencia(doArquivo?: (a: x.ArquivoImportado) => boolean) {
  const s = useSessao();
  const e = useMemo(() => (doArquivo ? { ...s.empresa, arquivos: s.empresa.arquivos.filter(doArquivo) } : s.empresa), [s.empresa, doArquivo]);
  const f = s.conferencia;
  const meses = x.competencias(e);
  const mesesBanco = [...new Set(x.lancamentosDe(e, 'banco').map(l => l.data.slice(0, 7)))].sort();
  const periodo = f.periodo && (f.periodo === 'tudo' || meses.includes(f.periodo)) ? f.periodo : mesesBanco[mesesBanco.length - 1] || 'tudo';

  const r = useMemo(() => {
    const noPeriodo = (l: x.LancamentoDoArquivo) => periodo === 'tudo' || l.data.startsWith(periodo);
    const extrato = x.lancamentosDe(e, 'banco').filter(noPeriodo);
    const sistema = x.lancamentosDe(e, 'sistema').filter(noPeriodo);
    const c = x.conferir(extrato, sistema, f.tolerancia);
    const te = x.totais(extrato);
    const ts = x.totais(sistema.map(l => ({ valor: c.sistemaInvertido ? -l.valor : l.valor })));
    return { c, qtdExtrato: extrato.length, qtdSistema: sistema.length, te, ts };
  }, [e, periodo, f.tolerancia]);

  const q = formatos.normalizarTexto(f.busca);
  const doFiltro = r.c.linhas.filter(l => f.situacao === 'todos' || (f.situacao === 'pendencias' ? l.situacao !== 'ok' : l.situacao === f.situacao));
  const achadas = q ? doFiltro.filter(l => formatos.normalizarTexto([l.extrato, l.sistema].map(v => (v ? v.historico + ' ' + x.valorBR(v.valor) + ' ' + x.dataBR(v.data) : '')).join(' ')).includes(q)) : doFiltro;

  const mudar = (p: Partial<typeof f>) => s.setConferencia(c => ({ ...c, ...p }));
  const nomeArquivo = 'conferencia-extrato-' + (s.codigo ?? formatos.slug(s.nome)) + '-' + periodo;

  return {
    meses: meses.map(m => ({ valor: m, rotulo: formatos.mesCurto(m), ativo: m === periodo })),
    tudoAtivo: periodo === 'tudo', variosMeses: meses.length > 1,
    escolherPeriodo: (p: string) => mudar({ periodo: p }),
    tolerancia: f.tolerancia, tolerancias: TOLERANCIAS, escolherTolerancia: (t: number) => mudar({ tolerancia: t }),
    stats: STATS.map(v => ({ ...v, qtd: r.c.contagem[v.id], ativo: f.situacao === v.id })),
    escolherStat: (id: x.Situacao) => mudar({ situacao: f.situacao === id ? 'pendencias' : id }),
    extrato: r.te, sistema: r.ts, diferenca: r.ts.liquido - r.te.liquido,
    sistemaInvertido: r.c.sistemaInvertido,
    filtro: f.situacao, filtros: FILTROS, escolherFiltro: (v: FiltroSituacao) => mudar({ situacao: v }),
    busca: f.busca, setBusca: (v: string) => mudar({ busca: v }),
    qtd: achadas.length, qtdTotal: r.c.linhas.length, qtdExtrato: r.qtdExtrato, qtdSistema: r.qtdSistema,
    linhas: achadas.slice(0, LIMITE_LINHAS).map((l, i) => ({
      chave: (l.extrato?.id || '') + '|' + (l.sistema?.id || '') + '|' + i,
      situacao: l.situacao, rotulo: x.rotuloSituacao(l.situacao),
      data: x.dataBR(l.data),
      dataSistema: l.extrato && l.sistema && l.extrato.data !== l.sistema.data ? x.dataBR(l.sistema.data) : '',
      historico: (l.extrato || l.sistema)!.historico,
      historicoSistema: l.extrato && l.sistema && formatos.normalizarTexto(l.extrato.historico) !== formatos.normalizarTexto(l.sistema.historico) ? l.sistema.historico : '',
      copia: l.situacao === 'duplicado' ? (l.ladoDuplicado === 'sistema' ? 'Cópia no sistema' : 'Cópia no extrato') : '',
      valorExtrato: l.extrato ? l.extrato.valor : null,
      valorSistema: l.sistema ? l.sistema.valor : null,
      motivo: l.motivo,
    })),
    cortado: achadas.length > LIMITE_LINHAS,
    vazioDoFiltro: f.situacao === 'pendencias' ? 'Tudo bate neste período. Nenhuma pendência.' : 'Nenhum lançamento nesta situação.',
    csv: () => ({ texto: x.csvConferencia(r.c), nome: nomeArquivo + '.csv' }),
  };
}
