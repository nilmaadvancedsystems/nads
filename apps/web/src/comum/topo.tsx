// As ações da página (canto superior direito: Reimportar, Baixar, …) moram no cabeçalho da casca,
// mas quem decide quais são é a própria página. <AcoesDoTopo> leva o que a página desenha para lá.
// Do mesmo jeito, <TrilhaDoTopo> põe os pedaços do caminho na barra de cima ("Tarefas / Vitor / Minhas empresas / 292 …"):
// a navegação fica lá, sem "← Voltar" no meio da página (Vitor, 02/10/2026).
// É de todos os aplicativos (a casca é a mesma).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type PedacoDaTrilha = { rotulo: string; titulo?: string; onClick?: () => void };

const Ctx = createContext<{
  alvo: HTMLElement | null; setAlvo: (e: HTMLElement | null) => void;
  trilha: PedacoDaTrilha[]; setTrilha: (t: PedacoDaTrilha[]) => void;
} | null>(null);

export function TopoProvider({ children }: { children: ReactNode }) {
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  const [trilha, setTrilha] = useState<PedacoDaTrilha[]>([]);
  return <Ctx.Provider value={{ alvo, setAlvo, trilha, setTrilha }}>{children}</Ctx.Provider>;
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

/** A casca lê os pedaços da trilha que a página pôs. */
export function useTrilhaDoTopo(): PedacoDaTrilha[] {
  return useContext(Ctx)?.trilha || [];
}

/** Usado pelas páginas: <TrilhaDoTopo itens={[{ rotulo: 'Minhas empresas', onClick }, { rotulo: '292 · FITO' }]} /> */
export function TrilhaDoTopo({ itens }: { itens: PedacoDaTrilha[] }) {
  const ctx = useContext(Ctx);
  const chave = itens.map(i => i.rotulo).join('/');
  useEffect(() => {
    ctx?.setTrilha(itens);
    return () => ctx?.setTrilha([]);
    // muda quando os rótulos mudam (as funções são novas a cada desenho)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return null;
}
