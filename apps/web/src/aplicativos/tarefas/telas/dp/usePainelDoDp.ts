// ViewModel do Painel do DP (Vitor, 06/10/2026: o Checklist Folha "no nads, de maneira que entrasse no visual"): os
// clientes da planilha do DP na competência — os números do topo, as barras (por responsável, enquadramento e
// movimento), o progresso de cada responsável e a tabela com as obrigações de cada cliente. O status sai da rotina do
// DP (o que foi feito em cada etapa), não de um tique no navegador: todo mundo vê o mesmo, mês a mês.
// Tudo roda no tabelão (Vitor, 06/10/2026: "quero que tudo rode no tabelão, sem a parte de checklist"): clicar na
// bolinha da obrigação marca a etapa como feita (com quem e quando, como o executor grava); clicar de novo desfaz.
import { empresas, tarefas as t } from '@nads/core';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { useExecucoes, useRepo } from '../../dados/repo';
import { useClientesDoDp } from './useClientesDoDp';

/** Como cada obrigação está no mês: não tem, a fazer, feita, parada. */
export type EstadoDaObrigacao = 'nao-tem' | 'a-fazer' | 'feita' | 'parada';
export type Agrupar = 'nenhum' | 'responsavel' | 'agrupamento';

/**
 * As abas do DP (Vitor, 06/10/2026: "quebre o tabelão em submenus no estilo GitHub"): o Resumo (números, gráficos e o
 * progresso) e uma por parte da rotina, cada uma só com as colunas dela.
 */
export type AbaDoPainel = 'resumo' | 'obrigacoes';
export const ABAS_DO_PAINEL: readonly AbaDoPainel[] = ['resumo', 'obrigacoes'];
/** As partes da rotina: o submenu da aba Obrigações (na URL: ?parte=). */
export type ParteDoDp = 'folha' | 'esocial' | 'guias' | 'reinf' | 'entrega';
const PARTES_DO_DP: readonly { id: ParteDoDp; rotulo: string; obrigacoes: readonly string[] }[] = [
  { id: 'folha', rotulo: 'Folha', obrigacoes: ['recibos', 'folha'] },
  { id: 'esocial', rotulo: 'eSocial', obrigacoes: ['s1200', 's1210', 's1299'] },
  { id: 'guias', rotulo: 'Guias', obrigacoes: ['dctfweb', 'darf', 'fgts'] },
  { id: 'reinf', rotulo: 'REINF', obrigacoes: ['reinf'] },
  { id: 'entrega', rotulo: 'Entrega', obrigacoes: ['envio'] },
];

const SEM_RESPONSAVEL = 'Sem responsável';
const contar = (xs: readonly string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].map(([rotulo, qtd]) => ({ rotulo, qtd })).sort((a, b) => b.qtd - a.qtd || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
};
// o nome da planilha (em maiúsculas) como se escreve: FABIANA → Fabiana; GUSTAVO.P → Gustavo.P
const nomeDe = (r: string) => (r ? r.split('.').map(p => p.charAt(0) + p.slice(1).toLowerCase()).join('.') : SEM_RESPONSAVEL);

export function usePainelDoDp(aba: AbaDoPainel = 'resumo') {
  const repo = useRepo();
  const op = useOperador().operador as Operador;
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const { execucoes, carregada } = useExecucoes(competencia, 'dp');
  const porNome = new Map(execucoes.map(e => [e.empresa, e]));
  const doDp = useClientesDoDp();

  const [busca, setBusca] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [movimento, setMovimento] = useState('');
  const [enquadramento, setEnquadramento] = useState('');
  const [status, setStatus] = useState<'' | 'concluidas' | 'pendentes'>('');
  const [agrupamento, setAgrupamento] = useState('');
  const [agrupar, setAgrupar] = useState<Agrupar>('nenhum');

  // os clientes como valem hoje (a planilha com o que mudou no Cadastro e nas Configurações do DP)
  const todas = doDp.clientes.map(c => {
    const ex = porNome.get(c.nomeNaTela) || null;
    const temAlguma = c.obrigacoes.length > 0;
    const estadoDe = (etapa: string, tem: boolean): EstadoDaObrigacao => {
      if (!tem) return 'nao-tem';
      const est = t.estadoDa(ex, etapa);
      return est?.situacao === 'feita' || est?.situacao === 'dispensada' ? 'feita' : est?.situacao === 'interrompida' ? 'parada' : 'a-fazer';
    };
    // as obrigações e, no fim, o Entregue (a entrega ao cliente fecha o mês)
    const obrigacoes = [
      ...empresas.OBRIGACOES_DP.map(o => ({ id: o.id as string, etapa: 'dp-' + o.id, estado: estadoDe('dp-' + o.id, c.obrigacoes.includes(o.id)) })),
      // a REINF, para quem tem a REINF autorizada ("faltou a reinf")
      { id: 'reinf', etapa: 'dp-reinf', estado: estadoDe('dp-reinf', c.reinfAutorizada) },
      { id: 'envio', etapa: 'dp-envio', estado: estadoDe('dp-envio', temAlguma) },
    ].map(o => {
      const est = t.estadoDa(ex, o.etapa);
      return { ...o, quem: est && o.estado === 'feita' ? est.por + ' em ' + new Date(est.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '' };
    });
    // a situação pelo que a tabela mostra: todas as obrigações que o cliente tem (e o Entregue) feitas = concluída
    const tem = obrigacoes.filter(o => o.estado !== 'nao-tem');
    const feitas = tem.filter(o => o.estado === 'feita').length;
    const parada = tem.some(o => o.estado === 'parada');
    const concluida = !temAlguma || feitas === tem.length;
    const situacao: t.SituacaoGeral = concluida ? 'concluida' : parada ? 'parada' : feitas > 0 ? 'em-andamento' : 'nao-iniciada';
    return {
      ...c, chave: String(c.codigo), responsavelNome: nomeDe(c.responsavel), ex,
      obrigacoes, concluida, temAlguma,
      situacao: !temAlguma ? 'Nada no mês' : t.ROTULO_SITUACAO_GERAL[situacao], parada,
    };
  });

  const achadas = busca.trim() ? new Set(empresas.buscarEmpresas(todas.map(c => ({ codigo: c.codigo, nome: c.nomeNaTela, regime: c.enquadramento })), busca).map(e => e.codigo)) : null;
  const filtradas = todas.filter(c => (!achadas || achadas.has(c.codigo)) && (!responsavel || c.responsavelNome === responsavel)
    && (!movimento || c.movimento === movimento) && (!enquadramento || c.enquadramento === enquadramento)
    && (!agrupamento || c.agrupamento === agrupamento) && (!status || (status === 'concluidas') === c.concluida))
    .sort((a, b) => a.nomeNaTela.localeCompare(b.nomeNaTela, 'pt-BR'));

  // a tabela em grupos (por responsável ou agrupamento), cada um com quantos já fecharam
  const chaveDoGrupo = (c: (typeof todas)[number]) => (agrupar === 'responsavel' ? c.responsavelNome : agrupar === 'agrupamento' ? c.agrupamento || 'Sem agrupamento' : '');

  // fora do Resumo: só os clientes que têm a parte, com as colunas dela e a situação só dela
  const parte = aba === 'obrigacoes' ? PARTES_DO_DP.find(p => p.id === params.get('parte')) || PARTES_DO_DP[0] : null;
  const faltaNa = (c: (typeof todas)[number], p: (typeof PARTES_DO_DP)[number]) =>
    c.obrigacoes.some(o => p.obrigacoes.includes(o.id) && o.estado !== 'nao-tem' && o.estado !== 'feita');
  const linhasDaParte = parte ? filtradas.flatMap(c => {
    const minhas = c.obrigacoes.filter(o => parte.obrigacoes.includes(o.id) && o.estado !== 'nao-tem');
    if (!minhas.length) return [];
    const feitas = minhas.filter(o => o.estado === 'feita').length;
    const parada = minhas.some(o => o.estado === 'parada');
    return [{
      ...c, obrigacoes: c.obrigacoes.filter(o => parte.obrigacoes.includes(o.id)), concluida: feitas === minhas.length, parada,
      situacao: feitas === minhas.length ? 'Feito' : parada ? 'Parada' : feitas ? 'Falta ' + (minhas.length - feitas) : 'A fazer',
    }];
  }) : filtradas;
  const mudarParam = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor); else novo.delete(chave);
    setParams(novo);
  };

  const concluidas = filtradas.filter(c => c.concluida).length;
  const responsaveis = contar(todas.map(c => c.responsavelNome)).map(r => r.rotulo);

  return {
    carregando: !carregada || !doDp.carregado,
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => mudarParam('competencia', c),
    resumo: !parte,
    /** o submenu das Obrigações: cada parte com quantos clientes ainda faltam nela */
    parte: parte ? parte.id : null,
    partes: PARTES_DO_DP.map(p => {
      const n = filtradas.filter(c => faltaNa(c, p)).length;
      return { valor: p.id, rotulo: p.rotulo + (n ? ' · ' + n : '') };
    }),
    setParte: (p: ParteDoDp) => mudarParam('parte', p === PARTES_DO_DP[0].id ? '' : p),
    tituloDaParte: parte ? parte.rotulo : '',
    /** quantos clientes ainda faltam nesta parte */
    faltam: linhasDaParte.filter(c => !c.concluida).length,
    numeros: [
      { rotulo: 'Clientes', valor: filtradas.length, dica: '' },
      { rotulo: 'Concluídos', valor: concluidas, dica: filtradas.length ? Math.round((concluidas / filtradas.length) * 100) + '% do mês' : '' },
      { rotulo: 'Pendentes', valor: filtradas.length - concluidas, dica: '' },
      { rotulo: 'Com folha', valor: filtradas.filter(c => c.movimento === 'Folha').length, dica: '' },
      { rotulo: 'Pró-labore', valor: filtradas.filter(c => c.movimento === 'Pró-Labore').length, dica: '' },
      { rotulo: 'Sem movimento', valor: filtradas.filter(c => c.movimento === 'Sem Movimento').length, dica: '' },
      { rotulo: 'REINF autorizada', valor: filtradas.filter(c => c.reinfAutorizada).length, dica: '' },
    ],
    barras: [
      { titulo: 'Por responsável', linhas: contar(filtradas.map(c => c.responsavelNome)) },
      { titulo: 'Enquadramento', linhas: contar(filtradas.map(c => c.enquadramento)) },
      { titulo: 'Movimento', linhas: contar(filtradas.map(c => c.movimento)) },
    ],
    progresso: responsaveis.map(r => {
      const deles = filtradas.filter(c => c.responsavelNome === r);
      const feitos = deles.filter(c => c.concluida).length;
      return { nome: r, total: deles.length, feitos, pct: deles.length ? Math.round((feitos / deles.length) * 100) : 0, parados: deles.filter(c => c.parada).length };
    }).filter(r => r.total > 0),
    colunas: [...empresas.OBRIGACOES_DP.map(o => ({ id: o.id as string, rotulo: o.rotulo, nome: o.nome })), { id: 'reinf', rotulo: 'REINF', nome: 'EFD-REINF' }, { id: 'envio', rotulo: 'Entregue', nome: 'Entrega ao cliente' }]
      .filter(o => !parte || parte.obrigacoes.includes(o.id)),
    grupos: agrupar === 'nenhum'
      ? [{ nome: '', linhas: linhasDaParte, feitas: 0 }]
      : [...new Set(linhasDaParte.map(chaveDoGrupo))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(nome => {
        const linhas = linhasDaParte.filter(c => chaveDoGrupo(c) === nome);
        return { nome, linhas, feitas: linhas.filter(c => c.concluida).length };
      }),
    quantas: linhasDaParte.length,
    filtros: {
      busca, setBusca, responsavel, setResponsavel, movimento, setMovimento, enquadramento, setEnquadramento,
      status, setStatus, agrupamento, setAgrupamento, agrupar, setAgrupar,
      responsaveis,
      movimentos: contar(todas.map(c => c.movimento)).map(x => x.rotulo),
      enquadramentos: contar(todas.map(c => c.enquadramento)).map(x => x.rotulo),
      agrupamentos: contar(todas.map(c => c.agrupamento).filter(Boolean)).map(x => x.rotulo).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      algum: !!(busca || responsavel || movimento || enquadramento || status || agrupamento),
      limpar: () => { setBusca(''); setResponsavel(''); setMovimento(''); setEnquadramento(''); setStatus(''); setAgrupamento(''); },
    },
    /** a bolinha da obrigação: a fazer → feita; feita → volta a fazer (grava com quem e quando, como o executor) */
    alternar(codigo: number, etapa: string) {
      if (!carregada || !doDp.carregado) return;
      const c = todas.find(x => x.codigo === codigo);
      const o = c?.obrigacoes.find(x => x.etapa === etapa);
      if (!c || !o || o.estado === 'nao-tem') return;
      const ex = c.ex || t.execucaoNova(c.nomeNaTela, c.codigo, competencia, 'dp');
      const r = o.estado === 'feita' ? t.voltarPara(ex, etapa, op.nome, new Date()) : t.fazer(ex, etapa, op.nome, new Date());
      repo.gravar(r.execucao, r.evento);
    },
  };
}

export type VmPainelDoDp = ReturnType<typeof usePainelDoDp>;
