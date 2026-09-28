import { conferencia as c } from '@nads/core';
type TipoNat = c.FiltroMovimento['tipo'];
type Status = c.FiltroMovimento['status'];
export declare const OPCOES_STATUS: [Status, string][];
export declare function useChecklist(): {
    recortes: {
        valor: TipoNat;
        rotulo: string;
        travada: string | false;
    }[];
    tipo: "" | c.TipoCfop;
    escolherRecorte: (v: TipoNat) => void;
    status: "" | "conferido" | "pendente";
    setStatus: (v: Status) => void;
    busca: string;
    limparBusca: () => void;
    mesesMarcados: string;
    linhas: {
        anima: boolean;
        contaTexto: string;
        chave: string;
        marca: string;
        tipo: c.TipoCfop;
        titulo: string;
        qtdNotas: number;
        total: number;
        proporcao: number;
        marcado: boolean;
        automatico: boolean;
        contas: string[];
        naoContabil: boolean;
    }[];
    vazio: string;
    marcar: (l: c.LinhaChecklist, marcado: boolean) => void;
};
export {};
