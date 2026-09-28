import type { GrupoNatureza, Nota, NotaComTipo, TipoCfop } from '../tipos';
/** CFOP 1xxx, 2xxx, 3xxx = entrada; 5xxx, 6xxx, 7xxx = saída. */
export declare function tipoDoCfop(cfop: string | null | undefined): TipoCfop | null;
/** Descrições que existem em CFOP de entrada E de saída (ex.: Frete Comercial 1353/5353):
 *  sem separar, entrada e saída cairiam no mesmo grupo e somariam juntas. */
export declare const DESC_AMBOS: Readonly<Record<string, true>>;
/** Descrição do CFOP: a oficial ou, sem ela, a que veio no arquivo. */
export declare function descDoCfop(cfop: string, descArquivo?: string): string;
/** Chave da natureza de CFOP de uma nota (o que o Cadastro liga às contas). */
export declare function chaveNaturezaNota(n: Pick<Nota, 'cfop' | 'desc'> & {
    tipo?: TipoCfop;
}, tipoPadrao?: TipoCfop): string;
/** Identidade de uma nota fiscal (dedupe na importação e marca de "corrigido"). */
export declare function chaveNota(n: Pick<Nota, 'cfop' | 'numero' | 'data' | 'valor'>): string;
/** Entradas + saídas com o tipo do CFOP resolvido. */
export declare function comTipo(entradas: Nota[], saidas: Nota[]): NotaComTipo[];
/** Agrupa notas pela natureza de CFOP (chave do Cadastro). */
export declare function agruparTotaisPorNatureza(notas: NotaComTipo[]): Record<string, GrupoNatureza>;
/** "1102, 1403 — Compra para comercialização" */
export declare function tituloDoGrupo(gr: {
    cfops: string[];
    desc: string;
}): string;
export declare function somaValores(itens: {
    valor: number;
}[]): number;
/** Ordena as chaves de naturezas pelo menor CFOP do grupo. */
export declare function ordenarPorCfop(grupos: Record<string, {
    cfops: string[];
}>): string[];
export interface ItemComNota {
    nota: Nota;
}
export interface GrupoDeItens<T extends ItemComNota> {
    key: string;
    desc: string;
    cfops: string[];
    itens: T[];
}
export type OrdemGrupos = 'cfop' | 'valor' | 'data';
export declare function agruparPorNatureza<T extends ItemComNota>(lista: T[]): Record<string, {
    desc: string;
    cfops: string[];
    itens: T[];
}>;
export declare function ordenarGrupos<T extends ItemComNota>(g: Record<string, {
    desc: string;
    cfops: string[];
    itens: T[];
}>, ordem: OrdemGrupos): GrupoDeItens<T>[];
