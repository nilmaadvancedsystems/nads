import type { Empresa, FiltroMovimento, GrupoNatureza, NotaComTipo, TipoCfop } from '../tipos';
import { type LinhaSaldo } from './conciliacao';
export type AbaRelatorio = 'geral' | 'entradas' | 'saidas' | 'tomados' | 'prestados';
export declare function tipoDaAba(aba: AbaRelatorio): '' | TipoCfop;
export interface MesDoGrafico {
    comp: string;
    ent: number;
    sai: number;
    qtd: number;
}
/** Entradas × saídas por mês (só aparece com 2 meses ou mais). */
export declare function porMes(base: NotaComTipo[]): MesDoGrafico[];
export interface ItemRank {
    k: string;
    tipo: TipoCfop;
    nome: string;
    cfops: string;
    valor: number;
}
/** Maiores naturezas por valor no período (até 7; só com 2 ou mais naturezas). */
export declare function maioresNaturezas(grupos: Record<string, GrupoNatureza>): ItemRank[];
export interface Relatorio {
    totEnt: number;
    totSai: number;
    qtdNotas: number;
    qtdNaturezas: number;
    meses: MesDoGrafico[];
    rank: ItemRank[];
    saldo: LinhaSaldo[];
    /** naturezas que batem com o balancete e ainda não estão marcadas (o antigo autoMarcarConferidos) */
    marcarSozinho: {
        chave: string;
        texto: string;
    }[];
}
/** Tudo que a aba Geral/Entradas/Saídas do Relatório mostra, num cálculo só. */
export declare function montarRelatorio(e: Empresa, f: FiltroMovimento, tipoF: '' | TipoCfop): Relatorio;
