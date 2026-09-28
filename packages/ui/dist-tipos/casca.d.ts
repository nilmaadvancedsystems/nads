import { type ReactNode } from 'react';
import { type NomeIcone } from './icones';
export interface SecaoCasca {
    id: string;
    rotulo: string;
    icone: NomeIcone;
    grupo: number;
    ativa?: boolean;
    travada?: boolean;
}
export interface PaginaCasca {
    id: string;
    rotulo: string;
    icone: NomeIcone;
    ativa?: boolean;
    travada?: boolean;
    oculta?: boolean;
}
export declare function Casca(p: {
    sistema: string;
    empresa: {
        codigo: string;
        nome: string;
    };
    versao: string;
    secoes: SecaoCasca[];
    paginas: PaginaCasca[];
    titulo: string;
    acoes?: ReactNode;
    onSecao: (id: string) => void;
    onPagina: (id: string) => void;
    onInicio: () => void;
    onEmpresa: () => void;
    onSair: () => void;
    children: ReactNode;
}): import("react").JSX.Element;
/** Baixa um arquivo gerado no navegador (CSV etc.). */
export declare function baixarArquivo(texto: string, nome: string, tipo?: string): void;
