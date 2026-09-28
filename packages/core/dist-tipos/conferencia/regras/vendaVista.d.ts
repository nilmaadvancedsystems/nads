import type { Empresa, GrupoNatureza, Nota } from '../tipos';
/** CFOP de venda (mercadorias e produtos), fora a venda de ativo imobilizado. */
export declare function ehCfopVenda(n: Pick<Nota, 'cfop'> & {
    desc?: string;
}): boolean;
/** À vista: CPF no documento, "consumidor final" no nome, ou sem documento e sem nome. */
export declare function ehVendaVista(n: Pick<Nota, 'nome'> & {
    doc?: string;
}): boolean;
export interface ContextoVista {
    lancs: Record<string, string>;
    /** lançamento mais usado nas vendas à vista de cada natureza */
    maior: Record<string, string>;
    prazo: Record<string, string>;
}
/** Contexto das vendas à vista (null com a opção desligada). */
export declare function ctxVista(e: Empresa): ContextoVista | null;
export interface LancEsperado {
    lanc: string;
    origem: 'vista' | 'prazo';
    cadastrado: boolean;
}
/** Venda à vista (com a opção ligada) é conferida contra o lançamento à vista, fora da maioria do CFOP. */
export declare function lancEsperadoSaida(n: Nota, ctx: ContextoVista | null): LancEsperado | null;
export declare function lancVistaDaNota(n: Nota, ctx: ContextoVista | null): string | null;
export declare function ehGrupoVenda(gr: Pick<GrupoNatureza, 'cfops' | 'desc'>): boolean;
export type TipoVista = 'vista' | 'prazo';
export declare const VISTA_TIPOS: readonly {
    t: TipoVista;
    rot: string;
}[];
export declare function vistaValor(e: Empresa, k: string, t: TipoVista): string;
/** Linha de lançamentos à vista/a prazo de um CFOP de venda: quantidades e sugestão (o mais usado). */
export declare function resumoVistaDoGrupo(e: Empresa, k: string, gr: GrupoNatureza): {
    qtd: Record<TipoVista, number>;
    sug: Partial<Record<TipoVista, string>>;
};
/** CFOPs de venda sem o lançamento à vista ou a prazo (com a opção ligada). */
export declare function vistaPendentes(e: Empresa): {
    k: string;
    t: TipoVista;
}[];
/** Saídas guardadas sem a coluna CPF/CNPJ (importadas antes dela existir). */
export declare function saidasSemDocumento(e: Empresa): boolean;
