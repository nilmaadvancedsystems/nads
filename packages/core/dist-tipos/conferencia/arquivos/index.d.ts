import type { Conta, Nota, NotaServico, TipoServico } from '../tipos';
import type { LinhaRazao } from '../regras/verificarConta';
export type Linhas = string[][];
/** Primeira aba da planilha como linhas de texto (xls, xlsx, csv, ods). */
export declare function lerPlanilha(buf: ArrayBuffer): Linhas;
/** Linha do cabeçalho: a primeira (até a 40ª) que tem todos os trechos. */
export declare function acharCabecalho(rows: Linhas, trechos: string[]): number;
/** Coluna pelo nome: primeiro igual, depois contendo. */
export declare function coluna(head: unknown[], ...nomes: string[]): number;
export declare function lerNotas(rows: Linhas): Nota[];
/**
 * Colunas fixas do Alterdata: C = descrição com [código] (recuo = nível), H = saldo atual
 * com D/C no fim. Ler direto da coluna evita pegar débito/crédito no lugar do saldo.
 */
export declare function lerBalancete(rows: Linhas): Record<string, Conta>;
/** O relatório é do outro tipo (tem fornecedor em vez de cliente, ou o contrário). */
export declare class ErroTipoErrado extends Error {
    tipoCerto: TipoServico;
    constructor(tipoCerto: TipoServico);
}
export declare function lerServicos(rows: Linhas, tipo: TipoServico): {
    notas: NotaServico[];
    canceladas: number;
};
/** Contábil › Lançamentos › Exportar para Excel. Junta todas as colunas de histórico/descrição. */
export declare function lerRazao(rows: Linhas): LinhaRazao[];
