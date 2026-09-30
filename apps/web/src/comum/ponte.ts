// A ponte entre a Tarefas e a ferramenta que ela abre dentro da etapa (um iframe, que pode ser outro site:
// tarefas-nilma → extratudo-nilma). Hoje: o "Não teve movimento" de cada banco e a troca de competência
// (o seletor da ferramenta pede; a Tarefas abre a etapa da outra competência). Quem guarda é a Tarefas
// (fica na execução da etapa); a ferramenta mostra a linha do banco marcada e avisa quando a pessoa marca
// ou desmarca. Só conversa com os endereços do nads (*-nilma.web.app, as prévias deles e o próprio
// endereço, no desenvolvimento). É de todos os aplicativos.
import { origemConfiavel, origemDoPai } from '@nads/ui';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type ParaTarefa = { nads: 'pronta' } | { nads: 'sem-movimento'; banco: string; marcado: boolean } | { nads: 'competencia'; competencia: string };
type ParaFerramenta = { nads: 'estado-etapa'; semMovimento: string[] };

// As origens confiáveis moram no @nads/ui (etapa.ts), junto com a altura da ferramenta na etapa.
export { origemConfiavel };

/**
 * Na ferramenta: está dentro de uma etapa da Tarefas? Então recebe os bancos marcados sem movimento
 * e avisa quando a pessoa marca ou desmarca um. Fora da Tarefas: naTarefa = false e nada acontece.
 */
export function usePonteDaTarefa() {
  const [pai] = useState(origemDoPai);
  const [semMovimento, setSemMovimento] = useState<string[]>([]);
  useEffect(() => {
    if (!pai) return;
    const ouvir = (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== pai) return;
      const d = e.data as Partial<ParaFerramenta> | null;
      if (d && d.nads === 'estado-etapa' && Array.isArray(d.semMovimento)) setSemMovimento(d.semMovimento);
    };
    window.addEventListener('message', ouvir);
    const pronta: ParaTarefa = { nads: 'pronta' };
    window.parent.postMessage(pronta, pai);
    return () => window.removeEventListener('message', ouvir);
  }, [pai]);
  const marcarSemMovimento = useCallback((banco: string, marcado: boolean) => {
    if (!pai) return;
    setSemMovimento(v => (marcado ? [...v.filter(b => b !== banco), banco] : v.filter(b => b !== banco))); // já mostra; a Tarefas confirma
    const msg: ParaTarefa = { nads: 'sem-movimento', banco, marcado };
    window.parent.postMessage(msg, pai);
  }, [pai]);
  /** O seletor de competência da ferramenta: dentro da Tarefas, quem troca é ela (a etapa da outra competência). */
  const trocarCompetencia = useCallback((competencia: string) => {
    if (!pai) return;
    const msg: ParaTarefa = { nads: 'competencia', competencia };
    window.parent.postMessage(msg, pai);
  }, [pai]);
  return { naTarefa: !!pai, semMovimento, marcarSemMovimento, trocarCompetencia };
}

/** Na Tarefas: manda à ferramenta os bancos sem movimento e recebe quando a pessoa marca um. */
export function usePonteDaFerramenta(iframe: RefObject<HTMLIFrameElement | null>, semMovimento: string[], onSemMovimento: (banco: string, marcado: boolean) => void,
  onCompetencia?: (competencia: string) => void) {
  const estado = useRef(semMovimento);
  const aoMarcar = useRef(onSemMovimento);
  const aoTrocar = useRef(onCompetencia);
  useEffect(() => { estado.current = semMovimento; aoMarcar.current = onSemMovimento; aoTrocar.current = onCompetencia; });

  const mandar = useCallback(() => {
    const f = iframe.current;
    if (!f?.contentWindow) return;
    const msg: ParaFerramenta = { nads: 'estado-etapa', semMovimento: estado.current };
    f.contentWindow.postMessage(msg, new URL(f.src, window.location.href).origin);
  }, [iframe]);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (!iframe.current || e.source !== iframe.current.contentWindow || !origemConfiavel(e.origin)) return;
      const d = e.data as Partial<{ nads: string; banco: string; marcado: boolean; competencia: string }> | null;
      if (d?.nads === 'pronta') mandar();
      if (d?.nads === 'sem-movimento' && typeof d.banco === 'string') aoMarcar.current(d.banco, !!d.marcado);
      if (d?.nads === 'competencia' && typeof d.competencia === 'string' && /^\d{4}-\d{2}$/.test(d.competencia)) aoTrocar.current?.(d.competencia);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [iframe, mandar]);

  const chave = semMovimento.join(',');
  useEffect(() => { mandar(); }, [chave, mandar]);
}
