// ViewModel da Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu quero", "esses paineis so vao ser vistos por diretor e admin", "Todos os seis").
// O Painel (os seis cartões) e o Modo TV (tela cheia, um painel por vez, girando). Só Diretor e admin chegam aqui (a gaveta
// esconde dos outros e o banco não deixa ler).
import { tarefas as t } from '@nads/core';
import { useCallback, useEffect, useState } from 'react';
import { useInsightsDoBanco } from '../../dados/repo';

/** quanto tempo cada painel fica na TV */
export const SEGUNDOS_POR_PAINEL = [10, 20, 30, 60] as const;
/** os números mais velhos que isto: o robô pode ter parado */
const VELHO_MS = 60 * 60 * 1000;

/** "há 4 min", "há 2 h" (a idade dos números) */
export function idadeDosNumeros(iso: string, agora: Date): string {
  const ms = agora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 1 ? 'agora' : min < 60 ? 'há ' + min + ' min' : 'há ' + Math.round(min / 60) + ' h';
}

export function useInsights() {
  const repo = useInsightsDoBanco();
  const e = repo.estado();
  const [agora, setAgora] = useState(() => new Date());
  const [tv, setTv] = useState(false);
  const [indice, setIndice] = useState(0);
  const [segundos, setSegundos] = useState<number>(20);
  const [pausado, setPausado] = useState(false);
  const paineis = e.resumo ? t.paineisDosInsights(e.resumo) : [];
  // a tela cheia é da View (Insights.tsx): aqui só o estado
  const entrarNaTv = useCallback(() => { setIndice(0); setPausado(false); setTv(true); }, []);
  const sairDaTv = useCallback(() => setTv(false), []);

  // o relógio da idade dos números (a cada minuto)
  useEffect(() => { const i = setInterval(() => setAgora(new Date()), 60000); return () => clearInterval(i); }, []);
  // a TV gira os painéis
  useEffect(() => {
    if (!tv || pausado || paineis.length < 2) return;
    const i = setInterval(() => setIndice(x => (x + 1) % paineis.length), segundos * 1000);
    return () => clearInterval(i);
  }, [tv, pausado, segundos, paineis.length]);
  // Esc sai da TV (fora da tela cheia); as setas trocam o painel; espaço pausa
  useEffect(() => {
    if (!tv) return;
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') sairDaTv();
      else if (ev.key === 'ArrowRight') setIndice(x => (x + 1) % Math.max(1, paineis.length));
      else if (ev.key === 'ArrowLeft') setIndice(x => (x - 1 + paineis.length) % Math.max(1, paineis.length));
      else if (ev.key === ' ') { ev.preventDefault(); setPausado(p => !p); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });


  const velho = !!e.resumo && agora.getTime() - new Date(e.resumo.atualizadoEm).getTime() > VELHO_MS;
  return {
    exemplos: repo.exemplos,
    carregando: !e.carregado,
    erro: e.erro,
    semNumeros: e.carregado && !e.erro && !e.resumo,
    paineis,
    atualizado: e.resumo ? idadeDosNumeros(e.resumo.atualizadoEm, agora) : '',
    velho,
    tv, entrarNaTv, sairDaTv,
    atual: paineis[indice % Math.max(1, paineis.length)] ?? null,
    indice: indice % Math.max(1, paineis.length),
    irPara: (i: number) => setIndice(i),
    pausado, pausar: () => setPausado(p => !p),
    segundos, mudarSegundos: setSegundos,
  };
}
