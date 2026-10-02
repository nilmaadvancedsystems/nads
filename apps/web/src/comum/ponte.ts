// A ponte entre a Tarefas e a ferramenta que ela abre dentro da etapa (um iframe, que pode ser outro site:
// tarefas-nilma → extratudo-nilma). Hoje: o "Não teve movimento" de cada banco e a troca de competência
// (o seletor da ferramenta pede; a Tarefas abre a etapa da outra competência). Quem guarda é a Tarefas
// (fica na execução da etapa); a ferramenta mostra a linha do banco marcada e avisa quando a pessoa marca
// ou desmarca. Só conversa com os endereços do nads (*-nilma.web.app, as prévias deles e o próprio
// endereço, no desenvolvimento). É de todos os aplicativos.
import { origemConfiavel, origemDoPai } from '@nads/ui';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type ParaTarefa = { nads: 'pronta' } | { nads: 'sem-movimento'; banco: string; marcado: boolean; competencia?: string } | { nads: 'competencia'; competencia: string }
  | { nads: 'encerrar-periodo' } | { nads: 'requisitos'; pronto: boolean; faltam: string[]; alvos?: (string | null)[]; precisaChequeEspecial?: boolean };
/** o estado da etapa: os bancos sem movimento de cada mês (no período, um por mês; num mês só, só ele) */
type ParaFerramenta = { nads: 'estado-etapa'; porMes: Record<string, string[]>; periodo?: PeriodoDaEtapa | null }
  // o "Resolver" do que falta (Vitor, 02/10/2026): a ferramenta vai até o lugar (o alvo que ela mesma mandou) e destaca
  | { nads: 'destacar'; alvo: string };

/** O que falta para seguir, com o lugar de cada um na ferramenta (null = sem lugar). */
export interface Requisitos {
  pronto: boolean; faltam: string[]; alvos?: (string | null)[];
  /** a Importação diz se algum banco fecha negativo (false: a Tarefas pula o Cheque especial) */
  precisaChequeEspecial?: boolean;
}

/** Vários meses: os meses do período prometido e se todos já estão concluídos (só aí dá para encerrar). */
export interface PeriodoDaEtapa { meses: string[]; concluido: boolean }

/** 'aaaa-mm' ou o período 'aaaa-mm..aaaa-mm' (a Etapa com vários meses). */
const COMPETENCIA_OU_PERIODO = /^\d{4}-\d{2}(\.\.\d{4}-\d{2})?$/;

// As origens confiáveis moram no @nads/ui (etapa.ts), junto com a altura da ferramenta na etapa.
export { origemConfiavel };

/**
 * Na ferramenta: está dentro de uma etapa da Tarefas? Então recebe os bancos marcados sem movimento (do mês
 * que estiver aberto nela) e avisa quando a pessoa marca ou desmarca um. Fora da Tarefas: naTarefa = false.
 */
export function usePonteDaTarefa(competencia?: string, onDestacar?: (alvo: string) => void) {
  const [pai] = useState(origemDoPai);
  const aoDestacar = useRef(onDestacar);
  useEffect(() => { aoDestacar.current = onDestacar; });
  const [porMes, setPorMes] = useState<Record<string, string[]>>({});
  const [periodo, setPeriodo] = useState<PeriodoDaEtapa | null>(null);
  useEffect(() => {
    if (!pai) return;
    const ouvir = (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== pai) return;
      const d = e.data as Partial<{ nads: string; porMes: Record<string, string[]>; periodo: PeriodoDaEtapa | null; alvo: string }> | null;
      if (d && d.nads === 'destacar' && typeof d.alvo === 'string') aoDestacar.current?.(d.alvo);
      if (d && d.nads === 'estado-etapa' && d.porMes && typeof d.porMes === 'object') {
        setPorMes(d.porMes);
        setPeriodo(d.periodo && Array.isArray(d.periodo.meses) ? { meses: d.periodo.meses, concluido: !!d.periodo.concluido } : null);
      }
    };
    window.addEventListener('message', ouvir);
    const pronta: ParaTarefa = { nads: 'pronta' };
    window.parent.postMessage(pronta, pai);
    return () => window.removeEventListener('message', ouvir);
  }, [pai]);
  // sem competência (ou mês que a Tarefas não mandou): o primeiro que veio
  const mes = competencia && porMes[competencia] ? competencia : Object.keys(porMes)[0] || competencia || '';
  const semMovimento = porMes[mes] || [];
  const marcarSemMovimento = useCallback((banco: string, marcado: boolean, noMes?: string) => {
    if (!pai) return;
    const m = noMes || mes;
    // já mostra; a Tarefas confirma
    setPorMes(v => ({ ...v, [m]: marcado ? [...(v[m] || []).filter(b => b !== banco), banco] : (v[m] || []).filter(b => b !== banco) }));
    const msg: ParaTarefa = { nads: 'sem-movimento', banco, marcado, ...(m ? { competencia: m } : {}) };
    window.parent.postMessage(msg, pai);
  }, [pai, mes]);
  /** O seletor de competência da ferramenta: dentro da Tarefas, quem troca é ela (a etapa da outra competência ou do período). */
  const trocarCompetencia = useCallback((competencia: string) => {
    if (!pai) return;
    const msg: ParaTarefa = { nads: 'competencia', competencia };
    window.parent.postMessage(msg, pai);
  }, [pai]);
  /** Vários meses: pede à Tarefas para encerrar (ela só encerra com todos os meses concluídos). */
  const encerrarPeriodo = useCallback(() => {
    if (!pai) return;
    const msg: ParaTarefa = { nads: 'encerrar-periodo' };
    window.parent.postMessage(msg, pai);
  }, [pai]);
  return { naTarefa: !!pai, semMovimento, semMovimentoPorMes: porMes, marcarSemMovimento, trocarCompetencia, periodo, encerrarPeriodo };
}

/**
 * Na ferramenta: diz à Tarefas se os requisitos da etapa estão cumpridos (o botão de avançar só aparece com tudo
 * pronto). Manda de novo quando muda e quando a Tarefas pergunta (ela avisa "pronta" ao abrir).
 */
export function useRequisitosParaATarefa(requisitos: Requisitos | null) {
  const [pai] = useState(origemDoPai);
  const chave = requisitos ? JSON.stringify(requisitos) : '';
  useEffect(() => {
    if (!pai || !requisitos) return;
    const msg: ParaTarefa = { nads: 'requisitos', pronto: requisitos.pronto, faltam: requisitos.faltam, ...(requisitos.alvos ? { alvos: requisitos.alvos } : {}), ...(typeof requisitos.precisaChequeEspecial === 'boolean' ? { precisaChequeEspecial: requisitos.precisaChequeEspecial } : {}) };
    window.parent.postMessage(msg, pai);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pai, chave]);
}

/** Na Tarefas: manda à ferramenta os bancos sem movimento de cada mês e recebe quando a pessoa marca um. */
export function usePonteDaFerramenta(iframe: RefObject<HTMLIFrameElement | null>, porMes: Record<string, string[]>, mesPadrao: string,
  onSemMovimento: (banco: string, marcado: boolean, competencia?: string) => void, onCompetencia?: (competencia: string) => void,
  periodo: PeriodoDaEtapa | null = null, onEncerrar?: () => void,
  onRequisitos?: (r: Requisitos) => void) {
  const aoRequisitos = useRef(onRequisitos);
  const estado = useRef(porMes);
  const estadoPeriodo = useRef(periodo);
  const aoEncerrar = useRef(onEncerrar);
  const aoMarcar = useRef(onSemMovimento);
  const aoTrocar = useRef(onCompetencia);
  useEffect(() => { estado.current = porMes; estadoPeriodo.current = periodo; aoMarcar.current = onSemMovimento; aoTrocar.current = onCompetencia; aoEncerrar.current = onEncerrar; aoRequisitos.current = onRequisitos; });

  const mandar = useCallback(() => {
    const f = iframe.current;
    if (!f?.contentWindow) return;
    const msg: ParaFerramenta = { nads: 'estado-etapa', porMes: estado.current, periodo: estadoPeriodo.current };
    f.contentWindow.postMessage(msg, new URL(f.src, window.location.href).origin);
  }, [iframe]);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (!iframe.current || e.source !== iframe.current.contentWindow || !origemConfiavel(e.origin)) return;
      const d = e.data as Partial<{ nads: string; banco: string; marcado: boolean; competencia: string; pronto: boolean; faltam: unknown; alvos: unknown; precisaChequeEspecial: unknown }> | null;
      if (d?.nads === 'pronta') mandar();
      if (d?.nads === 'sem-movimento' && typeof d.banco === 'string') aoMarcar.current(d.banco, !!d.marcado, typeof d.competencia === 'string' ? d.competencia : mesPadrao);
      if (d?.nads === 'competencia' && typeof d.competencia === 'string' && COMPETENCIA_OU_PERIODO.test(d.competencia)) aoTrocar.current?.(d.competencia);
      if (d?.nads === 'encerrar-periodo') aoEncerrar.current?.();
      if (d?.nads === 'requisitos') {
        const faltam = Array.isArray(d.faltam) ? d.faltam.filter((x): x is string => typeof x === 'string') : [];
        const alvos = Array.isArray(d.alvos) && d.alvos.length === faltam.length ? d.alvos.map(a => (typeof a === 'string' ? a : null)) : undefined;
        aoRequisitos.current?.({ pronto: !!d.pronto, faltam, alvos, ...(typeof d.precisaChequeEspecial === 'boolean' ? { precisaChequeEspecial: d.precisaChequeEspecial } : {}) });
      }
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [iframe, mandar, mesPadrao]);

  const chave = JSON.stringify([porMes, periodo]);
  useEffect(() => { mandar(); }, [chave, mandar]);

  /** O "Resolver": pede à ferramenta que vá até o lugar do problema e o destaque. */
  return useCallback((alvo: string) => {
    const f = iframe.current;
    if (!f?.contentWindow) return;
    const msg: ParaFerramenta = { nads: 'destacar', alvo };
    f.contentWindow.postMessage(msg, new URL(f.src, window.location.href).origin);
  }, [iframe]);
}
