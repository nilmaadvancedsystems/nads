// As ações da página (canto superior direito: Reimportar, Baixar, …) moram no cabeçalho da casca,
// mas quem decide quais são é a própria página. <AcoesDoTopo> leva o que a página desenha para lá.
// É de todos os aplicativos (a casca é a mesma).
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const Ctx = createContext<{ alvo: HTMLElement | null; setAlvo: (e: HTMLElement | null) => void } | null>(null);

export function TopoProvider({ children }: { children: ReactNode }) {
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  return <Ctx.Provider value={{ alvo, setAlvo }}>{children}</Ctx.Provider>;
}

/** Onde as ações aparecem (dentro da casca). */
export function LugarDasAcoes() {
  const ctx = useContext(Ctx);
  return <span ref={el => { if (ctx && ctx.alvo !== el) ctx.setAlvo(el); }} style={{ display: 'contents' }} />;
}

/** Usado pelas páginas: <AcoesDoTopo><button …/></AcoesDoTopo> */
export function AcoesDoTopo({ children }: { children: ReactNode }) {
  const ctx = useContext(Ctx);
  return ctx?.alvo ? createPortal(children, ctx.alvo) : null;
}
