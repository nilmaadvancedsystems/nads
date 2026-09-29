// A ponte entre a Tarefas e a ferramenta que ela abre dentro da etapa (um iframe, que pode ser outro site:
// tarefas-nilma → extratudo-nilma). A ferramenta conta o que foi importado; a Tarefas mostra os botões de
// excluir na barra de baixo da etapa e pede para a ferramenta excluir. Só conversa com os endereços do nads
// (*-nilma.web.app, as prévias deles e o próprio endereço, no desenvolvimento). É de todos os aplicativos.
import { useCallback, useEffect, useState, type RefObject } from 'react';

/** O que a Tarefas precisa saber de cada arquivo importado na ferramenta. */
export interface ImportacaoResumo { id: string; lado: 'banco' | 'sistema'; nome: string; periodo: string; qtd: number }

type ParaTarefa = { nads: 'importacoes'; arquivos: ImportacaoResumo[] };
type ParaFerramenta = { nads: 'excluir-importacao'; id: string };

const NADS = /^https:\/\/[a-z0-9-]+-nilma(--[a-z0-9-]+)?\.web\.app$/;

/** Endereço do nads (ou o mesmo da página, no desenvolvimento)? */
export function origemConfiavel(origem: string): boolean {
  return origem === window.location.origin || NADS.test(origem);
}

/** O endereço da página de fora, quando esta está dentro de um iframe dela. */
function origemDoPai(): string | null {
  if (window.parent === window) return null;
  const pelaLista = window.location.ancestorOrigins?.[0];
  if (pelaLista) return pelaLista;
  try { return document.referrer ? new URL(document.referrer).origin : null; } catch { return null; }
}

/**
 * Na ferramenta (dentro da etapa da Tarefas): avisa a Tarefas o que está importado sempre que muda,
 * e exclui quando a Tarefas pedir (ela já perguntou à pessoa). Fora da Tarefas, não faz nada.
 */
export function useAvisarTarefa(arquivos: ImportacaoResumo[], excluir: (id: string) => void): void {
  const chave = JSON.stringify(arquivos);
  useEffect(() => {
    const pai = origemDoPai();
    if (!pai || !origemConfiavel(pai)) return;
    const msg: ParaTarefa = { nads: 'importacoes', arquivos: JSON.parse(chave) as ImportacaoResumo[] };
    window.parent.postMessage(msg, pai);
  }, [chave]);
  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.source !== window.parent || !origemConfiavel(e.origin)) return;
      const d = e.data as Partial<ParaFerramenta> | null;
      if (d && d.nads === 'excluir-importacao' && typeof d.id === 'string') excluir(d.id);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [excluir]);
}

/** Na Tarefas: o que a ferramenta da etapa tem importado, e o pedido de excluir um arquivo. */
export function useImportacoesDaFerramenta(iframe: RefObject<HTMLIFrameElement | null>, url: string | null) {
  const [importacoes, setImportacoes] = useState<ImportacaoResumo[]>([]);
  // outra etapa (outra ferramenta): começa vazio até ela contar
  const [urlAtual, setUrlAtual] = useState(url);
  if (url !== urlAtual) { setUrlAtual(url); setImportacoes([]); }

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (!iframe.current || e.source !== iframe.current.contentWindow || !origemConfiavel(e.origin)) return;
      const d = e.data as Partial<ParaTarefa> | null;
      if (d && d.nads === 'importacoes' && Array.isArray(d.arquivos)) setImportacoes(d.arquivos);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [iframe]);

  const excluir = useCallback((id: string) => {
    const f = iframe.current;
    if (!f?.contentWindow) return;
    const msg: ParaFerramenta = { nads: 'excluir-importacao', id };
    f.contentWindow.postMessage(msg, new URL(f.src, window.location.href).origin);
  }, [iframe]);

  return { importacoes, excluir };
}
