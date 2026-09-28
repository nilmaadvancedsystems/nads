import type { NomeIcone } from '@nads/ui';
export type IdSecao = 'importacao' | 'cadastro' | 'movimento' | 'auditoria';
export interface Pagina {
    /** "secao/pagina" — também é o caminho na URL depois da empresa */
    id: string;
    rotulo: string;
    icone: NomeIcone;
    /** título da página (o do topo) */
    titulo: string;
    /** página fora do menu: acende esta outra aba */
    acendeAba?: string;
}
export interface Secao {
    id: IdSecao;
    rotulo: string;
    icone: NomeIcone;
    grupo: number;
    paginas: Pagina[];
}
export declare const SECOES: Secao[];
/** Páginas fora do menu (abrem a partir de outra). */
export declare const PAGINAS_ESCONDIDAS: Pagina[];
export declare function paginaPorId(id: string): Pagina | undefined;
export declare function secaoDaPagina(id: string): Secao | undefined;
