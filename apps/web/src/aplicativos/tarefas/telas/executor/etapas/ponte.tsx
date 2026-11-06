// A ponte entre a Tarefa e a ferramenta da etapa (a Importação, a Conferência fiscal, o Creditor, o Cartões e as Vendas no
// cartão), agora sem iframe (Vitor, 06/11/2026: "não quero essas aplicações rodando externas, deixa apenas nas etapas"). Os
// mesmos nomes de antes, para as ferramentas não mudarem: os bancos sem movimento de cada mês, a troca de competência, o
// período e o "Resolver" vêm da Tarefa por aqui; o que falta e os dados de teste vão pelo contexto da etapa (contexto.tsx).
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa, type RequisitosDaEtapa } from './contexto';

/** Vários meses: os meses do período prometido e se todos já estão concluídos (só aí dá para encerrar). */
export interface PeriodoDaEtapa { meses: string[]; concluido: boolean }

export type Requisitos = RequisitosDaEtapa;

/** Uma opção de dados de teste que a ferramenta sabe implantar (o ⚡ da Tarefa lista e manda a escolhida). */
export interface OpcaoDeTeste { id: string; rotulo: string }

interface Ponte {
  porMes: Record<string, string[]>;
  periodo: PeriodoDaEtapa | null;
  etapaConcluida: boolean;
  marcarSemMovimento: (banco: string, marcado: boolean, competencia?: string) => void;
  trocarCompetencia: (competencia: string) => void;
  encerrarPeriodo: () => void;
  /** o "Resolver" da Tarefa: quem quer saber assina; devolve o cancelar */
  assinarDestaque: (f: (alvo: string) => void) => () => void;
}

const Ctx = createContext<Ponte | null>(null);

/** Na Tarefa: o Resolver chama destacar(alvo); a ferramenta aberta vai até o lugar. */
export function useDestaqueDaEtapa() {
  const ouvintes = useRef(new Set<(alvo: string) => void>());
  const assinar = useCallback((f: (alvo: string) => void) => { ouvintes.current.add(f); return () => { ouvintes.current.delete(f); }; }, []);
  const destacar = useCallback((alvo: string) => { for (const f of ouvintes.current) f(alvo); }, []);
  return { assinar, destacar };
}

export function PonteDaEtapaProvider({ valor, children }: { valor: Ponte; children: ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/**
 * Na ferramenta: os bancos marcados sem movimento (do mês aberto nela) e o marcar/desmarcar; a troca de competência,
 * o período e o encerrar. Sempre dentro da etapa (naTarefa = true).
 */
export function usePonteDaTarefa(competencia?: string, onDestacar?: (alvo: string) => void) {
  const p = useContext(Ctx);
  if (!p) throw new Error('A ferramenta precisa estar dentro da etapa (PonteDaEtapaProvider)');
  const aoDestacar = useRef(onDestacar);
  useEffect(() => { aoDestacar.current = onDestacar; });
  const { assinarDestaque } = p;
  useEffect(() => assinarDestaque(alvo => aoDestacar.current?.(alvo)), [assinarDestaque]);
  const porMes = p.porMes;
  // sem competência (ou mês que a Tarefa não tem): o primeiro
  const mes = competencia && porMes[competencia] ? competencia : Object.keys(porMes)[0] || competencia || '';
  const { marcarSemMovimento: marcar } = p;
  const marcarSemMovimento = useCallback((banco: string, marcado: boolean, noMes?: string) => marcar(banco, marcado, noMes || mes), [marcar, mes]);
  return {
    naTarefa: true, semMovimento: porMes[mes] || [], semMovimentoPorMes: porMes, marcarSemMovimento,
    trocarCompetencia: p.trocarCompetencia, periodo: p.periodo, etapaConcluida: p.etapaConcluida, encerrarPeriodo: p.encerrarPeriodo,
  };
}

/** Na ferramenta: diz à Tarefa o que falta para seguir (null = ainda não sabe; o avançar fica esperando). */
export function useRequisitosParaATarefa(requisitos: Requisitos | null) {
  useRequisitosDaEtapa(requisitos);
}

/** Na ferramenta: as opções de dados de teste desta tela (o ⚡); devolve os itens para o ⚡ da própria linha. */
export function useDadosDeTesteNaTarefa(opcoes: OpcaoDeTeste[], implantar: (id: string) => void) {
  return useDadosDeTesteDaEtapa(opcoes, implantar);
}

/**
 * O endereço de antes (?competencia=&meses=&servicos=&etapa=), montado a partir da etapa aberta: as ferramentas liam
 * o período da Tarefa pela URL do iframe.
 */
export function useParametrosDaEtapa(): URLSearchParams {
  const e = useEtapaAberta();
  const extra = useContext(ExtrasCtx);
  const p = new URLSearchParams();
  p.set('competencia', e.competencia);
  if (e.mesesDaTarefa && e.meses.length) p.set('meses', e.meses.join(','));
  if (e.prestaServico != null) p.set('servicos', e.prestaServico ? 'sim' : 'nao');
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p;
}

const ExtrasCtx = createContext<Record<string, string>>({});

/** O que mais ia no endereço da ferramenta (a Importação do Fiscal: etapa=fiscal; a Conferência: os meses sempre). */
export function ParametrosDaEtapa({ extra, children }: { extra: Record<string, string>; children: ReactNode }) {
  return <ExtrasCtx.Provider value={extra}>{children}</ExtrasCtx.Provider>;
}
