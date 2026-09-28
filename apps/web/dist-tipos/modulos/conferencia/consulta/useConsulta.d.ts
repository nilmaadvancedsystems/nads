import { conferencia as c } from '@nads/core';
export declare function useConsulta(): {
    aba: c.GrupoConsulta;
    abas: {
        valor: "fiscais" | "servicos";
        rotulo: string;
        travada: string | false;
    }[];
    escolherAba: (g: c.GrupoConsulta) => void;
    serv: boolean;
    vazia: boolean;
    rascunho: {
        q: string;
        de: string;
        ate: string;
    };
    setBusca: (q: string) => void;
    setDe: (de: string) => void;
    setAte: (ate: string) => void;
    pesquisar: () => void;
    temBusca: boolean;
    temPeriodo: boolean;
    limparBusca: () => void;
    limparPeriodo: () => void;
    ordem: {
        col: c.CampoOrdem;
        dir: "desc" | "asc";
    };
    ordenar: (campo: c.CampoOrdem) => void;
    qtd: number;
    qtdTotal: number;
    filtrado: boolean;
    total: number;
    linhas: c.NotaConsulta[];
    limite: number;
    tipos: readonly {
        tipo: c.TipoMovimento;
        rotulo: string;
        cor: string;
    }[];
    csv: () => {
        texto: string;
        nome: string;
    };
};
