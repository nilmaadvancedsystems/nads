// O "Resolver" do que falta (Vitor, 02/10/2026): a ferramenta vai até o lugar do problema e o destaca. Espera a tela
// trocar (a aba, a linha que abre), leva o primeiro até o meio da tela e faz todos pulsarem 3 vezes, devagar (o CSS).

const CLASSE = 'nads-destaque';

/** Destaca o que bate com o seletor (depois que a tela desenhar). Devolve se achou alguma coisa. */
export function destacarNaTela(seletor: string, ms = 4400): Promise<boolean> {
  return new Promise(resolver => {
    // um instante: a troca de aba ou a linha que abre já foram desenhadas
    setTimeout(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(seletor));
      if (!els.length) { resolver(false); return; }
      document.querySelectorAll('.' + CLASSE).forEach(e => e.classList.remove(CLASSE));
      els.forEach(e => e.classList.add(CLASSE));
      els[0].scrollIntoView({ block: 'center' });
      setTimeout(() => els.forEach(e => e.classList.remove(CLASSE)), ms);
      resolver(true);
    }, 150);
  });
}
