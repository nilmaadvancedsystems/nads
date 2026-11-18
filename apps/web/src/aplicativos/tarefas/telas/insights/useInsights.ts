// ViewModel da Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de
// Insights eu quero", "esses paineis so vao ser vistos por diretor e admin", "Todos os seis", "faz algo bonito assim como
// no acessorias"). Os destaques do mês no alto, a equipe em cartões com o anel do quanto já concluiu, e os painéis do DP,
// das guias, dos clientes, das entregas e das tarefas em barras. O Modo TV mostra um por vez, girando. Só Diretor e admin
// chegam aqui (a gaveta esconde dos outros e o banco não deixa ler). A tela cheia é da View (Insights.tsx).
import { tarefas as t } from '@nads/core';
import type { NomeIcone } from '@nads/ui';
import { useCallback, useEffect, useState } from 'react';
import { useInsightsDoBanco } from '../../dados/repo';

/** quanto tempo cada painel fica na TV */
export const SEGUNDOS_POR_PAINEL = [10, 20, 30, 60] as const;
/** os números mais velhos que isto: o robô pode ter parado */
const VELHO_MS = 60 * 60 * 1000;
/** os painéis do Modo TV, na ordem em que giram */
export const PAINEIS_DA_TV = ['equipe', 'dp', 'guias', 'clientes', 'entregas', 'tarefas'] as const;
export type PainelDaTv = (typeof PAINEIS_DA_TV)[number];

export type Tom = 'bom' | 'alerta' | 'ruim' | 'neutro' | 'apagado';
export interface Destaque { id: string; icone: NomeIcone; rotulo: string; valor: string; detalhe: string; pct: number | null; tom: Tom }
export interface Segmento { rotulo: string; valor: number; tom: Tom }

/** "há 4 min", "há 2 h" (a idade dos números) */
export function idadeDosNumeros(iso: string, agora: Date): string {
  const ms = agora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 1 ? 'agora' : min < 60 ? 'há ' + min + ' min' : 'há ' + Math.round(min / 60) + ' h';
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesEmTexto = (comp: string) => (/^\d{4}-\d{2}$/.test(comp) ? MESES[Number(comp.slice(5, 7)) - 1] + ' de ' + comp.slice(0, 4) : '');
const pctDe = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);
const n = (v: number) => v.toLocaleString('pt-BR');
const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');

/** O que a tela desenha, a partir do resumo (pura: os testes chamam direto). */
export function telaDosInsights(r: t.ResumoDosInsights) {
  const equipe = t.equipeDosInsights(r).map(p => ({ ...p, iniciais: iniciais(p.nome), texto: n(p.feitas) + ' de ' + n(p.total) }));
  const feitas = equipe.reduce((s, p) => s + p.feitas, 0), total = equipe.reduce((s, p) => s + p.total, 0);
  const pctRotinas = total ? pctDe(feitas, total) : 0;
  const dpComObrigacao = r.dp.feitas + r.dp.pendentes + r.dp.atrasadas;
  const pctDp = pctDe(r.dp.feitas, dpComObrigacao);
  const pctAbertas = pctDe(r.guias.abertas, r.guias.enviadas);
  const destaques: Destaque[] = [
    { id: 'rotinas', icone: 'checkCircle', rotulo: 'Rotinas concluídas', valor: pctRotinas + '%', detalhe: n(feitas) + ' de ' + n(total) + ' empresas', pct: pctRotinas, tom: t.tomDoPercentual(pctRotinas) },
    { id: 'dp', icone: 'usuario', rotulo: 'DP fechado', valor: pctDp + '%', detalhe: r.dp.atrasadas ? n(r.dp.atrasadas) + (r.dp.atrasadas === 1 ? ' atrasado' : ' atrasados') : 'nenhum atrasado', pct: pctDp, tom: r.dp.atrasadas ? 'ruim' : t.tomDoPercentual(pctDp) },
    { id: 'guias', icone: 'fileText', rotulo: 'Guias abertas pelo cliente', valor: pctAbertas + '%', detalhe: n(r.guias.abertas) + ' de ' + n(r.guias.enviadas) + ' enviadas', pct: pctAbertas, tom: 'neutro' },
    { id: 'nota', icone: 'trofeu', rotulo: 'Nota do atendimento', valor: r.clientes.avaliacoes ? r.clientes.nota.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '—', detalhe: r.clientes.avaliacoes ? n(r.clientes.avaliacoes) + (r.clientes.avaliacoes === 1 ? ' avaliação no mês' : ' avaliações no mês') : 'sem avaliação no mês', pct: r.clientes.avaliacoes ? Math.round((r.clientes.nota / 5) * 100) : null, tom: !r.clientes.avaliacoes ? 'apagado' : r.clientes.nota >= 4.5 ? 'bom' : r.clientes.nota >= 3.5 ? 'alerta' : 'ruim' },
    { id: 'solicitacoes', icone: 'mensagem', rotulo: 'Solicitações abertas', valor: n(r.clientes.abertas), detalhe: n(r.clientes.respondidas) + ' esperando o cliente', pct: null, tom: r.clientes.abertas ? 'alerta' : 'bom' },
    { id: 'tarefas', icone: 'clock', rotulo: 'Tarefas atrasadas', valor: n(r.equipe.atrasadas), detalhe: r.equipe.pessoas.length ? 'com ' + n(r.equipe.pessoas.length) + (r.equipe.pessoas.length === 1 ? ' pessoa' : ' pessoas') : 'ninguém atrasado', pct: null, tom: r.equipe.atrasadas ? 'ruim' : 'bom' },
  ];
  const maiorAtraso = Math.max(1, ...r.equipe.pessoas.map(p => p.atrasadas));
  const dpSegmentos: Segmento[] = [
    { rotulo: 'Concluídos', valor: r.dp.feitas, tom: 'bom' }, { rotulo: 'No prazo', valor: r.dp.pendentes, tom: 'neutro' },
    { rotulo: 'Atrasados', valor: r.dp.atrasadas, tom: 'ruim' }, { rotulo: 'Sem movimento', valor: r.dp.sem, tom: 'apagado' },
  ];
  const entregasSegmentos: Segmento[] = [
    { rotulo: 'Entregues', valor: r.entregas.confirmadas, tom: 'bom' }, { rotulo: 'A entregar', valor: r.entregas.aEntregar, tom: 'neutro' },
    { rotulo: 'Esperando o cliente', valor: r.entregas.noLink, tom: 'alerta' }, { rotulo: 'Com falha', valor: r.entregas.falhas, tom: 'ruim' },
  ];
  const funil: { rotulo: string; valor: number; pct: number; tom: Tom }[] = [
    { rotulo: 'Enviadas', valor: r.guias.enviadas, pct: r.guias.enviadas ? 100 : 0, tom: 'neutro' },
    { rotulo: 'Abertas pelo cliente', valor: r.guias.abertas, pct: pctDe(r.guias.abertas, r.guias.enviadas), tom: 'neutro' },
    { rotulo: 'Pagas pelo extrato', valor: r.guias.pagas, pct: pctDe(r.guias.pagas, r.guias.enviadas), tom: 'bom' },
  ];
  const itensDosClientes: { rotulo: string; valor: number; tom: Tom }[] = [
    { rotulo: 'Solicitações abertas', valor: r.clientes.abertas, tom: r.clientes.abertas ? 'alerta' : 'bom' },
    { rotulo: 'Respondidas, esperando o cliente', valor: r.clientes.respondidas, tom: 'neutro' },
    { rotulo: 'Clientes devendo documento', valor: r.clientes.documentosFaltando, tom: r.clientes.documentosFaltando ? 'alerta' : 'bom' },
    { rotulo: 'Pedidos do Mandei abertos', valor: r.clientes.mandeiAbertos, tom: 'neutro' },
  ];
  return {
    competencia: mesEmTexto(r.rotinas[0]?.competencia || r.dp.competencia || r.guias.competencia),
    destaques,
    equipe,
    dp: { competencia: mesEmTexto(r.dp.competencia), segmentos: dpSegmentos },
    guias: { competencia: mesEmTexto(r.guias.competencia), funil },
    clientes: { nota: r.clientes.nota, avaliacoes: r.clientes.avaliacoes, estrelas: Math.round(r.clientes.nota * 2) / 2, itens: itensDosClientes },
    entregas: { segmentos: entregasSegmentos },
    tarefas: r.equipe.pessoas.map(p => ({ nome: p.nome, iniciais: iniciais(p.nome), atrasadas: p.atrasadas, pct: Math.round((p.atrasadas / maiorAtraso) * 100) })),
  };
}

export function useInsights() {
  const repo = useInsightsDoBanco();
  const e = repo.estado();
  const [agora, setAgora] = useState(() => new Date());
  const [tv, setTv] = useState(false);
  const [indice, setIndice] = useState(0);
  const [segundos, setSegundos] = useState<number>(20);
  const [pausado, setPausado] = useState(false);
  const tela = e.resumo ? telaDosInsights(e.resumo) : null;
  const entrarNaTv = useCallback(() => { setIndice(0); setPausado(false); setTv(true); }, []);
  const sairDaTv = useCallback(() => setTv(false), []);
  const total = PAINEIS_DA_TV.length;

  // o relógio da idade dos números (a cada minuto)
  useEffect(() => { const i = setInterval(() => setAgora(new Date()), 60000); return () => clearInterval(i); }, []);
  // a TV gira os painéis
  useEffect(() => {
    if (!tv || pausado) return;
    const i = setInterval(() => setIndice(x => (x + 1) % total), segundos * 1000);
    return () => clearInterval(i);
  }, [tv, pausado, segundos, total]);
  // Esc sai da TV (fora da tela cheia); as setas trocam o painel; espaço pausa
  useEffect(() => {
    if (!tv) return;
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') sairDaTv();
      else if (ev.key === 'ArrowRight') setIndice(x => (x + 1) % total);
      else if (ev.key === 'ArrowLeft') setIndice(x => (x - 1 + total) % total);
      else if (ev.key === ' ') { ev.preventDefault(); setPausado(p => !p); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [tv, total, sairDaTv]);

  const velho = !!e.resumo && agora.getTime() - new Date(e.resumo.atualizadoEm).getTime() > VELHO_MS;
  return {
    exemplos: repo.exemplos,
    carregando: !e.carregado,
    erro: e.erro,
    semNumeros: e.carregado && !e.erro && !e.resumo,
    tela,
    atualizado: e.resumo ? idadeDosNumeros(e.resumo.atualizadoEm, agora) : '',
    velho,
    tv, entrarNaTv, sairDaTv,
    painelDaTv: PAINEIS_DA_TV[indice % total],
    indice: indice % total,
    irPara: (i: number) => setIndice(i),
    pausado, pausar: () => setPausado(p => !p),
    segundos, mudarSegundos: setSegundos,
  };
}
