import type { Conta, Empresa } from '../tipos';
/** Nota mínima para sugerir uma conta pelo nome. */
export declare const NOTA_MIN_SUGESTAO = 0.34;
/** Conta cujo nome mais parece com a natureza do CFOP (ou null). */
export declare function melhorConta(natureza: string, contas: Conta[]): Conta | null;
export interface LinhaDp {
    lanc: string;
    cfops: string[];
    natureza: string;
    qtd: number;
    conta: string;
    nome: string;
    dc: 'D' | 'C';
}
/** Lançamentos achados nas notas + os já cadastrados. */
export declare function linhasDp(e: Empresa): LinhaDp[];
/** Preenche sozinho os pendentes cuja natureza parece com o nome de uma conta livre. */
export declare function sugerirLancamentos(e: Empresa): {
    lanc: string;
    conta: Conta;
}[];
