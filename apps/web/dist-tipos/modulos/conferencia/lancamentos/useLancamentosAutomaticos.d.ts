import { conferencia as c } from '@nads/core';
export interface GrupoDeContas {
    grupo: c.Grupo;
    contas: {
        codigo: string;
        nome: string;
    }[];
}
export declare function useLancamentosAutomaticos(): {
    classeBotao: string;
    preencherAutomatico: () => void;
    semLinhas: boolean;
    pendentes: {
        lanc: string;
        cfops: string;
        natureza: string;
        conta: string;
        foraDoPlano: boolean;
    }[];
    vinculadas: {
        lanc: string;
        cfops: string;
        natureza: string;
        conta: string;
        foraDoPlano: boolean;
    }[];
    grupos: GrupoDeContas[];
    escolherConta: (lanc: string, codigo: string) => void;
    remover: (lanc: string) => void;
};
