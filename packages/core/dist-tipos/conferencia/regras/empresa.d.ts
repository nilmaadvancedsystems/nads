import type { Conta, Empresa, Grupo, Nota, NotaServico, TipoMovimento, TipoServico } from '../tipos';
export declare const GRUPOS_ORDEM: readonly Grupo[];
/** Tira valor que vazou pra frente do nome da conta ("1.234,56 D Caixa" → "Caixa"). */
export declare function limparNomeConta(nome: unknown): string;
/** Empresa recém-aberta (entrar() do original). */
export declare function empresaNova(nome: string): Empresa;
/** Documento como veio (pode ter campos antigos: semPrestados, servPart, lancConfig…). */
type EmpresaBruta = Partial<Empresa> & {
    nome: string;
};
/** O norm() do original: preenche o que falta e migra campos antigos. Não muda o que já está certo. */
export declare function normalizarEmpresa(bruta: EmpresaBruta): Empresa;
export declare function contasDaNatureza(e: Empresa, k: string): string[];
export declare function naturezasDaConta(e: Empresa, codigo: string): string[];
export declare function contaPorCodigo(e: Empresa, codigo: string): Conta | undefined;
export declare function saldoAtualizado(e: Empresa, codigo: string): number | null;
export declare function nomeConta(e: Empresa, codigo: string): string | null;
export declare function contasDoPassivo(e: Empresa, codigos: string[]): string[];
/** Vínculo errado vindo de antes (conta do Passivo): a mensagem do aviso, ou null. */
export declare function avisoPassivo(e: Empresa, codigos: string[]): string | null;
export declare function naoContabil(e: Empresa, k: string): boolean;
/** Ordem do plano de contas (a do balancete importado); sem ordem: grupo e código. */
export declare function ordemPlano<T extends Pick<Conta, 'grupo' | 'codigo' | 'ordem'>>(l: T[]): T[];
/** Contas que dá pra vincular no Cadastro: analíticas, fora do Passivo, ainda não ligadas. */
export declare function contasParaVincular(e: Empresa, ligadas: string[], busca: string): Conta[];
/** "Não presta serviço" respondido: tudo de prestados some. */
export declare function semPrest(e: Empresa): boolean;
export declare function listaTipo(e: Empresa, t: 'entradas' | 'saidas'): Nota[];
export declare function listaTipo(e: Empresa, t: TipoServico): NotaServico[];
export declare function listaTipo(e: Empresa, t: TipoMovimento): Nota[] | NotaServico[];
export declare function todasNotasComTipo(e: Empresa): import("..").NotaComTipo[];
export declare function todosGruposNatureza(e: Empresa): Record<string, import("..").GrupoNatureza<import("..").NotaComTipo>>;
export declare function importacoesOk(e: Empresa): boolean;
export interface JaImportado {
    balancete: boolean;
    entradas: boolean;
    saidas: boolean;
    prestados: boolean;
    tomados: boolean;
}
export declare function jaImportado(e: Empresa): JaImportado;
export declare function temNotas(e: Empresa): boolean;
/** Ninguém nunca configurou nada nesta empresa. */
export declare function empresaNuncaAberta(e: Empresa): boolean;
export type PaginaImportacao = 'balancete' | 'entradas' | 'saidas' | 'tomados' | 'prestados';
/** Onde a empresa abre: Apagar ao sair ligado → balancete; senão o Movimento, se tem nota. */
export declare function telaInicialEmpresa(e: Empresa): {
    secao: 'importacao';
    pagina: PaginaImportacao;
} | {
    secao: 'movimento';
    pagina: 'relatorio';
};
export declare function primeiraImportacaoPendente(e: Empresa): PaginaImportacao;
/** O que tem dado (o "tem" do aplicarBloqueios): trava abas e páginas. */
export interface Disponivel {
    entradas: boolean;
    saidas: boolean;
    prestados: boolean;
    tomados: boolean;
    fiscais: boolean;
    servicos: boolean;
}
export declare function disponivel(e: Empresa): Disponivel;
export {};
