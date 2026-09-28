import { type ReactNode } from 'react';
export declare function TopoProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
/** Onde as ações aparecem (dentro da casca). */
export declare function LugarDasAcoes(): import("react").JSX.Element;
/** Usado pelas páginas: <AcoesDoTopo><button …/></AcoesDoTopo> */
export declare function AcoesDoTopo({ children }: {
    children: ReactNode;
}): import("react").ReactPortal | null;
