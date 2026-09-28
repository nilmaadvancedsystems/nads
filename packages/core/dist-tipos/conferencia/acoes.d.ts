import type { Conta, Empresa, EstadoVerificacao, FiltroMovimento, Nota, NotaServico, TipoNotaFiscal, TipoServico } from './tipos';
import { type ModoImportacao } from './regras/importacao';
import type { TipoVista } from './regras/vendaVista';
type Periodo = Pick<FiltroMovimento, 'dataDe' | 'dataAte' | 'meses'>;
/** Primeira abertura: fica marcada a pergunta do "Apagar ao sair". */
export declare function aoEntrar(e: Empresa): Empresa;
/** Ao sair, com "Apagar ao sair" ligado, o balancete é descartado (o resto fica). */
export declare function aoSair(e: Empresa, agora: Date): Empresa;
export declare function definirPrestaServico(e: Empresa, sim: boolean): Empresa;
export declare function definirAutoLimpar(e: Empresa, ligado: boolean): Empresa;
export declare function importarBalancete(e: Empresa, lista: Conta[], agora: Date, aviso?: string): Empresa;
export declare function apagarBalancete(e: Empresa, agora: Date): Empresa;
export declare function importarNotas(e: Empresa, tipo: TipoNotaFiscal, notas: Nota[], adicionadas: number, modo: ModoImportacao, agora: Date): Empresa;
export declare function apagarNotas(e: Empresa, tipo: TipoNotaFiscal, agora: Date): Empresa;
export declare function importarServicos(e: Empresa, tipo: TipoServico, notas: NotaServico[], adicionadas: number, modo: ModoImportacao, agora: Date): Empresa;
export declare function apagarServicos(e: Empresa, tipo: TipoServico, agora: Date): Empresa;
export declare function vincularConta(e: Empresa, k: string, codigo: string): Empresa;
export declare function desvincularConta(e: Empresa, k: string, codigo: string): Empresa;
export declare function marcarNaoContabil(e: Empresa, k: string, marcar: boolean): Empresa;
export declare function alternarVendaVista(e: Empresa): Empresa;
/** Grava (ou remove, com valor vazio) o lançamento à vista/a prazo de um CFOP de venda. */
export declare function gravarLancVista(e: Empresa, k: string, t: TipoVista, valor: string): {
    empresa: Empresa;
    mudou: boolean;
    mensagem: string;
};
export declare function colocarNaCategoria(e: Empresa, t: TipoServico, cat: string, nome: string): Empresa;
export declare function tirarDaCategoria(e: Empresa, t: TipoServico, nome: string): Empresa;
export declare function gravarDp(e: Empresa, lanc: string, codigo: string): Empresa;
export declare function aplicarSugestoesDp(e: Empresa, sugestoes: {
    lanc: string;
    conta: Conta;
}[]): Empresa;
/** Nota fora do padrão (ou o grupo) marcada como corrigida. chaves = "tipo|chave da nota". */
export declare function marcarCorrigido(e: Empresa, chaves: string[], marcado: boolean, chaveHist: string, texto: string, agora: Date): Empresa;
/** Checklist: marcar/desmarcar à mão. Desmarcar impede a marcação automática de voltar. */
export declare function marcarNatureza(e: Empresa, marca: string, marcado: boolean, texto: string, agora: Date): Empresa;
/** Marca sozinho as naturezas que bateram com o balancete. */
export declare function marcarAutomaticos(e: Empresa, itens: {
    chave: string;
    texto: string;
}[], agora: Date): Empresa;
/** Auditoria › Remover: tira a marcação automática e ela não volta sozinha. */
export declare function removerMarcaAutomatica(e: Empresa, chave: string, texto: string, agora: Date): Empresa;
/** Resultado do Verificar por conta (Ok / Conferido / desfeito), por período. */
export declare function gravarVerificacao(e: Empresa, p: Periodo, conta: string, estado: EstadoVerificacao | null, texto: string, agora: Date): Empresa;
export {};
