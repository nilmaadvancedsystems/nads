// ViewModel do Uso do sistema (Cadastro, só o admin; Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo
// usado no sistema, botões e funcionalidades para sabermos o que está 'inútil'"): o período (7, 30 ou 90 dias), as
// telas mais e menos visitadas, as da navegação nunca visitadas, por tela os controles (com e sem clique), quem usa e o
// mapa quente, e o "possivelmente inútil". Os dias são lidos uma vez ao abrir ou trocar o período (sem ficar ouvindo).
import { uso } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { telasDaNavegacao } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { useUso } from '../../dados/repo';

export type PeriodoDoUso = '7' | '30' | '90';
export const PERIODOS_DO_USO: { valor: PeriodoDoUso; rotulo: string }[] = [
  { valor: '7', rotulo: '7 dias' }, { valor: '30', rotulo: '30 dias' }, { valor: '90', rotulo: '90 dias' },
];
const DEPARTAMENTOS: Record<string, string> = { fiscal: 'Fiscal', contabil: 'Contábil', dp: 'DP', admin: 'Admin' };

export function useUsoDoSistema() {
  const repo = useUso();
  const admin = !!useOperador().operador?.admin;
  const { toast } = useRetorno();
  const [periodo, setPeriodo] = useState<PeriodoDoUso>('30');
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
  const maior = Math.max(1, ...visitadas.map(t => t.visitas));
  const tela = soma.telas.find(t => t.tela === escolhida) || soma.telas[0] || null;
  const ligado = repo.ligado();
  return {
    exemplos: repo.exemplos,
    admin,
    carregando: lido.carregando,
    // sem a regra do banco para uso/ (ainda não publicada), a leitura é recusada
    erro: lido.erro ? (/permission|insufficient/i.test(lido.erro) ? 'O banco ainda não deixa ler o uso (a regra de uso/ não foi publicada).' : 'Não consegui ler o uso: ' + lido.erro + '.') : '',
    periodo, setPeriodo, periodos: PERIODOS_DO_USO,
    recarregar: () => setVez(v => v + 1),
    /** o interruptor da coleta (config/uso; só o admin muda) */
    coletando: ligado.ligado,
    interruptorCarregado: ligado.carregado,
    async alternarColeta() {
      try { await repo.ligar(!ligado.ligado); toast(ligado.ligado ? 'A coleta do uso foi desligada.' : 'A coleta do uso foi ligada: grava a cada 5 minutos.'); }
      catch (e) { toast('Não gravou: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** a estimativa de gravações no banco por dia, para 10 pessoas (cada uma grava no máximo a cada 5 minutos) */
    estimativa: uso.gravacoesPorDia(10),
    numeros: { visitas: soma.visitas, cliques: soma.cliques, telasUsadas: visitadas.length, nuncaVisitadas: soma.nuncaVisitadas.length, dias: soma.dias },
    maisVisitadas: visitadas.slice(0, 10).map(t => ({ tela: t.tela, rotulo: t.rotulo, visitas: t.visitas, pct: (t.visitas / maior) * 100 })),
    menosVisitadas: [...visitadas].reverse().slice(0, 10).map(t => ({ tela: t.tela, rotulo: t.rotulo, visitas: t.visitas, pct: (t.visitas / maior) * 100 })),
    nuncaVisitadas: soma.nuncaVisitadas,
    pessoas: soma.pessoas.slice(0, 10).map(p => ({ ...p, pct: (p.total / Math.max(1, soma.pessoas[0]?.total || 1)) * 100 })),
    possivelmenteInutil: soma.possivelmenteInutil,
    telas: soma.telas.map(t => ({ valor: t.tela, rotulo: t.rotulo })),
    escolher: setEscolhida,
    /** a tela escolhida: os controles, os sem clique, quem usa e o mapa quente */
    tela: tela ? {
      ...tela,
      controles: tela.controles.map(c => ({ ...c, pct: tela.cliques ? Math.round((c.cliques / tela.cliques) * 100) : 0 })),
      departamentos: tela.departamentos.map(d => ({ ...d, rotulo: DEPARTAMENTOS[d.nome] || d.nome })),
    } : null,
  };
}
