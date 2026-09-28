import type { Empresa, RegistroConferencia } from '../tipos';
export interface LinhaAuditoria {
    ts: string;
    tipo: string;
    acao: string;
    tom: 'ok' | 'bad' | 'neutral';
    detalhe: string;
    origem: 'Manual' | 'Automático';
    /** marcação automática que ainda dá pra remover */
    remover?: {
        chave: string;
        texto: string;
    };
}
export declare function linhasAuditoria(e: Empresa): LinhaAuditoria[];
/**
 * Registra no histórico. Desfazer a mesma coisa no mesmo minuto (marcou sem querer e
 * corrigiu na hora) apaga o registro anterior em vez de guardar os dois.
 * Devolve o histórico novo (não muda o de entrada).
 */
export declare function registrarHist(hist: RegistroConferencia[], chave: string, texto: string, marcado: boolean, agora: Date, categoria?: RegistroConferencia['categoria']): RegistroConferencia[];
/**
 * Checklist: marcar/desmarcar à mão. Desmarcar o que acabou de marcar no mesmo minuto
 * some com o registro (só nesse sentido, como no original).
 */
export declare function registrarMarcaChecklist(hist: RegistroConferencia[], chave: string, texto: string, marcado: boolean, agora: Date): RegistroConferencia[];
