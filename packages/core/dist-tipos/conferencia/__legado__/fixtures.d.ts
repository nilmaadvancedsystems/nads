import type { LinhaRazao } from '../regras/verificarConta';
import type { Conta, Empresa, Grupo, Nota, NotaServico } from '../tipos';
export declare function nota(cfop: string, lanc: string, valor: number, numero: string, extra?: Partial<Nota>): Nota;
export declare function servico(numero: string, nome: string, valor: number, lanc: string, data?: string): NotaServico;
export declare function conta(codigo: string, nome: string, valor?: number, grupo?: Grupo, dc?: 'D' | 'C'): Conta;
export declare function empresa(campos?: Partial<Empresa>): Empresa;
/** Linha do razão no formato fiscal do Alterdata: "conf NF-e ? - 100-11222333000100-FORN". */
export declare function linha(numero: string, valor: number, extra?: Partial<LinhaRazao>): LinhaRazao;
