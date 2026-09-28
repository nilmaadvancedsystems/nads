import type { Empresa, TipoMovimento } from '../tipos';
export type GrupoConsulta = 'fiscais' | 'servicos';
export declare const CONS_TIPOS: readonly {
    tipo: TipoMovimento;
    rotulo: string;
    cor: string;
}[];
/** Uma linha da Consulta (nota fiscal ou de serviço, com o tipo). */
export interface NotaConsulta {
    tipo: TipoMovimento;
    ordemTipo: number;
    data: string;
    numero: string;
    nome: string;
    cfop: string;
    lanc: string;
    valor: number;
    iss: number;
}
export declare function listaConsulta(e: Empresa, g: GrupoConsulta): NotaConsulta[];
export type CampoOrdem = 'tipo' | 'data' | 'numero' | 'nome' | 'cfop' | 'lanc' | 'valor' | 'iss';
export interface FiltroConsulta {
    de: string;
    ate: string;
    q: string;
    sortCol: CampoOrdem;
    sortDir: 'asc' | 'desc';
}
export declare const FILTRO_CONSULTA_VAZIO: FiltroConsulta;
export declare function filtrarConsulta(lista: NotaConsulta[], f: FiltroConsulta): NotaConsulta[];
/** Clicar no cabeçalho: mesma coluna inverte, outra começa crescente. */
export declare function alternarOrdem(f: FiltroConsulta, campo: CampoOrdem): FiltroConsulta;
/** Linhas do CSV (as mesmas colunas da tela; respeita o filtro). */
export declare function csvConsulta(l: NotaConsulta[], g: GrupoConsulta): string[];
/** Limite de linhas na tela (o resto, pelo CSV). */
export declare const LIMITE_LINHAS_CONSULTA = 400;
