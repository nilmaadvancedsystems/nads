// O comportamento das janelas e gavetas (revisão da UI, 16/10/2026: "Esc fecha a janela e o foco fica preso dentro dela"):
// ao abrir, o foco entra na janela (se nada lá dentro já pegou, como um autoFocus); o Tab e o Shift+Tab giram só dentro
// dela; o Esc chama o fechar (sem fechar = janela que pede uma escolha, como a da competência: o Esc não faz nada); ao
// fechar, o foco volta para quem abriu. Com uma janela por cima da outra, só a de cima responde. Com um menu aberto lá
// dentro, o Esc fecha só o menu.
import { useEffect, useRef, type RefObject } from 'react';

const FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),iframe';

/** as janelas abertas, da de baixo para a de cima */
const pilha: HTMLElement[] = [];

/** quem perdeu o foco por último: com um autoFocus lá dentro, quem abriu a janela já perdeu o foco quando o efeito roda */
let perdeuOFoco: HTMLElement | null = null;
let ouvindo = false;
function ouvirOFoco() {
  if (ouvindo || typeof document === 'undefined') return;
  ouvindo = true;
  document.addEventListener('focusout', e => { if (e.target instanceof HTMLElement) perdeuOFoco = e.target; }, true);
}
ouvirOFoco();

function focaveis(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(f => f.tabIndex >= 0 && !f.closest('[hidden],[inert]') && (f.offsetWidth > 0 || f.offsetHeight > 0 || f === document.activeElement));
}

/**
 * Liga o comportamento de janela no elemento do `ref` enquanto `aberta` for verdade.
 * fechar: o que o Esc faz (null: o Esc não fecha).
 */
export function useJanela(ref: RefObject<HTMLElement | null>, fechar: (() => void) | null | undefined, aberta = true): void {
  const aoFechar = useRef(fechar);
  useEffect(() => { aoFechar.current = fechar; });
  useEffect(() => {
    const el = ref.current;
    if (!aberta || !el) return;
    const ativo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const antes = ativo && el.contains(ativo) ? (perdeuOFoco && !el.contains(perdeuOFoco) ? perdeuOFoco : null) : ativo;
    pilha.push(el);
    // o foco entra depois do autoFocus e dos focos da própria janela (eles vêm primeiro; só sem nenhum é que entra aqui)
    const entrar = window.setTimeout(() => {
      if (!el.isConnected || el.contains(document.activeElement)) return;
      // o primeiro campo de digitar; sem campo, o primeiro botão (o ×)
      // o que está dentro de [data-sem-foco-inicial] não ganha o foco sozinho (27/10/2026: a busca da empresa no menu ☰ "só
      // fica vermelho se eu clicar")
      const lista = focaveis(el).filter(f => !f.closest('[data-sem-foco-inicial]'));
      const primeiro = lista.find(f => f.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),select,textarea')) || lista[0];
      if (primeiro) primeiro.focus({ preventScroll: true });
      else { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
    }, 0);
    const tecla = (e: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== el || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        // um menu ou seletor aberto lá dentro fecha primeiro (ele mesmo cuida do Esc)
        if (el.querySelector('[aria-haspopup][aria-expanded="true"], .popover')) return;
        if (!aoFechar.current) return;
        e.preventDefault();
        aoFechar.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const lista = focaveis(el);
      if (!lista.length) { e.preventDefault(); return; }
      const i = lista.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); lista[lista.length - 1].focus(); }
      else if (!e.shiftKey && (i === -1 || i === lista.length - 1)) { e.preventDefault(); lista[0].focus(); }
    };
    document.addEventListener('keydown', tecla);
    return () => {
      window.clearTimeout(entrar);
      document.removeEventListener('keydown', tecla);
      const k = pilha.lastIndexOf(el);
      if (k >= 0) pilha.splice(k, 1);
      if (antes && antes.isConnected && (!document.activeElement || document.activeElement === document.body || el.contains(document.activeElement))) antes.focus({ preventScroll: true });
    };
  }, [aberta, ref]);
}
