import { type CategoriaServico } from '../tabelas/servicos';
import type { Empresa, FiltroMovimento, Nota, NotaServico, TipoServico } from '../tipos';
type Periodo = Pick<FiltroMovimento, 'dataDe' | 'dataAte' | 'meses'>;
/** Identidade de uma nota de serviço. */
export declare function chaveServ(n: Pick<NotaServico, 'numero' | 'data' | 'nome' | 'valor'>): string;
export declare function catServ(tipo: TipoServico, id: string): CategoriaServico;
/** Chave do vínculo de conta da categoria: "serv|tomados|*" (geral) ou "serv|tomados|cat:telefone". */
export declare function chaveContaCat(tipo: TipoServico, id: string): string;
/** Categoria permanente pelo nome (ex.: Honorário = NILMA CONTABILIDADE). */
export declare function catFixa(tipo: TipoServico, nome: string): string | null;
export declare function catDoPart(e: Empresa, tipo: TipoServico, nome: string): string;
/** Conta do participante = a conta da categoria dele (uma conta por categoria). */
export declare function contasDoPart(e: Empresa, tipo: TipoServico, nome: string): string[];
/** Contas ligadas a serviço → tipo (tomados/prestados). */
export declare function contasServico(e: Empresa, tipo?: TipoServico): Record<string, TipoServico>;
/** Notas com CFOP cuja natureza está ligada a uma conta de serviço (tomados ← entradas, prestados ← saídas). */
export declare function notasCfopDeServico(e: Empresa, tipo: TipoServico): Nota[];
/** Essas contas têm nota de serviço no período? Devolve o tipo, ou null. */
export declare function servicoDaConta(e: Empresa, codigos: string[], p: Periodo): TipoServico | null;
/** Participantes das notas de um tipo, com quantas notas e os lançamentos usados. */
export declare function participantesDasNotas(e: Empresa, t: TipoServico): Record<string, {
    nome: string;
    qtd: number;
    lancs: Record<string, number>;
}>;
export {};
