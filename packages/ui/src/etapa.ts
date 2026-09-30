// A ferramenta aberta dentro de uma etapa da Tarefas (um iframe, que pode ser outro site:
// tarefas-nilma → extratudo-nilma). Nada de cabeçalho fixo nem de duas barras de rolagem: a ferramenta
// diz a altura do conteúdo e a Tarefas estica o iframe até ela — quem rola é a página de fora, inteira.
// Em troca, a Tarefas conta à ferramenta que pedaço dela está na tela, para a janela e o aviso
// aparecerem onde a pessoa está olhando. A barra de carregamento é uma só, a da Tarefas, de ponta a ponta.
// Só conversa com os endereços do nads (*-nilma.web.app, as prévias deles e o próprio endereço, no
// desenvolvimento).
import { useEffect, useState, type RefObject } from 'react';
import { origemConfiavel, origemDoPai } from './origem';

export { origemConfiavel, origemDoPai };

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
    // uma janela ou um menu aberto aqui dentro: a Tarefas esconde os botões soltos da etapa, que ficariam por cima
    let janela: boolean | null = null;
    const olharJanela = () => {
      const agora = !!document.querySelector('.modal-overlay, .popover');
      if (agora === janela) return;
      janela = agora;
      window.parent.postMessage({ nads: 'janela', aberta: agora }, pai);
    };
    const obsJanela = new MutationObserver(olharJanela);
    obsJanela.observe(document.body, { childList: true, subtree: true });
    olharJanela();
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
      obsJanela.disconnect();
      window.removeEventListener('message', ouvir);
      html.classList.remove('na-etapa');
    };
  }, [ativo]);
}

/**
 * Na Tarefas: a altura que a ferramenta pediu (null = ainda não disse), se ela está carregando (desde o
 * clique até ela dizer que terminou; no máximo 10 s se ela nunca disser) e, ao rolar ou mudar o tamanho
 * da janela, o pedaço do iframe que está na tela.
 */
export function useFerramentaNaEtapa(iframe: RefObject<HTMLIFrameElement | null>, chave: string | undefined) {
  const [altura, setAltura] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(!!chave);
  const [janelaAberta, setJanelaAberta] = useState(false);
  useEffect(() => {
    setAltura(null);
    setCarregando(!!chave);
    setJanelaAberta(false);
    let disse = false;
    const limite = setTimeout(() => { if (!disse) setCarregando(false); }, 10000);
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
      const d = e.data as { nads?: string; px?: unknown; ativo?: unknown } | null;
      if (d?.nads === 'altura' && typeof d.px === 'number' && d.px > 0) { setAltura(d.px); mandarVista(); }
      if (d?.nads === 'carregando' && typeof d.ativo === 'boolean') { disse = true; setCarregando(d.ativo); }
      if (d?.nads === 'janela' && typeof (d as { aberta?: unknown }).aberta === 'boolean') setJanelaAberta(!!(d as { aberta?: boolean }).aberta);
    };
    window.addEventListener('message', ouvir);
    window.addEventListener('scroll', mandarVista, { passive: true });
    window.addEventListener('resize', mandarVista);
    return () => {
      clearTimeout(limite);
      cancelAnimationFrame(quadro);
      window.removeEventListener('message', ouvir);
      window.removeEventListener('scroll', mandarVista);
      window.removeEventListener('resize', mandarVista);
    };
  }, [iframe, chave]);
  return { altura, carregando, janelaAberta };
}
