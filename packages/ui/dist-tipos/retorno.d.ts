import { type ReactNode } from 'react';
import { type NomeIcone } from './icones';
export interface BotaoModal<T> {
    rotulo: string;
    valor: T;
    variante?: 'btn-primary' | 'btn-outline' | 'btn-danger';
}
export interface OpcoesModal<T> {
    icone?: NomeIcone;
    titulo: string;
    /** texto simples */
    texto?: string;
    /** texto com <b>/<br> montado pelo próprio sistema (nunca com dado de fora sem escapar) */
    html?: string;
    botoes: BotaoModal<T>[];
    /** fundo embaçado e não fecha fora (pergunta obrigatória) */
    obrigatoria?: boolean;
    /** modal de sucesso (check verde grande) */
    tom?: 'ok';
    /** fecha sozinho depois de X ms devolvendo este valor (com a barrinha verde) */
    fecharEm?: {
        ms: number;
        valor: T;
    };
    /** conteúdo livre (ex.: seletor de tema) */
    corpo?: ReactNode;
}
export interface Retorno {
    toast(mensagem: string): void;
    modal<T>(o: OpcoesModal<T>): Promise<T>;
}
export declare function useRetorno(): Retorno;
export declare function RetornoProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
