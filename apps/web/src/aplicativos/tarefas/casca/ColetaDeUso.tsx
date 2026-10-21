// A coleta do uso do sistema (Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo usado no sistema, botões e
// funcionalidades para sabermos o que está inútil"), montada uma vez na Tarefas, sem mexer tela por tela. A View olha
// o DOM; a conta e a gravação ficam em useColetaDeUso:
//   - cada clique num controle (botão, link, aba, item de menu, chip, interruptor, ou o que tiver data-uso) vai com o
//     rótulo limpo e a posição na tela;
//   - um pouco depois de abrir a tela, os controles que aparecem vão como "vistos" (é assim que se sabe dos sem clique);
//   - ao esconder ou fechar a aba, grava o que se juntou.
// Nunca o que se digita, valor de campo, dado de cliente nem nada do cofre: só o rótulo do controle (uso.rotuloLimpo),
// e nas Senhas só o rótulo acessível (nunca o texto do botão).
import { uso } from '@nads/core';
import { useEffect, useRef } from 'react';
import { useColetaDeUso } from './useColetaDeUso';

/** o que conta como controle */
const CONTROLE = '[data-uso], button, a[href], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="switch"], [role="option"], [role="button"], summary, .chip-f';
/** a navegação da casca (a gaveta, a lateral, o topo): conta o clique, mas não entra nos "vistos" de cada tela */
const DA_CASCA = '.drawer-item, .subnav-item, .gh-hamb, .gh-avatar, .gh-topo-btn';
/** texto maior que isto é de uma linha de lista (o assunto do e-mail, o nome do cliente): vira "item da lista" */
const TEXTO_CURTO = 40;

function tipoDe(el: Element): string {
  const papel = el.getAttribute('role');
  if (papel === 'tab') return 'Aba: ';
  if (papel === 'switch') return 'Interruptor: ';
  if (papel && papel.startsWith('menuitem')) return 'Menu: ';
  if (el.classList.contains('chip-f')) return 'Filtro: ';
  if (el.tagName === 'A') return 'Link: ';
  return '';
}

/** o rótulo do controle (limpo), ou null quando não é controle ou não se deve guardar */
function rotuloDoControle(alvo: Element | null, tela: string, nomes: readonly string[]): string | null {
  const el = alvo?.closest(CONTROLE);
  if (!el || el.closest('[data-uso-ignorar], input, textarea, select, [contenteditable="true"]')) return null;
  const marcado = el.getAttribute('data-uso');
  if (marcado) return uso.rotuloLimpo(marcado, nomes);
  // nas Senhas (e na aba Senhas da empresa) nunca o texto do botão: só o rótulo acessível ou a dica
  const sensivel = tela.startsWith('senhas/') || tela === 'cadastro/empresas/senhas';
  const daLista = !!el.closest('tbody, [role="row"], .gm-item');
  const acessivel = el.getAttribute('aria-label') || el.getAttribute('title') || '';
  const texto = (el.textContent || '').replace(/\s+/g, ' ').trim();
  const bruto = acessivel || (sensivel ? '' : texto.length <= TEXTO_CURTO && !daLista ? texto : '');
  const limpo = uso.rotuloLimpo(bruto, nomes);
  if (!limpo) return daLista || texto ? 'item da lista' : null;
  return tipoDe(el) + limpo;
}

export function ColetaDeUso() {
  const vm = useColetaDeUso();
  const agora = useRef(vm);
  useEffect(() => { agora.current = vm; });
  const { ativo, tela } = vm;

  // os controles que apareceram na tela, um pouco depois de ela abrir e de novo mais tarde (a tela que ainda carregava);
  // depois disso, a tela fica vista nesta sessão
  useEffect(() => {
    if (!ativo || !tela || agora.current.jaViu(tela)) return;
    const olhar = (final: boolean) => {
      const vistos = new Set<string>();
      for (const el of document.querySelectorAll(CONTROLE)) {
        if (vistos.size >= uso.MAX_CONTROLES_POR_TELA) break;
        if (el.matches(DA_CASCA) || !el.getClientRects().length) continue;
        const r = rotuloDoControle(el, tela, agora.current.nomes);
        if (r && r !== 'item da lista') vistos.add(r);
      }
      agora.current.viu(tela, [...vistos], final);
    };
    const primeiro = setTimeout(() => olhar(false), 3000);
    const segundo = setTimeout(() => olhar(true), 10000);
    return () => { clearTimeout(primeiro); clearTimeout(segundo); };
  }, [ativo, tela]);

  // os cliques (na captura: conta antes de a tela trocar) e a gravação ao esconder ou fechar a aba
  useEffect(() => {
    if (!ativo) return;
    const aoClicar = (ev: MouseEvent) => {
      const { tela: t, nomes } = agora.current;
      if (!t) return;
      const controle = rotuloDoControle(ev.target instanceof Element ? ev.target : null, t, nomes);
      if (controle) agora.current.clicou(t, controle, ev.clientX, ev.clientY, window.innerWidth, window.innerHeight);
    };
    const aoEsconder = () => { if (document.visibilityState === 'hidden') agora.current.gravar(); };
    const aoSair = () => agora.current.gravar();
    document.addEventListener('click', aoClicar, true);
    document.addEventListener('visibilitychange', aoEsconder);
    window.addEventListener('pagehide', aoSair);
    return () => {
      document.removeEventListener('click', aoClicar, true);
      document.removeEventListener('visibilitychange', aoEsconder);
      window.removeEventListener('pagehide', aoSair);
    };
  }, [ativo]);

  return null;
}
