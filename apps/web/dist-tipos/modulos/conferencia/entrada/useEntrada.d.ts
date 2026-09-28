import { conferencia as c } from '@nads/core';
export declare const LIMITE_LISTA = 50;
export declare function useEntrada(): {
    busca: string;
    setBusca: (v: string) => void;
    listaAberta: boolean;
    abrirLista: () => void;
    fecharLista: () => number;
    achadas: c.EmpresaDaLista[];
    total: number;
    entrar: (nome: string) => void;
    confirmar: () => void;
    restaurarExemplos: () => void;
};
