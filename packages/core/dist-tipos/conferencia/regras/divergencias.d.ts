import type { Empresa, Nota, TipoNotaFiscal } from '../tipos';
/** Mínimo de notas no CFOP para existir padrão. */
export declare const MIN_NOTAS_PADRAO = 3;
/** Fração mínima do lançamento dominante para virar padrão. */
export declare const FRACAO_PADRAO = 0.6;
export interface PadraoCfop {
    lanc: string;
    qtd: number;
    total: number;
}
export declare function padraoPorCfop(e: Empresa, tipo: TipoNotaFiscal): Record<string, PadraoCfop>;
export interface Divergencia {
    nota: Nota;
    chave: string;
    /** lançamento esperado */
    padrao: string;
    /** esperado veio do cadastro (à vista/a prazo) e não da maioria */
    cadastrado?: boolean;
    origem?: 'vista' | 'prazo' | 'cnpjVista';
    qtdPadrao?: number;
    totalCfop?: number;
}
export declare function acharDivergencias(e: Empresa, tipo: TipoNotaFiscal): Divergencia[];
/** Marca de "corrigido" de uma nota fora do padrão. */
export declare function chaveResolvido(tipo: TipoNotaFiscal, chave: string): string;
