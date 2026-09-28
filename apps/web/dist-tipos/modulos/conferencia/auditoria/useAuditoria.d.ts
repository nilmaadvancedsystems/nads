import { conferencia as c } from '@nads/core';
export declare function useAuditoria(): {
    linhas: c.LinhaAuditoria[];
    remover: (r: {
        chave: string;
        texto: string;
    }) => void;
};
