import type { Empresa, FiltroMovimento, NotaComTipo } from '../tipos';
type Periodo = Pick<FiltroMovimento, 'dataDe' | 'dataAte' | 'meses'>;
/** A nota está no período (datas e meses marcados)? */
export declare function noPeriodo(n: {
    data: string;
    comp: string;
}, p: Periodo): boolean;
/** Só pelas datas — a base do gráfico mensal, que mostra todos os meses mesmo com um marcado. */
export declare function notasBase(e: Empresa, p: Periodo): NotaComTipo[];
export declare function notasNoPeriodo(e: Empresa, p: Periodo): NotaComTipo[];
/** Prefixo das marcas de conferência: cada período tem as suas. */
export declare function periodoKey(p: Periodo): string;
export {};
