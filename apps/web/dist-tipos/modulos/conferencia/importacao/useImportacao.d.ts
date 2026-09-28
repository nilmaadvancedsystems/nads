import { conferencia as c } from '@nads/core';
type TipoImp = c.PaginaImportacao;
export interface ConfigImportacao {
    titulo: string;
    icone: 'landmark' | 'arrowDown' | 'arrowUp' | 'fileDown' | 'fileUp';
    dica: string;
    aceitar: string;
    /** id da mensagem flutuante (o CSS original posiciona por id) */
    idMensagem: string;
    idArquivo: string;
}
export declare const CONFIG: Record<TipoImp, ConfigImportacao>;
/** O que a mensagem flutuante mostra (a View desenha). */
export interface Mensagem {
    tom: 'erro' | 'ok' | 'lendo';
    titulo: string;
    textos: {
        texto: string;
        tom?: 'aviso';
        separado?: boolean;
    }[];
}
export declare function useImportacao(tipo: TipoImp): {
    cfg: ConfigImportacao;
    ja: boolean;
    mostrarCaixa: boolean;
    reimportando: boolean;
    alternarReimportar: () => void;
    abrirArquivo: number;
    arquivo: File | null;
    setArquivo: import("react").Dispatch<import("react").SetStateAction<File | null>>;
    carregando: boolean;
    importar: () => Promise<void>;
    excluir: () => Promise<void>;
    mensagem: Mensagem | null;
    seqMensagem: number;
    fecharMensagem: () => void;
    boasVindas: boolean;
    autoLimpar: boolean;
    definirAutoLimpar: (ligado: boolean) => void;
    alternarAutoLimpar: () => void;
    plano: {
        resumo: {
            grupo: c.Grupo;
            qtd: number;
            ativo: boolean;
        }[];
        grupos: {
            grupo: c.Grupo;
            contas: c.Conta[];
        }[];
        comTitulo: boolean;
    } | null;
    alternarGrupo: (g: c.Grupo) => void;
    notas: {
        qtd: number;
        total: number;
        periodo: string;
        linhas: c.Nota[];
    } | null;
    servicos: {
        qtd: number;
        total: number;
        rotValor: string;
        qtdParticipantes: number;
        rotParticipantes: string;
        rotParticipante: string;
        comIss: boolean;
        periodo: string;
        linhas: c.NotaServico[];
    } | null;
};
export declare const LIMITE_LINHAS = 400;
export {};
