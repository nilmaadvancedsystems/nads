// ViewModel da Consulta de notas (Movimento › Consulta): abas Fiscais/Serviços com trava,
// busca, período, ordenação, limite de linhas e o CSV do topo.
// Origem: conferencia.html consAba (~L3382), aplicarBloqueios (~L1845-1861), renderConsulta
// (~L3018-3070), limpar período/busca (~L3071-3078), notasPesquisar/Enter/ordenar (~L3269-3292),
// Baixar CSV (~L1980, ~L3294-3303).
import { conferencia as c, formatos } from '@nads/core';
import { useEstadoPorChave } from '@nads/ui';
import { useState } from 'react';
import { useSessao } from '../../casca/sessao';

const TRAVA: Record<c.GrupoConsulta, string> = {
  fiscais: 'Importe as entradas ou saídas primeiro',
  servicos: 'Importe os serviços primeiro',
};

export function useConsulta() {
  const s = useSessao();
  const e = s.empresa;
  const tem = c.disponivel(e);

  // o recorte aberto sem dados volta pra um que tem (aplicarBloqueios)
  const aba: c.GrupoConsulta = tem[s.abaConsulta] ? s.abaConsulta : tem.fiscais || !tem.servicos ? 'fiscais' : 'servicos';
  const serv = aba === 'servicos';
  const f = s.filtroConsulta[aba];

  // o que está digitado nos campos só vale depois de Filtrar/Enter; redesenhar volta ao aplicado
  const [seq, setSeq] = useState(0);
  const chave = [aba, f.q, f.de, f.ate, f.sortCol, f.sortDir, seq].join('|');
  const [rascunho, setRascunho] = useEstadoPorChave(chave, { q: f.q, de: f.de, ate: f.ate });

  const abas = (['fiscais', 'servicos'] as const).map(g => ({
    valor: g, rotulo: g === 'fiscais' ? 'Fiscais' : 'Serviços', travada: tem[g] ? (false as const) : TRAVA[g],
  }));

  function escolherAba(g: c.GrupoConsulta) {
    if (!tem[g]) { s.avisoImportar(g); return; }
    s.setAbaConsulta(g);
  }

  function aplicar(novo: c.FiltroConsulta) {
    s.setFiltroConsulta(aba, novo);
    setSeq(x => x + 1);
  }

  function pesquisar() {
    aplicar({ ...f, de: rascunho.de.length === 10 ? rascunho.de : '', ate: rascunho.ate.length === 10 ? rascunho.ate : '', q: rascunho.q });
  }

  const todas = c.listaConsulta(e, aba);
  const lista = todas.length ? c.filtrarConsulta(todas, f) : [];
  const total = lista.reduce((soma, n) => soma + n.valor, 0);

  function csv(): { texto: string; nome: string } {
    const l = c.filtrarConsultaSemOrdem(c.listaConsulta(e, aba), f);
    return { texto: formatos.montarCsv(c.csvConsulta(l, aba)), nome: c.nomeCsvConsulta(aba, s.nome) };
  }

  return {
    aba, abas, escolherAba, serv,
    vazia: !todas.length,
    rascunho,
    setBusca: (q: string) => setRascunho(r => ({ ...r, q })),
    setDe: (de: string) => setRascunho(r => ({ ...r, de })),
    setAte: (ate: string) => setRascunho(r => ({ ...r, ate })),
    pesquisar,
    temBusca: !!f.q,
    temPeriodo: !!(f.de || f.ate),
    limparBusca: () => aplicar({ ...f, q: '' }),
    limparPeriodo: () => aplicar({ ...f, de: '', ate: '' }),
    ordem: { col: f.sortCol, dir: f.sortDir },
    ordenar: (campo: c.CampoOrdem) => aplicar(c.alternarOrdem(f, campo)),
    qtd: lista.length,
    qtdTotal: todas.length,
    filtrado: lista.length !== todas.length,
    total,
    linhas: lista.slice(0, c.LIMITE_LINHAS_CONSULTA),
    limite: c.LIMITE_LINHAS_CONSULTA,
    tipos: c.CONS_TIPOS,
    csv,
  };
}
