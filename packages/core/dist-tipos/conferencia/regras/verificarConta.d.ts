import type { Conta, Empresa, NotaComTipo, NotaServico, TipoServico } from '../tipos';
/** Uma linha do relatório da conta. */
export interface LinhaRazao {
    txt: string;
    data: string;
    /** sempre positivo */
    valor: number;
    sinal: 1 | -1;
    contra: string;
    /** conta de origem, quando são várias contas */
    conta?: string;
    /** "é do CFOP 1201 (conta 60502)" */
    dica?: string;
}
/** Nota alvo da conferência: fiscal (com CFOP) ou de serviço. */
export type NotaAlvo = (NotaComTipo | (NotaServico & {
    cfop?: string;
    tipo?: undefined;
})) & {
    exportado?: string;
};
/**
 * Números de nota no histórico. Padrão fiscal: "… 29-54540585000161-NOME // NF 9009" — o número
 * real vem logo antes do CNPJ. Sem esse padrão, todo número de 3+ dígitos (serviço aceita até 15,
 * sem confundir com CPF/CNPJ). O grupo é limitado ({1,9}) pra regex não travar em texto comprido.
 */
export declare function numerosDoHistorico(txt: string, serv: boolean): string[];
export declare function partesDoHistorico(txt: string): {
    nota: string;
    doc: string;
    nome: string;
    contra: string;
    lanc: string;
};
/** Lançamento de ICMS não é nota repetida: sai da conferência e vai pra lista própria. */
export declare function ehLinhaIcms(l: Pick<LinhaRazao, 'txt'>): boolean;
/** Linha do relatório no formato da tabela. */
export interface LinhaTabela {
    data: string;
    nota: string;
    part: string;
    contra: string;
    valor: number;
    txt?: string;
    conta?: string;
    cfop?: string;
    exportado?: string;
}
export declare function linhaDaTabela(l: LinhaRazao): LinhaTabela;
/** Conta ligada só a serviço → modo serviços (sem CFOP). */
export declare function servicoDaContaVerificar(e: Empresa, codigo: string): TipoServico | null;
/** Notas de serviço (e com CFOP ligadas às mesmas contas) da conta. */
export declare function notasServicoDaConta(e: Empresa, t: TipoServico, codigos: string[]): NotaAlvo[];
/** Opções de CFOP (naturezas) para o formulário; a vinculada à conta vem travada. */
export declare function opcoesCfop(e: Empresa, conta: Conta | null): {
    chaves: string[];
    rotulos: Record<string, string>;
    vinculada: string | null;
};
/** "70002 + 70006 — Compras de Mercadorias" (ou uma conta só). */
export declare function rotuloContas(contas: Pick<Conta, 'codigo' | 'nome'>[]): string;
export interface Duplicada {
    numero: string;
    vezes: number;
    valor: number;
    linhas: LinhaRazao[];
}
export interface ResultadoVerificacao {
    faltando: NotaAlvo[];
    duplicada: Duplicada[];
    aMais: LinhaRazao[];
    icms: LinhaRazao[];
    somaRazao: number;
    somaSemIcms: number;
    icmsSub: number;
    somaFiscal: number;
    serv: TipoServico | null;
    conta: {
        codigo: string;
        nome: string;
    };
    /** mais de uma conta com relatório: abas Todas · 70002 · 70006 */
    contas: {
        codigo: string;
        nome: string;
    }[] | null;
    fonte: string;
    /** todas as linhas usadas (com a conta de origem), para as abas por conta */
    linhas: LinhaRazao[];
}
export interface EntradaVerificacao {
    empresa: Empresa;
    /** contas conferidas (uma, ou o grupo que divide os CFOPs) */
    contas: Conta[];
    /** relatório de cada conta (código → linhas) */
    razaoPorConta: Record<string, LinhaRazao[]>;
    /** natureza escolhida (modo CFOP) */
    cfopGrupo: string | null;
    /** modo serviços */
    servTipo: TipoServico | null;
}
export declare function conferirConta(x: EntradaVerificacao): ResultadoVerificacao;
export declare function semPendencias(r: ResultadoVerificacao): boolean;
/** Linhas "a mais" por repetição (as que sobram de cada número duplicado). */
export declare function linhasDuplicadas(r: ResultadoVerificacao): LinhaTabela[];
export declare function linhasFaltando(r: ResultadoVerificacao): LinhaTabela[];
export interface Totais {
    faltando: number;
    duplicadas: number;
    aMais: number;
    icms: number;
    diferenca: number;
    semExplicacao: number;
}
/** Diferença = Faltando − Duplicadas − A mais − ICMS; o que sobrar é "Sem explicação". */
export declare function totaisVerificacao(r: ResultadoVerificacao): Totais;
/** Aba de uma conta (várias contas): o relatório dela e o que sobrou nela. */
export declare function resultadoDaConta(r: ResultadoVerificacao, codigo: string): {
    dups: LinhaTabela[];
    mais: LinhaTabela[];
    somaConta: number;
    pendencias: number;
};
/** CSV do resultado (mesmas colunas da tela + totalizador). */
export declare function csvVerificacao(r: ResultadoVerificacao): string[];
/** O que falta preencher antes de conferir. */
export declare function faltaParaConferir(x: {
    temPlano: boolean;
    conta: Conta | null;
    multi: boolean;
    algumRelatorio: boolean;
    relatorioUnico: boolean;
    servTipo: TipoServico | null;
    qtdNotasServ: number;
    cfopGrupo: string | null;
}): string[];
