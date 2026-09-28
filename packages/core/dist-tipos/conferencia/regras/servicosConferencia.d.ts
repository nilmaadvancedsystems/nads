import { SV, type CategoriaServico } from '../tabelas/servicos';
import type { Empresa, FiltroMovimento, NotaServico, TipoServico } from '../tipos';
import { type Situacao } from './conciliacao';
export declare function chaveResolvidoServ(tipo: TipoServico, n: NotaServico): string;
export interface LinhaSaldoServ {
    contas: string[];
    titulo: string;
    descricao: string;
    qtdNotas: number;
    participantes: string[];
    somaNotas: number;
    saldo: number | null;
    situacao: Situacao;
    avisoPassivo: string | null;
}
export interface NotaForaDoPadraoServ {
    nota: NotaServico;
    chave: string;
    esperado: CategoriaServico;
}
export interface GrupoForaDoPadraoServ {
    key: string;
    nome: string;
    cat: CategoriaServico;
    itens: NotaForaDoPadraoServ[];
    /** lançou com o lançamento de outra categoria: dá pra colocar o participante nela */
    sugerirCategorias: CategoriaServico[];
}
export type OrdemServ = 'nome' | 'valor' | 'data';
export interface ConferenciaServicos {
    totais: {
        valor: number;
        iss: number;
        issRet: number;
        irrf: number;
        inss: number;
    };
    temIss: boolean;
    qtdNotas: number;
    qtdParticipantes: number;
    qtdForaDoPadrao: number;
    saldo: LinhaSaldoServ[];
    temDivergencias: boolean;
    pendentes: GrupoForaDoPadraoServ[];
    corrigidos: GrupoForaDoPadraoServ[];
    qtdCorrigidos: number;
}
export declare function conferirServicos(e: Empresa, tipo: TipoServico, f: FiltroMovimento, ordem: OrdemServ): ConferenciaServicos;
export interface ParticipanteNaCategoria {
    chave: string;
    nome: string;
    qtd: number | null;
}
export interface CategoriaNoCadastro {
    cat: CategoriaServico;
    /** chave do vínculo de conta da categoria */
    chaveConta: string;
    contas: string[];
    participantes: ParticipanteNaCategoria[];
    /** participantes na categoria geral lançados com o lançamento desta categoria */
    sugestoes: string[];
}
export declare function cadastroServicos(e: Empresa, t: TipoServico): CategoriaNoCadastro[];
/** Participantes que dá pra pôr numa categoria (os de outras categorias, fora os fixos). */
export declare function participantesParaCategoria(e: Empresa, t: TipoServico, cat: string, busca: string): {
    nome: string;
    qtd: number;
    hoje: string;
}[];
/** O que foi digitado já é um participante das notas? (senão, oferece "Adicionar …") */
export declare function ehParticipanteConhecido(e: Empresa, t: TipoServico, busca: string): boolean;
export { SV };
