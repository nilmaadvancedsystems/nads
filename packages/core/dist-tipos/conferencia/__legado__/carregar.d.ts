import type { Conta, Empresa, GrupoNatureza, Nota, NotaComTipo, NotaServico, TipoCfop } from '../tipos';
/** nads e contabil-htmls são irmãos dentro de CLAUDE_DRIVE. */
export declare const CAMINHO_LEGADO: string;
export declare function temLegado(): boolean;
export declare function fonteLegado(): string;
/** Código de `function nome(...){...}` (a declaração precisa ser única no arquivo). */
export declare function extrairFuncao(src: string, nome: string): string;
/** Código de `var nome=...;` (a declaração precisa ser única no arquivo). */
export declare function extrairVar(src: string, nome: string): string;
type ParteHistorico = {
    nota: string;
    doc: string;
    nome: string;
    contra: string;
    lanc: string;
};
export interface DivergenciaLegado {
    nota: Nota;
    chave: string;
    padrao: string;
    origem?: string;
    cadastrado?: boolean;
    qtdPadrao?: number;
    totalCfop?: number;
}
/** As funções do original, com a mesma assinatura que tinham lá (as que leem emp() usam usarEmpresa). */
export interface Legado {
    usarEmpresa(e: Empresa): void;
    CFOP_DESC: Record<string, string>;
    DESC_AMBOS: Record<string, number>;
    num(v: unknown): number | null;
    comp(dt: string): string;
    lancN(l: unknown): string;
    docLimpo(d: unknown): string;
    nomeNorm(s: unknown): string;
    tipoDoCfop(c: string): TipoCfop | null;
    chave(n: Nota): string;
    chaveNaturezaNota(n: Partial<NotaComTipo>, tipoPadrao?: TipoCfop): string;
    agruparTotaisPorNatureza(notas: NotaComTipo[]): Record<string, GrupoNatureza>;
    ehCfopVenda(n: Partial<Nota>): boolean;
    ehVendaVista(n: Partial<Nota>): boolean;
    padraoPorCfop(tipo: 'entradas' | 'saidas'): Record<string, {
        lanc: string;
        qtd: number;
        total: number;
    }>;
    acharDivergencias(tipo: 'entradas' | 'saidas'): DivergenciaLegado[];
    gruposConciliacao(chaves: string[]): {
        naturezas: string[];
        contas: string[];
    }[];
    nomeBaseConta(nome: string): string;
    nomeComumContas(nomes: string[]): string | null;
    lerNotas(rows: string[][]): Nota[];
    lerBalancete(rows: string[][]): Record<string, Conta>;
    lerServicos(rows: string[][], tipo: 'tomados' | 'prestados'): {
        notas: NotaServico[];
        canceladas: number;
    };
    vcLerRazao(rows: string[][]): Promise<{
        txt: string;
        data: string;
        valor: number;
        sinal: number;
        contra: string;
    }[]>;
    vcNumerosDoHistorico(txt: string, serv: boolean): string[];
    vcPartesHistorico(txt: string): ParteHistorico;
    ehLinhaIcms(l: {
        txt: string;
    }): boolean;
    melhorConta(natureza: string, contas: Conta[]): Conta | null;
    assinaturaBalancete(lista: Conta[]): Record<string, string>;
    verificarBalancete(lista: Conta[]): {
        problemas: string[];
        similaridade: number | null;
    };
}
export declare function carregarLegado(): Legado;
export {};
