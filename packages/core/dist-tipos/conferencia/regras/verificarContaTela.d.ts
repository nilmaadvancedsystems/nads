import type { Conta, Empresa, TipoServico } from '../tipos';
import { type ResultadoVerificacao } from './verificarConta';
/** Contas analíticas do plano, na ordem do balancete (o vc.contas do original). */
export declare function contasVerificaveis(e: Empresa): Conta[];
/** Modo serviços: quantas notas, de quantos participantes e quanto somam. */
export declare function resumoServicoVerificar(e: Empresa, t: TipoServico, codigos: string[]): {
    rotulo: string;
    qtdNotas: number;
    qtdParticipantes: number;
    rotParticipantes: string;
    soma: number;
};
export interface ItemComposicao {
    rotulo: string;
    valor: number;
    zero: boolean;
}
/** "O que explica a diferença": Faltando − Duplicadas − A mais − ICMS (e o que sobrar, à parte). */
export declare function composicaoDiferenca(r: ResultadoVerificacao): ItemComposicao[];
/** Diferença zerada (abaixo de meio centavo). */
export declare function diferencaZerada(v: number): boolean;
/** "verificar-conta-nome-da-empresa.csv" */
export declare function nomeCsvVerificacao(empresa: string): string;
