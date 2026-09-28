import { conferencia as c } from '@nads/core';
/** O que falta importar para a aba destravar (o data-req do original). */
export type ReqAba = 'entradas' | 'saidas' | 'tomados' | 'prestados';
/** title da aba travada ("Importe as entradas primeiro"), ou false se tem dado. */
export declare function travaDaAba(tem: c.Disponivel, req: ReqAba): string | false;
/**
 * Marca sozinho o que bateu com o balancete. Só dispara quando há o que marcar, e nunca
 * duas vezes a mesma lista (depois de marcar, a lista nova vem vazia).
 */
export declare function useMarcarSozinho(itens: {
    chave: string;
    texto: string;
}[] | null): void;
