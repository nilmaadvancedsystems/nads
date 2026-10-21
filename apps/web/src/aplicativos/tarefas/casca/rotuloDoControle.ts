// O rótulo de um controle na tela (o botão, o link, a aba…), o mesmo para a coleta do uso (ColetaDeUso.tsx) e para o
// mapa na tela (MapaNaTela.tsx, os botões pintados pelos cliques): os dois precisam achar o controle pelo mesmo nome.
// Nunca o que se digita, valor de campo, dado de cliente nem nada do cofre (uso.rotuloLimpo; nas Senhas só o rótulo
// acessível).
import { uso } from '@nads/core';

/** o que conta como controle */
export const CONTROLE = '[data-uso], button, a[href], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="switch"], [role="option"], [role="button"], summary, .chip-f';
/**
 * a casca (o aviso do topo, o cabeçalho, a lateral, a gaveta) e o balão do suporte: não são botões da tela, então não
 * entram nem nos cliques nem nos "vistos" de cada tela (21/10/2026: o "Abrir menu" e os itens da lateral apareciam como
 * os botões mais usados de toda tela); a visita da tela já diz o uso da navegação
 */
export const DA_CASCA = '.acima-do-cabecalho, .gh-header, .subnav, .drawer, .suporte-botao, .suporte-balao';
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
export function rotuloDoControle(alvo: Element | null, tela: string, nomes: readonly string[]): string | null {
  const el = alvo?.closest(CONTROLE);
  if (!el || el.closest('[data-uso-ignorar], input, textarea, select, [contenteditable="true"]') || el.closest(DA_CASCA)) return null;
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
