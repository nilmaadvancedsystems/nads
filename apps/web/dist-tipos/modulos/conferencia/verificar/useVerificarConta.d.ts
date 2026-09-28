import { conferencia as c } from '@nads/core';
export declare const VC_LIMITE_LINHAS = 300;
/** O que aparece embaixo do campo do relatório enquanto lê / quando dá erro. */
export interface InfoRelatorio {
    tom: 'lendo' | 'erro';
    titulo?: string;
    texto?: string;
}
export declare function useVerificarConta(): {
    semPlano: boolean;
    contaTexto: string;
    conta: c.Conta;
    multi: boolean;
    servico: {
        rotulo: string;
        qtdNotas: number;
        qtdParticipantes: number;
        rotParticipantes: string;
        soma: number;
    } | null;
    cfop: {
        desabilitado: boolean;
        valor: string;
        opcoes: {
            valor: string;
            rotulo: string;
        }[];
    } | null;
    escolherCfop: (valor: string) => void;
    relatorios: {
        codigo: string;
        nome: string;
        linhas: number;
        arquivo: string;
        info: InfoRelatorio;
    }[];
    escolherRelatorio: (codigo: string, f: File | null) => Promise<void>;
    abrirArquivo: {
        codigo: string;
        n: number;
    } | null;
    comparando: boolean;
    conferir: () => void;
    limpar: () => Promise<void>;
    voltar: () => void;
    resultado: {
        porConta: {
            conta: {
                codigo: string;
                nome: string;
            };
            somaConta: number;
            pendencias: number;
            pendZero: boolean;
            dups: c.LinhaTabela[];
            somaDups: number;
            mais: c.LinhaTabela[];
            somaMais: number;
        };
        todas: null;
        aba: string;
        abas: {
            valor: string;
            rotulo: string;
        }[] | null;
        limpo: boolean;
        fonte: string;
    } | {
        porConta: null;
        todas: {
            conta: {
                codigo: string;
                nome: string;
            };
            multi: boolean;
            somaRazao: number;
            somaFiscal: number;
            diferenca: number;
            zero: boolean;
            composicao: c.ItemComposicao[] | null;
            faltando: c.LinhaTabela[];
            somaFaltando: number;
            duplicadas: c.LinhaTabela[];
            qtdDuplicadas: number;
            somaDuplicadas: number;
            aMais: c.LinhaTabela[];
            somaAMais: number;
            icms: c.LinhaTabela[];
            somaIcms: number;
            conferido: boolean;
            podeConferir: boolean;
        };
        aba: string;
        abas: {
            valor: string;
            rotulo: string;
        }[] | null;
        limpo: boolean;
        fonte: string;
    } | null;
    seqResultado: number;
    escolherAba: (aba: string) => void;
    reimportar: () => Promise<void>;
    alternarConferido: () => void;
    csv: () => {
        texto: string;
        nome: string;
    } | null;
};
