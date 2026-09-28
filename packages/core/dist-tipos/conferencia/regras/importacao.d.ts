import type { Conta, Empresa, Nota, NotaServico, TipoNotaFiscal } from '../tipos';
export type ModoImportacao = 'novas' | 'sobrepor';
export interface SeparacaoPorTipo {
    validas: Nota[];
    foraDoTipo: Nota[];
    todasForaDoTipo: boolean;
}
/** O arquivo de Entradas só aceita CFOP de entrada (1, 2, 3) e o de Saídas só de saída (5, 6, 7). */
export declare function separarPorTipo(novas: Nota[], tipo: TipoNotaFiscal): SeparacaoPorTipo;
export interface ResultadoMescla<N> {
    notas: N[];
    adicionadas: number;
    atualizadas: number;
    semMudanca: number;
}
/** Mescla notas fiscais. Não muda as listas de entrada. */
export declare function mesclarNotas(existentes: Nota[], novas: Nota[], modo: ModoImportacao): ResultadoMescla<Nota>;
export declare function mesclarServicos(existentes: NotaServico[], novas: NotaServico[], modo: ModoImportacao): ResultadoMescla<NotaServico>;
/** Plano de contas: menos que isso de semelhança com o último balancete = parece outra empresa. */
export declare const BAL_SIMILARIDADE_MIN = 60;
/** Impressão digital do plano: código → nome normalizado. */
export declare function assinaturaBalancete(lista: Pick<Conta, 'codigo' | 'nome'>[]): Record<string, string>;
export interface VerificacaoBalancete {
    /** frases com <b> — a View mostra como HTML controlado */
    problemas: string[];
    similaridade: number | null;
}
/**
 * Esse balancete é mesmo desta empresa? O arquivo não traz nome nem CNPJ, e o plano padrão
 * repete códigos entre empresas — então compara código + nome:
 * 1) as contas vinculadas no Cadastro precisam existir no arquivo (e com o mesmo nome);
 * 2) o plano precisa ser parecido com o do último balancete desta empresa.
 */
export declare function verificarBalancete(e: Empresa, lista: Conta[]): VerificacaoBalancete;
/** Lista do balancete lido, em ordem de nome (como o original grava). */
export declare function ordenarBalancete(m: Record<string, Conta>): Conta[];
