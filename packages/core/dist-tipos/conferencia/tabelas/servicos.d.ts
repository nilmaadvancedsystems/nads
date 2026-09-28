import type { TipoServico } from '../tipos';
export interface ConfigServico {
    campo: 'servPrestados' | 'servTomados';
    rotulo: string;
    rotValor: string;
    /** lançamento padrão quando o participante não está numa categoria */
    lancPadrao: string;
    part: string;
    parts: string;
}
export declare const SV: Readonly<Record<TipoServico, ConfigServico>>;
export interface CategoriaServico {
    id: string;
    nome: string;
    /** lançamento fixo da categoria */
    lanc: string;
    /** permanente: ninguém tira nem coloca participante */
    travado?: boolean;
    /** participantes que sempre são desta categoria (comparação normalizada, por trecho) */
    fixos?: string[];
    fixosRot?: string[];
    dica?: string;
}
/** Categorias padrão do escritório (iguais em todas as empresas); a conta é de cada empresa. */
export declare const SERV_CAT: Readonly<Record<TipoServico, readonly CategoriaServico[]>>;
export declare function ehServ(t: string): t is TipoServico;
