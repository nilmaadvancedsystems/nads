// ViewModel do mapa na tela (21/10/2026: "a tela com os botões coloridos"): com o mapa ligado (estadoDoMapaNaTela.ts), lê os
// dias do período uma vez, soma (uso.somarUso) e diz, para a tela aberta, quantos cliques cada controle teve; a View
// (MapaNaTela.tsx) acha os controles no DOM pelo mesmo rótulo da coleta e pinta cada um. Só o admin.
import { uso } from '@nads/core';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { useRepo, useUso } from '../dados/repo';
import { desligarMapaNaTela, ligarMapaNaTela, useMapaNaTela, type PeriodoDoMapa } from './estadoDoMapaNaTela';
import { telasDaNavegacao } from './navegacao';
import { useOperador } from './operador';

export const PERIODOS_DO_MAPA: { valor: PeriodoDoMapa; rotulo: string }[] = [
  { valor: '7', rotulo: '7 dias' }, { valor: '30', rotulo: '30 dias' }, { valor: '90', rotulo: '90 dias' },
];

/** nos exemplos, os controles de verdade não estão nos dias inventados: um número fixo pelo rótulo, só para ver as cores */
function cliquesDeExemplo(rotulo: string): number {
  let h = 7;
  for (const ch of rotulo) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h % 4 === 0 ? 0 : h % 60;
}

export function useMapaNaTelaVM() {
  const mapa = useMapaNaTela();
  const admin = !!useOperador().operador?.admin;
  const repo = useUso();
  const { pathname } = useLocation();
  const tela = uso.telaDoCaminho(pathname);
  const empresas = useRepo().listarEmpresas();
  const nomes = useMemo(() => empresas.map(e => uso.nomeComparavel(e.nome)).filter(n => n.length >= 5), [empresas]);
  const navegacao = useMemo(() => telasDaNavegacao(), []);
  const ligado = !!mapa && admin;
  const periodo = mapa?.periodo || '30';
  const [lido, setLido] = useState<{ periodo: string; dias: uso.UsoDoDia[] } | null>(null);

  useEffect(() => {
    if (!ligado) return;
    let vale = true;
    repo.dias(uso.diasDoPeriodo(Number(periodo), new Date()), navegacao).then(
      dias => { if (vale) setLido({ periodo, dias }); },
      () => { if (vale) setLido({ periodo, dias: [] }); },
    );
    return () => { vale = false; };
  }, [ligado, repo, periodo, navegacao]);

  const soma = useMemo(() => uso.somarUso(lido?.dias || [], navegacao), [lido, navegacao]);
  const daTela = soma.telas.find(t => t.tela === tela) || null;
  const porControle = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of daTela?.controles || []) m.set(c.controle, c.cliques);
    for (const c of daTela?.semClique || []) m.set(c, 0);
    return m;
  }, [daTela]);
  const maior = repo.exemplos ? 59 : Math.max(0, ...porControle.values());

  return {
    ligado,
    carregando: ligado && lido?.periodo !== periodo,
    exemplos: repo.exemplos,
    tela,
    nomes,
    rotulo: daTela?.rotulo || navegacao.find(n => n.tela === tela)?.rotulo || tela || '',
    visitas: daTela?.visitas || 0,
    cliques: daTela?.cliques || 0,
    periodo,
    periodos: PERIODOS_DO_MAPA,
    setPeriodo: (p: PeriodoDoMapa) => ligarMapaNaTela(p),
    sair: desligarMapaNaTela,
    /** os cliques do controle no período (o que nunca apareceu na coleta conta como 0) e o nível do calor */
    calorDe(rotulo: string): { cliques: number; nivel: uso.NivelDoCalor } {
      const cliques = repo.exemplos ? cliquesDeExemplo(rotulo) : porControle.get(rotulo) || 0;
      return { cliques, nivel: uso.nivelDoCalor(cliques, maior) };
    },
  };
}
