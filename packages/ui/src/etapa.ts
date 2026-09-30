// A ferramenta aberta dentro de uma etapa da Tarefas (um iframe, que pode ser outro site:
// tarefas-nilma → extratudo-nilma). Nada de cabeçalho fixo nem de duas barras de rolagem: a ferramenta
// diz a altura do conteúdo e a Tarefas estica o iframe até ela — quem rola é a página de fora, inteira.
// Em troca, a Tarefas conta à ferramenta que pedaço dela está na tela, para a janela, o aviso e a barra
// de carregamento aparecerem onde a pessoa está olhando. Só conversa com os endereços do nads
// (*-nilma.web.app, as prévias deles e o próprio endereço, no desenvolvimento).
import { useEffect, useState, type RefObject } from 'react';

const NADS = /^https:\/\/[a-z0-9-]+-nilma(--[a-z0-9-]+)?\.web\.app$/;

/** Endereço do nads (ou o mesmo da página, no desenvolvimento)? */
export function origemConfiavel(origem: string): boolean {
  return origem === window.location.origin || NADS.test(origem);
}

/** O endereço da página de fora, quando esta está dentro de um iframe de uma página do nads. */
export function origemDoPai(): string | null {
  if (window.parent === window) return null;
  let origem: string | null = window.location.ancestorOrigins?.[0] || null;
  if (!origem) { try { origem = document.referrer ? new URL(document.referrer).origin : null; } catch { origem = null; } }
  return origem && origemConfiavel(origem) ? origem : null;
}

/** Na ferramenta (a Casca embutida): manda a altura do conteúdo e recebe o pedaço que está na tela. */
export function useAlturaNaEtapa(ativo: boolean) {
  useEffect(() => {
    const pai = ativo ? origemDoPai() : null;
    if (!pai) return;
    const html = document.documentElement;
    html.classList.add('na-etapa');
    let ultima = -1;
    const mandar = () => {
      const px = Math.ceil(document.body.getBoundingClientRect().height);
      if (px === ultima) return;
      ultima = px;
      window.parent.postMessage({ nads: 'altura', px }, pai);
    };
    const obs = new ResizeObserver(mandar);
    obs.observe(document.body);
    mandar();
    const ouvir = (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== pai) return;
      const d = e.data as { nads?: string; topo?: unknown; altura?: unknown } | null;
      if (d?.nads !== 'vista' || typeof d.topo !== 'number' || typeof d.altura !== 'number') return;
      html.style.setProperty('--vista-topo', d.topo + 'px');
      html.style.setProperty('--vista-altura', d.altura + 'px');
    };
    window.addEventListener('message', ouvir);
    return () => {
      obs.disconnect();
      window.removeEventListener('message', ouvir);
      html.classList.remove('na-etapa');
    };
  }, [ativo]);
}

/**
 * Na Tarefas: a altura que a ferramenta pediu (null = ainda não disse) e, ao rolar ou mudar o tamanho
 * da janela, o pedaço do iframe que está na tela.
 */
export function useFerramentaNaEtapa(iframe: RefObject<HTMLIFrameElement | null>, chave: string | undefined) {
  const [altura, setAltura] = useState<number | null>(null);
  useEffect(() => {
    setAltura(null);
    let quadro = 0;
    const mandarVista = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const f = iframe.current;
        if (!f?.contentWindow) return;
        const r = f.getBoundingClientRect();
        const topo = Math.max(0, -r.top);
        const alturaVista = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
        f.contentWindow.postMessage({ nads: 'vista', topo, altura: alturaVista }, new URL(f.src, window.location.href).origin);
      });
    };
    const ouvir = (e: MessageEvent) => {
      if (!iframe.current || e.source !== iframe.current.contentWindow || !origemConfiavel(e.origin)) return;
      const d = e.data as { nads?: string; px?: unknown } | null;
      if (d?.nads === 'altura' && typeof d.px === 'number' && d.px > 0) { setAltura(d.px); mandarVista(); }
    };
    window.addEventListener('message', ouvir);
    window.addEventListener('scroll', mandarVista, { passive: true });
    window.addEventListener('resize', mandarVista);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('message', ouvir);
      window.removeEventListener('scroll', mandarVista);
      window.removeEventListener('resize', mandarVista);
    };
  }, [iframe, chave]);
  return altura;
}
