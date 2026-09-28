import type { Empresa, FiltroMovimento, TipoCfop } from '../tipos';
export interface LinhaChecklist {
    chave: string;
    /** marca de conferência: periodoKey||natureza */
    marca: string;
    tipo: TipoCfop;
    titulo: string;
    qtdNotas: number;
    total: number;
    /** % do maior valor da lista (barrinha) */
    proporcao: number;
    marcado: boolean;
    automatico: boolean;
    contas: string[];
    naoContabil: boolean;
}
export interface Checklist {
    linhas: LinhaChecklist[];
    /** havia naturezas no período (o vazio muda de texto) */
    temNaturezas: boolean;
    marcarSozinho: {
        chave: string;
        texto: string;
    }[];
}
export declare function montarChecklist(e: Empresa, f: FiltroMovimento): Checklist;
/** Meses marcados no Relatório, para o aviso do Checklist. */
export declare function mesesMarcados(f: FiltroMovimento): string[];
