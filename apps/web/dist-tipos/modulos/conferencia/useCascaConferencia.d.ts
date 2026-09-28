import { type IdSecao } from './navegacao';
export declare const VERSAO = "nads 0.1 \u00B7 c\u00F3pia da Confer\u00EAncia beta 0.1.63";
export declare function useCascaConferencia(): {
    empresa: {
        codigo: string;
        nome: string;
    };
    titulo: string;
    versao: string;
    secoes: {
        id: IdSecao;
        rotulo: string;
        icone: "search" | "repeat" | "link" | "alert" | "relatorio" | "checklist" | "briefcase" | "fileDown" | "fileUp" | "zap" | "home" | "landmark" | "arrowDown" | "arrowUp" | "check" | "checkCircle" | "scale" | "lock" | "unlock" | "x" | "sun" | "moon" | "monitor" | "upload" | "fileText" | "clock" | "chevronsLeft" | "settings" | "logOut" | "barChart" | "calendar" | "plus" | "fileSearch" | "hash" | "list" | "menu" | "painel";
        grupo: number;
        ativa: boolean;
        travada: boolean;
        req: string;
    }[];
    paginas: {
        id: string;
        rotulo: string;
        icone: "search" | "repeat" | "link" | "alert" | "relatorio" | "checklist" | "briefcase" | "fileDown" | "fileUp" | "zap" | "home" | "landmark" | "arrowDown" | "arrowUp" | "check" | "checkCircle" | "scale" | "lock" | "unlock" | "x" | "sun" | "moon" | "monitor" | "upload" | "fileText" | "clock" | "chevronsLeft" | "settings" | "logOut" | "barChart" | "calendar" | "plus" | "fileSearch" | "hash" | "list" | "menu" | "painel";
        ativa: boolean;
        oculta: boolean;
    }[];
    onSecao: (id: string) => void;
    onPagina: (id: string) => void;
    sair: () => void;
    voltarInicioDaEmpresa: () => void;
    msgCadastro: string;
    paginaExiste: boolean;
};
