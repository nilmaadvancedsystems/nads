// A ferramenta aberta dentro de uma etapa da Tarefas (um iframe, que pode ser outro site:
// tarefas-nilma → extratudo-nilma). Nada de cabeçalho fixo nem de duas barras de rolagem: a ferramenta
// diz a altura do conteúdo e a Tarefas estica o iframe até ela — quem rola é a página de fora, inteira.
// Em troca, a Tarefas conta à ferramenta que pedaço dela está na tela, para a janela e o aviso
// aparecerem onde a pessoa está olhando. A barra de carregamento é uma só, a da Tarefas, de ponta a ponta.
// Só conversa com os endereços do nads (*-nilma.web.app, as prévias deles e o próprio endereço, no
// desenvolvimento).
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { NomeIcone } from './icones';
import { origemConfiavel, origemDoPai } from './origem';

/** Uma aba de um aplicativo inteiro dentro da etapa (a Conferência): a Tarefas a desenha no cabeçalho dela. */
export interface AbaDaEtapa { id: string; rotulo: string; icone: NomeIcone; ativa?: boolean; travada?: boolean }

/**
 * Na ferramenta (um aplicativo inteiro dentro da etapa): as abas dele sobem para o cabeçalho da Tarefas, que ocupa
 * a largura toda, por cima do checklist — como no GitHub, a barra de cima "come" a lateral. Manda as abas (e a
 * aberta) sempre que mudam e recebe o clique. abas = null: não manda nada.
 */
export function useAbasParaAEtapa(abas: readonly AbaDaEtapa[] | null, onAba: ((id: string) => void) | undefined) {
  const aoClicar = useRef(onAba);
  useEffect(() => { aoClicar.current = onAba; });
  const ligado = !!abas;
  const chave = JSON.stringify(abas);
  useEffect(() => {
    const pai = ligado ? origemDoPai() : null;
    if (!pai) return;
    window.parent.postMessage({ nads: 'abas', abas: JSON.parse(chave) as AbaDaEtapa[] }, pai);
  }, [ligado, chave]);
  useEffect(() => {
    const pai = ligado ? origemDoPai() : null;
    if (!pai) return;
    const ouvir = (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== pai) return;
      const d = e.data as { nads?: string; id?: unknown } | null;
      if (d?.nads === 'aba' && typeof d.id === 'string') aoClicar.current?.(d.id);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [ligado]);
}

const ehAba = (a: unknown): a is AbaDaEtapa => !!a && typeof (a as AbaDaEtapa).id === 'string' && typeof (a as AbaDaEtapa).rotulo === 'string' && typeof (a as AbaDaEtapa).icone === 'string';

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
  const [abas, setAbas] = useState<AbaDaEtapa[]>([]);
  useEffect(() => {
    setAbas([]);
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
      const lista = (d as { abas?: unknown } | null)?.abas;
      if (d?.nads === 'abas' && Array.isArray(lista)) setAbas(lista.filter(ehAba).slice(0, 20).map(a => ({ id: a.id, rotulo: a.rotulo, icone: a.icone, ativa: !!a.ativa, travada: !!a.travada })));
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
  /** Clique numa aba da ferramenta (desenhada no cabeçalho da Tarefas): a ferramenta troca a página dela. */
  const abrirAba = useCallback((id: string) => {
    const f = iframe.current;
    if (!f?.contentWindow) return;
    f.contentWindow.postMessage({ nads: 'aba', id }, new URL(f.src, window.location.href).origin);
  }, [iframe]);
  return { altura, carregando, janelaAberta, abas, abrirAba };
}
