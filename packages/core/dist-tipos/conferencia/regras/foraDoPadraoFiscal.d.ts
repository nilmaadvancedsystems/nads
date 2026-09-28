import type { Empresa, TipoNotaFiscal } from '../tipos';
import { type OrdemGrupos } from './cfop';
import { type Divergencia } from './divergencias';
export interface GrupoForaDoPadrao {
    /** chave da natureza (a do agruparPorNatureza) */
    key: string;
    titulo: string;
    total: number;
    /** itens do grupo, por data */
    itens: Divergencia[];
    /** marcas de "corrigido" de todas as notas fora do padrão da natureza (o checkbox do grupo) */
    chavesDaNatureza: string[];
}
export interface ForaDoPadraoFiscal {
    temDivergencias: boolean;
    pendentes: GrupoForaDoPadrao[];
    corrigidos: GrupoForaDoPadrao[];
    qtdCorrigidos: number;
}
export declare function foraDoPadraoFiscal(e: Empresa, tipo: TipoNotaFiscal, ordem: OrdemGrupos): ForaDoPadraoFiscal;
