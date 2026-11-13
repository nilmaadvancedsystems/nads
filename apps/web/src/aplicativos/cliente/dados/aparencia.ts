// O modo OLED da Área do Cliente (13/11/2026: "quero que faça um modo para tela OLED"): o tema escuro com o preto puro no
// fundo e nos cartões (as telas OLED apagam o pixel preto: economiza bateria e o contraste fica máximo). Fica só no
// navegador (localStorage), como o tema claro/escuro do nads; o <html> ganha data-oled e o tema fica escuro.
const CHAVE = 'nads-area-cliente|oled';

export function lerOled(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

export function guardarOled(ligado: boolean): void {
  try { if (ligado) localStorage.setItem(CHAVE, '1'); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento: vale só agora */ }
}

/** liga ou desliga o preto puro na página (o atributo no <html>, para valer também nas janelas e nos menus) */
export function aplicarOled(ligado: boolean): void {
  if (typeof document === 'undefined') return;
  if (ligado) document.documentElement.setAttribute('data-oled', '');
  else document.documentElement.removeAttribute('data-oled');
}
