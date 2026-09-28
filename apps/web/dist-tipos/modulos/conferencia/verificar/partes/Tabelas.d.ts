import { type conferencia as c } from '@nads/core';
import type { ReactNode } from 'react';
export declare function TabelaFaltando({ linhas }: {
    linhas: c.LinhaTabela[];
}): import("react").JSX.Element;
/** cls: classe da linha ("bad" por padrão; ICMS vai sem). */
export declare function TabelaVc({ linhas, cls }: {
    linhas: c.LinhaTabela[];
    cls?: string;
}): import("react").JSX.Element;
/** Uma seção das pendências: "Título — R$ x" e a tabela. */
export declare function SecaoVc({ titulo, valor, className, children }: {
    titulo: string;
    valor: number;
    className?: string;
    children: ReactNode;
}): import("react").JSX.Element;
/** Aviso verde (.alert com as cores de sucesso), com margem opcional como no original. */
export declare function AlertaVerde({ titulo, children, margem }: {
    titulo: string;
    children?: ReactNode;
    margem?: string;
}): import("react").JSX.Element;
