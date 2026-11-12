// ViewModel da REINF (Fiscal › REINF; Vitor, 05/10/2026): a competência, as empresas obrigadas com a situação de cada
// uma, a busca, o filtro (Todas / Pendentes / Transmitidas) e as ações (Transmitir, Desfazer, Retificar), que ficam em
// useAcoesDaReinf (o Relatório geral usa as mesmas).
import { tarefas as t } from '@nads/core';
import { useEmpresasPermitidas } from '../../empresas/andamento';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useRepo } from '../../../dados/repo';
import { usePorPagina } from '../relatorio/usePorPagina';
import { mmaaaa, quandoDaReinf, useAcoesDaReinf } from './useAcoesDaReinf';

export { estadosDaReinf } from './useAcoesDaReinf';

export function useReinf() {
  const repo = useRepo();
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const acoes = useAcoesDaReinf(competencia);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');
  const { porPagina, porPaginaOpcoes, escolher: escolherPorPagina } = usePorPagina();
  const [pagina, setPagina] = useState(0);

  // todas as empresas do Fiscal, menos as filiais (05/11/2026), pelo regime do Cadastro (o da lista, quando não tem)
  const permitidas = useEmpresasPermitidas();
  const lista = t.empresasDaReinf(repo.listarEmpresas().map(e => ({ ...e, regime: t.regimeDaEmpresa(e.codigo) || e.regime })))
    .filter(e => permitidas.pode(e))
    .map(e => ({ codigo: e.codigo, nome: e.nome, estado: acoes.estados[e.codigo] || { codigo: e.codigo, retificadas: [] } }));
  const resumo = t.resumoReinf(lista.map(l => l.estado), competencia);
  const q = busca.trim().toLowerCase();
  const linhas = lista
    .filter(l => !q || (l.codigo + ' ' + l.nome).toLowerCase().includes(q))
    .filter(l => !filtro || (filtro === 'pendentes') === (t.situacaoReinf(l.estado, competencia) === 'pendente'))
    .map(l => {
      const sit = t.situacaoReinf(l.estado, competencia);
      return {
        codigo: l.codigo, nome: l.nome, transmitida: sit === 'transmitida',
        ate: l.estado.transmitidoAte ? mmaaaa(l.estado.transmitidoAte) : '—',
        ultima: l.estado.ultima ? quandoDaReinf(l.estado.ultima.em) + ' · ' + l.estado.ultima.por : '',
        retificadas: l.estado.retificadas.map(mmaaaa),
        retificadaNaCompetencia: l.estado.retificadas.includes(competencia),
        /** as séries transmitidas na competência (2000, 4000, MIT) */
        series: t.seriesDaReinf(l.estado, competencia),
      };
    });

  // a busca e o filtro correm todas as empresas, e só depois a lista se divide em páginas (como no Relatório)
  const paginas = porPagina ? Math.max(1, Math.ceil(linhas.length / porPagina)) : 1;
  const atual = Math.min(pagina, paginas - 1);
  const daPagina = porPagina ? linhas.slice(atual * porPagina, (atual + 1) * porPagina) : linhas;

  return {
    competencia, rotuloCompetencia: t.rotuloCompetencia(competencia),
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => setParams({ competencia: c }),
    resumo, linhas: daPagina, achadas: linhas.length, busca, filtro,
    setBusca: (b: string) => { setBusca(b); setPagina(0); },
    setFiltro: (f: string) => { setFiltro(f); setPagina(0); },
    limpar: () => { setBusca(''); setFiltro(''); setPagina(0); },
    porPagina, porPaginaOpcoes,
    setPorPagina: (n: number) => { escolherPorPagina(n); setPagina(0); },
    pagina: { atual, paginas,
      anterior: () => setPagina(Math.max(0, atual - 1)), proxima: () => setPagina(Math.min(paginas - 1, atual + 1)) },
    transmitir: acoes.transmitir, desfazer: acoes.desfazer, retificar: acoes.retificar, alternarSerie: acoes.alternarSerie, transmitirSeries: acoes.transmitirSeries,
  };
}
