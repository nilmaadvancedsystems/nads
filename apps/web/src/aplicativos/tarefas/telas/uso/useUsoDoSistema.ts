// ViewModel do Uso do sistema (Cadastro, só o admin; Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo
// usado no sistema, botões e funcionalidades para sabermos o que está 'inútil'"; refeita em 21/10/2026, com os botões
// coloridos): o período (7, 30 ou 90 dias), os números, a lista de todas as telas (as usadas, do mais visitado ao
// menos, e as nunca abertas no fim), a tela escolhida com os botões pintados pelo calor e o mapa dos cliques, o
// "possivelmente inútil" e quem mais usa. "Ver na tela" liga o mapa na tela (casca/estadoDoMapaNaTela.ts) e abre a tela de
// verdade com os botões pintados. Os dias são lidos uma vez ao abrir ou trocar o período (sem ficar ouvindo).
import { uso } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ligarMapaNaTela } from '../../casca/estadoDoMapaNaTela';
import { BASE, telasDaNavegacao } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { useUso } from '../../dados/repo';

export type PeriodoDoUso = '7' | '30' | '90';
export const PERIODOS_DO_USO: { valor: PeriodoDoUso; rotulo: string }[] = [
  { valor: '7', rotulo: '7 dias' }, { valor: '30', rotulo: '30 dias' }, { valor: '90', rotulo: '90 dias' },
];
export type FiltroDasTelas = 'todas' | 'usadas' | 'sem-uso';
export const FILTROS_DAS_TELAS: { valor: FiltroDasTelas; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' }, { valor: 'usadas', rotulo: 'Usadas' }, { valor: 'sem-uso', rotulo: 'Sem uso' },
];
const DEPARTAMENTOS: Record<string, string> = { fiscal: 'Fiscal', contabil: 'Contábil', dp: 'DP', admin: 'Admin' };

/** onde abrir a tela (a janela da empresa e o executor precisam de uma empresa: abrem a lista, e dali se escolhe) */
export function caminhoDaTela(tela: string): string {
  if (tela === 'inicio') return BASE;
  if (tela.startsWith('cadastro/empresas/')) return BASE + '/cadastro/empresas';
  if (tela === 'minhas-empresas/empresa' || tela === 'executar') return BASE + '/minhas-empresas/empresas';
  return BASE + '/' + tela;
}

export function useUsoDoSistema() {
  const repo = useUso();
  const admin = !!useOperador().operador?.admin;
  const { toast } = useRetorno();
  const navegar = useNavigate();
  const [periodo, setPeriodo] = useState<PeriodoDoUso>('30');
  const [filtro, setFiltro] = useState<FiltroDasTelas>('todas');
  const [vez, setVez] = useState(0);
  const [lido, setLido] = useState<{ carregando: boolean; dias: uso.UsoDoDia[]; erro: string }>({ carregando: true, dias: [], erro: '' });
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const navegacao = useMemo(() => telasDaNavegacao(), []);
  useEffect(() => {
    let vale = true;
    setLido(l => ({ ...l, carregando: true, erro: '' }));
    repo.dias(uso.diasDoPeriodo(Number(periodo), new Date()), navegacao).then(
      dias => { if (vale) setLido({ carregando: false, dias, erro: '' }); },
      (e: Error) => { if (vale) setLido({ carregando: false, dias: [], erro: e.message }); },
    );
    return () => { vale = false; };
  }, [repo, periodo, navegacao, vez]);
  const soma = useMemo(() => uso.somarUso(lido.dias, navegacao), [lido.dias, navegacao]);
  const visitadas = soma.telas.filter(t => t.visitas > 0);
  const maiorVisita = Math.max(1, ...visitadas.map(t => t.visitas));
  // a lista: as usadas (da mais visitada à menos) e, no fim, as nunca abertas
  const todas = [
    ...visitadas.map(t => ({ tela: t.tela, rotulo: t.rotulo, visitas: t.visitas, cliques: t.cliques, semClique: t.semClique.length, nivel: uso.nivelDoCalor(t.visitas, maiorVisita), pct: (t.visitas / maiorVisita) * 100 })),
    ...soma.nuncaVisitadas.map(n => ({ tela: n.tela, rotulo: n.rotulo, visitas: 0, cliques: 0, semClique: 0, nivel: 0 as uso.NivelDoCalor, pct: 0 })),
  ];
  const lista = filtro === 'usadas' ? todas.filter(t => t.visitas > 0) : filtro === 'sem-uso' ? todas.filter(t => t.visitas === 0) : todas;
  const nomeDaEscolhida = escolhida && todas.some(t => t.tela === escolhida) ? escolhida : todas[0]?.tela || null;
  const somada = soma.telas.find(t => t.tela === nomeDaEscolhida) || null;
  const daNavegacao = navegacao.find(n => n.tela === nomeDaEscolhida) || null;
  const maiorClique = Math.max(0, ...(somada?.controles.map(c => c.cliques) || []));
  const ligado = repo.ligado();
  // as telas com botão sem clique (as que mais têm primeiro)
  const semCliquePorTela = soma.telas.filter(t => t.semClique.length).map(t => ({ tela: t.tela, rotulo: t.rotulo, controles: t.semClique }))
    .sort((a, b) => b.controles.length - a.controles.length);
  return {
    exemplos: repo.exemplos,
    admin,
    carregando: lido.carregando,
    // sem a regra do banco para uso/ (ainda não publicada), a leitura é recusada
    erro: lido.erro ? (/permission|insufficient/i.test(lido.erro) ? 'O banco ainda não deixa ler o uso (a regra de uso/ não foi publicada).' : 'Não consegui ler o uso: ' + lido.erro + '.') : '',
    periodo, setPeriodo, periodos: PERIODOS_DO_USO,
    filtro, setFiltro, filtros: FILTROS_DAS_TELAS,
    recarregar: () => setVez(v => v + 1),
    /** o interruptor da coleta (config/uso; só o admin muda) */
    coletando: ligado.ligado,
    async alternarColeta() {
      try { await repo.ligar(!ligado.ligado); toast(ligado.ligado ? 'A coleta do uso foi desligada.' : 'A coleta do uso foi ligada: grava a cada 5 minutos.'); }
      catch (e) { toast('Não gravou: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** a estimativa de gravações no banco por dia, para 10 pessoas (cada uma grava no máximo a cada 5 minutos) */
    estimativa: uso.gravacoesPorDia(10),
    numeros: { visitas: soma.visitas, cliques: soma.cliques, telasUsadas: visitadas.length, nuncaVisitadas: soma.nuncaVisitadas.length, semClique: soma.possivelmenteInutil.controles.length, dias: soma.dias },
    lista,
    contagem: { todas: todas.length, usadas: visitadas.length, semUso: soma.nuncaVisitadas.length },
    escolher: setEscolhida,
    /** a tela escolhida: os botões pintados pelo calor (os com clique e os sem), quem usa e o mapa dos cliques */
    tela: nomeDaEscolhida ? {
      tela: nomeDaEscolhida,
      rotulo: somada?.rotulo || daNavegacao?.rotulo || nomeDaEscolhida,
      visitas: somada?.visitas || 0,
      cliques: somada?.cliques || 0,
      botoes: (somada?.controles || []).map(c => ({ ...c, nivel: uso.nivelDoCalor(c.cliques, maiorClique) })),
      semClique: somada?.semClique || [],
      grade: somada?.grade || {},
      maiorCelula: somada?.maiorCelula || 0,
      departamentos: (somada?.departamentos || []).map(d => ({ ...d, rotulo: DEPARTAMENTOS[d.nome] || d.nome })),
    } : null,
    /** abre a tela de verdade com o mapa ligado (os botões pintados) */
    verNaTela(tela: string) {
      ligarMapaNaTela(periodo);
      navegar(caminhoDaTela(tela));
    },
    semCliquePorTela,
    nuncaVisitadas: soma.nuncaVisitadas,
    pessoas: soma.pessoas.slice(0, 8).map(p => ({ ...p, pct: (p.total / Math.max(1, soma.pessoas[0]?.total || 1)) * 100 })),
  };
}
