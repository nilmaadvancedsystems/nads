import type { Empresa, EstadoVerificacao, FiltroMovimento, GrupoNatureza, TipoCfop, TipoServico } from '../tipos';
type Periodo = Pick<FiltroMovimento, 'dataDe' | 'dataAte' | 'meses'>;
/** Abaixo disso a soma das notas é zero (fica fora da conferência). */
export declare const ZERO = 0.005;
/** Diferença menor que um centavo = bateu. */
export declare const TOLERANCIA = 0.01;
/** Só estas contas podem ficar "Conferido" com diferença: Água, Internet, Energia Elétrica, Locação de Sistemas. */
export declare const CONFERIVEIS: RegExp;
export declare function podeConferir(e: Empresa, codigos: string[], extras?: string[]): boolean;
export interface ComponenteConciliacao {
    naturezas: string[];
    contas: string[];
}
/** Naturezas e contas ligadas entre si pelo Cadastro (componentes conexos): soma tudo de uma vez. */
export declare function gruposConciliacao(e: Empresa, chaves: string[]): ComponenteConciliacao[];
/** Tira "à vista"/"a prazo" do fim do nome da conta. */
export declare function nomeBaseConta(nome: string): string;
/** Contas que são "a mesma coisa" (à vista / a prazo, plural): o nome comum, ou null. */
export declare function nomeComumContas(nomes: string[]): string | null;
/** "70002 + 70006 — Compras de Mercadorias" */
export declare function tituloContas(e: Empresa, contas: string[]): string;
export declare function verifChave(p: Periodo, conta: string): string;
export declare function verifEstado(e: Empresa, p: Periodo, conta: string): EstadoVerificacao | null;
export type Situacao = {
    tipo: 'ok';
} | {
    tipo: 'ok-pela-revisao';
    diferenca: number;
} | {
    tipo: 'conferido';
    diferenca: number;
} | {
    tipo: 'diferenca';
    diferenca: number;
} | {
    tipo: 'soma-zero';
} | {
    tipo: 'fora-do-balancete';
} | {
    tipo: 'sem-conta';
};
export interface EntradaSituacao {
    somaNotas: number;
    /** null = conta fora do balancete lido */
    saldo: number | null;
    revisao: EstadoVerificacao | null;
    conferidoManual: boolean;
    podeConferir: boolean;
}
export declare function situacaoDaConta(x: EntradaSituacao): Situacao;
/** Situação que abre o "Revisar" (tem diferença de verdade). */
export declare function temRevisar(s: Situacao): boolean;
export interface LinhaSaldo {
    contas: string[];
    titulo: string;
    cfops: string[];
    qtdNotas: number;
    somaNotas: number;
    saldo: number | null;
    /** conta com nota de serviço no período: conferida em Tomados/Prestados */
    emServicos: TipoServico | null;
    situacao: Situacao;
    avisoPassivo: string | null;
}
/**
 * Tabela "confere com o saldo" do Relatório. A conciliação usa todas as notas
 * do período (uma conta pode receber naturezas dos dois tipos); tipoF só filtra
 * as linhas exibidas.
 */
export declare function linhasDoSaldo(e: Empresa, grupos: Record<string, GrupoNatureza>, chaves: string[], p: Periodo, tipoF: '' | TipoCfop): LinhaSaldo[];
/**
 * Naturezas que devem ser marcadas "conferido" sozinhas: todo grupo cuja(s) conta(s)
 * bate(m) com o balancete. Nunca desmarca; respeita o que a pessoa desmarcou (recusados).
 */
export declare function quaisMarcarSozinho(e: Empresa, grupos: Record<string, GrupoNatureza>, chaves: string[], p: Periodo): {
    chave: string;
    texto: string;
}[];
export {};
