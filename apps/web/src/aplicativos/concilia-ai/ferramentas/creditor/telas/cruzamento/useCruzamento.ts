// ViewModel da etapa Cruzamento: cada título com a linha do sistema achada pela NF, a situação e,
// quando há divergência, a decisão da pessoa (nunca presumimos qual lado está certo).
import { creditor as cr } from '@nads/core';
import { useState } from 'react';
import { useSessao } from '../../casca/sessao';

export type Filtro = 'todos' | 'decidir' | 'avisos';

export const ROTULO_SITUACAO: Record<cr.SituacaoCruzamento, string> = {
  ok: 'Ok', dividido: 'Duplicatas juntas', 'valor-diverge': 'Valor diverge', 'cliente-diverge': 'Cliente diverge', 'nao-encontrada': 'NF não encontrada',
};

export function useCruzamento() {
  const s = useSessao();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const porId = new Map(s.d.titulos.map(t => [t.id, t]));
  const decidir = (id: number, d: cr.Decisao | null) => s.mudar(e => {
    const decisoes = { ...e.decisoes };
    if (d) decisoes[id] = d; else delete decisoes[id];
    return { ...e, decisoes };
  });

  const linhas = s.d.cruzamentos.map(c => {
    const t = porId.get(c.tituloId) as cr.Titulo;
    const decisao = s.estado.decisoes[c.tituloId];
    const precisa = cr.precisaDecisao(c);
    return {
      id: c.tituloId, nf: t.nf, liquidacao: t.liquidacao, sacado: t.sacado, cliente: c.linha?.cliente || '',
      valorBanco: c.valorBanco, valorSistema: c.valorSistema,
      contrapartida: decisao?.tipo === 'manual' ? decisao.contrapartida : c.linha?.contrapartida || '',
      situacao: c.situacao, rotulo: ROTULO_SITUACAO[c.situacao], nota: c.nota,
      precisa, resolvida: precisa && cr.decisaoValida(c, decisao), decisao, temLinha: !!c.linha,
      historicoPadrao: cr.historicoNfCliente(t),
    };
  });

  const visiveis = linhas.filter(l => filtro === 'todos' || (filtro === 'decidir' ? l.precisa : l.situacao !== 'ok'));
  const conta = (f: (l: (typeof linhas)[number]) => boolean) => linhas.filter(f).length;

  return {
    linhas: visiveis,
    filtro, setFiltro,
    resumo: {
      ok: conta(l => l.situacao === 'ok'),
      divididos: conta(l => l.situacao === 'dividido'),
      decidir: conta(l => l.precisa),
      pendentes: s.d.pendentes.length,
      excluidos: conta(l => l.decisao?.tipo === 'excluir'),
    },
    confirmar: (id: number) => decidir(id, { tipo: 'confirmar' }),
    excluir: (id: number) => decidir(id, { tipo: 'excluir' }),
    desfazer: (id: number) => decidir(id, null),
    manual: (id: number, campo: 'contrapartida' | 'historico', v: string) => {
      const atual = s.estado.decisoes[id];
      const base = atual?.tipo === 'manual' ? atual : { tipo: 'manual' as const, contrapartida: '', historico: '' };
      decidir(id, { ...base, [campo]: v.trim() });
    },
    podeContinuar: s.d.pendentes.length === 0 && linhas.length > 0,
    continuar: s.proxima,
    voltar: s.anterior,
  };
}
