// ViewModel da etapa Contas: a conta (contrapartida) de cada título, que vem da conta aprendida do
// cliente ou do balancete (2026-09-29: sem arquivo do sistema; o banco manda no valor e no cliente).
// Sem conta achada, a pessoa informa (com as contas de clientes do balancete como sugestão) ou exclui
// o título; a conta informada fica aprendida quando o arquivo é baixado.
import { creditor as cr } from '@nads/core';
import { useEffect, useState } from 'react';
import { useModoDesenvolvedor } from '../../../../../../comum/modoDesenvolvedor';
import { useSessao } from '../../casca/sessao';

/** Todos ou Pendentes (Vitor, 05/10/2026: no dropdown; Pendentes apagado quando não tem) */
export type Filtro = 'todos' | 'pendentes';

export const ROTULO_SITUACAO: Record<cr.SituacaoCruzamento, string> = {
  ok: 'Ok', dividido: 'Duplicatas juntas', 'valor-diverge': 'Valor diverge', 'cliente-diverge': 'Cliente diverge', 'nao-encontrada': 'Sem conta',
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
    const decisao = s.d.decisoes[c.tituloId];
    // o sem conta se resolve na etapa Contas (Vitor, 14/10/2026); aqui só os que divergem
    const precisa = cr.precisaDecisao(c) && c.situacao !== 'nao-encontrada';
    return {
      id: c.tituloId, nf: t.nf, liquidacao: t.liquidacao, sacado: t.sacado, nomeDaConta: c.linha?.cliente || '',
      valorBanco: c.valorBanco,
      contrapartida: decisao?.tipo === 'manual' ? decisao.contrapartida : c.linha?.contrapartida || '',
      situacao: c.situacao, rotulo: ROTULO_SITUACAO[c.situacao], nota: c.nota,
      precisa, resolvida: precisa && cr.decisaoValida(c, decisao), decisao, aprendida: !!c.aprendida,
      historicoPadrao: cr.historicoNfCliente(t),
      /** filiais de nome igual: as contas para escolher com um clique */
      opcoes: c.opcoes || [],
    };
  });

  const filtradas = linhas.filter(l => filtro === 'todos' || l.precisa);
  const conta = (f: (l: (typeof linhas)[number]) => boolean) => linhas.filter(f).length;
  // os sem configurar em primeiro e 25 por página (Vitor, 18/11/2026: "deixa menos, 25, faz paginacao"; "os sem configurar em
  // prioridade"): por enquanto só no modo desenvolvedor
  const [dev] = useModoDesenvolvedor();
  const peso = (l: (typeof linhas)[number]) => (l.precisa && !l.resolvida ? 0 : l.situacao !== 'ok' ? 1 : 2);
  const ordenadas = dev ? filtradas.map((l, i) => ({ l, i })).sort((a, b) => peso(a.l) - peso(b.l) || a.i - b.i).map(x => x.l) : filtradas;
  const POR_PAGINA = 25;
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  useEffect(() => { setPagina(0); }, [filtro]);
  const atual = Math.min(pagina, paginas - 1);
  const visiveis = dev ? ordenadas.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA) : ordenadas;

  return {
    linhas: visiveis,
    /** a paginação (modo desenvolvedor): a página (0…), quantas, o total e o trecho mostrado */
    paginacao: dev && ordenadas.length > POR_PAGINA ? { pagina: atual, paginas, total: ordenadas.length, de: atual * POR_PAGINA + 1, ate: Math.min((atual + 1) * POR_PAGINA, ordenadas.length), irPara: (n: number) => setPagina(Math.max(0, Math.min(paginas - 1, n))) } : null,
    filtro, setFiltro,
    /** as contas de clientes do balancete, para o campo sugerir enquanto digita */
    contasClientes: s.contas.clientes,
    semBalancete: s.contas.carregada && s.contas.balancete.origem === 'nenhum',
    resumo: {
      ok: conta(l => l.situacao === 'ok'),
      decidir: conta(l => l.precisa),
      pendentes: s.d.pendentes.length,
      excluidos: conta(l => l.decisao?.tipo === 'excluir'),
      aprendidas: conta(l => l.aprendida),
    },
    excluir: (id: number) => decidir(id, { tipo: 'excluir' }),
    desfazer: (id: number) => decidir(id, null),
    manual: (id: number, campo: 'contrapartida' | 'historico', v: string) => {
      const atual = s.d.decisoes[id];
      const base = atual?.tipo === 'manual' ? atual : { tipo: 'manual' as const, contrapartida: '', historico: '' };
      decidir(id, { ...base, [campo]: v.trim() });
    },
    voltar: s.anterior,
  };
}
