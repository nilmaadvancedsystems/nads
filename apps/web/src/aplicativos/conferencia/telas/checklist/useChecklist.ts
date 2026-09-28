// ViewModel do Movimento › Checklist ("Naturezas de CFOP"): recorte Todos/Entradas/Saídas,
// filtro de situação, chip do CFOP, marcar/desmarcar e a marcação automática.
// Origem: conferencia.html renderChecklistNatureza (~L3080-3150), cliques de #natSeg e
// data-cc-busca (~L3386-3412), change de cc-status-sel (~L3413) e de data-cc-marca
// (~L3678-3699), aplicarBloqueios (~L1843-1861: #natSeg e o ccState.tipo que perde os dados).
import { conferencia as c, formatos } from '@nads/core';
import { useEffect } from 'react';
import { travaDaAba, useMarcarSozinho } from '../relatorio/movimento';
import { useSessao } from '../../casca/sessao';

type TipoNat = c.FiltroMovimento['tipo'];
type Status = c.FiltroMovimento['status'];

export const OPCOES_STATUS: [Status, string][] = [['', 'Todas'], ['pendente', 'Pendentes'], ['conferido', 'Conferidos']];

/** Tempo da animação de riscar (.45s + .1s de atraso no CSS). */
const TEMPO_ANIMA = 600;

export function useChecklist() {
  const s = useSessao();
  const e = s.empresa;
  const tem = c.disponivel(e);

  // recorte travado (sem dados daquele tipo) volta pra Todos
  const perdeu = (s.filtro.tipo === 'Entrada' && !tem.entradas) || (s.filtro.tipo === 'Saída' && !tem.saidas);
  const filtro: c.FiltroMovimento = perdeu ? { ...s.filtro, tipo: '' } : s.filtro;
  const { setFiltro } = s;
  useEffect(() => { if (perdeu) setFiltro(f => ({ ...f, tipo: '' })); }, [perdeu, setFiltro]);

  const recortes: { valor: TipoNat; rotulo: string; travada: string | false }[] = [
    { valor: '', rotulo: 'Todos', travada: false },
    { valor: 'Entrada', rotulo: 'Entradas', travada: travaDaAba(tem, 'entradas') },
    { valor: 'Saída', rotulo: 'Saídas', travada: travaDaAba(tem, 'saidas') },
  ];
  function escolherRecorte(v: TipoNat) {
    const r = recortes.find(x => x.valor === v);
    if (r?.travada) { s.avisoImportar(v === 'Entrada' ? 'entradas' : 'saidas'); return; }
    s.setFiltro(f => ({ ...f, tipo: v }));
  }

  const lista = c.montarChecklist(e, filtro);
  useMarcarSozinho(lista.marcarSozinho);

  // a animação de riscar roda uma vez, na linha que acabou de ser marcada
  const { natAnimar, setNatAnimar } = s;
  useEffect(() => {
    if (!natAnimar) return;
    const t = setTimeout(() => setNatAnimar(null), TEMPO_ANIMA);
    return () => clearTimeout(t);
  }, [natAnimar, setNatAnimar]);

  function marcar(l: c.LinhaChecklist, marcado: boolean) {
    s.setNatAnimar(marcado ? l.marca : null);
    s.aplicar(x => c.marcarNatureza(x, l.marca, marcado, l.titulo, new Date()));
  }

  const meses = c.mesesMarcados(filtro);

  return {
    recortes, tipo: filtro.tipo, escolherRecorte,
    status: filtro.status, setStatus: (v: Status) => s.setFiltro(f => ({ ...f, status: v })),
    busca: filtro.busca, limparBusca: () => s.setFiltro(f => ({ ...f, busca: '' })),
    mesesMarcados: meses.length ? meses.map(formatos.mesCurto).join(', ') : '',
    linhas: lista.linhas.map(l => ({
      ...l,
      anima: l.marcado && l.marca === natAnimar,
      contaTexto: l.contas.length ? 'Conta: ' + l.contas.join(' · ') : l.naoContabil ? 'Não vai para o Contábil' : 'Sem conta vinculada — Cadastro',
    })),
    vazio: lista.linhas.length ? '' : lista.temNaturezas ? 'Nenhum grupo bate com os filtros.' : 'Nenhuma nota guardada nesse período.',
    marcar,
  };
}
