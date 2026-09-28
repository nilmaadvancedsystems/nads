import { conferencia as c } from '@nads/core';
import { type AbaCadastro } from '../sessao';
export interface ContaNaLista {
    codigo: string;
    nome: string;
    grupo: c.Grupo;
}
/** Chips das contas ligadas + o "Adicionar"/"Vincular conta" (.ndp-add) de uma chave. */
export interface Vinculo {
    chave: string;
    chips: {
        codigo: string;
        texto: string;
    }[];
    aberto: boolean;
    busca: string;
    /** lista de contas aberta embaixo do campo (null = escondida) */
    lista: ContaNaLista[] | null;
    abrir: () => void;
    digitar: (v: string) => void;
    focar: () => void;
    sair: () => void;
    escolher: (codigo: string) => void;
    desvincular: (codigo: string) => void;
}
export interface SlotVista {
    t: c.TipoVista;
    rot: string;
    valor: string;
    /** valor da pílula, com zeros à esquerda até 4 dígitos */
    valorMostrado: string;
    editando: boolean;
    sugestao: string;
    falta: boolean;
    /** o primeiro que falta: recebe o foco depois do aviso "Preencha os lançamentos" */
    focarAgora: number;
}
export interface ItemNatureza {
    k: string;
    titulo: string;
    nao: boolean;
    vinculo: Vinculo;
    /** mostra o "Não vai para o Contábil" (sem conta ligada) */
    podeNaoContabil: boolean;
    vista: {
        slots: SlotVista[];
        info: string;
    } | null;
}
export interface FormServ {
    aberto: boolean;
    texto: string;
    escolhido: string | null;
    lista: {
        itens: {
            nome: string;
            sub: string;
        }[];
        adicionar: string | null;
        vazio: boolean;
    } | null;
    /** muda → a View rola até o formulário e foca o botão Adicionar */
    focarOk: number;
    abrir: () => void;
    digitar: (v: string) => void;
    focar: () => void;
    sair: () => void;
    escolher: (nome: string) => void;
    confirmar: () => void;
    cancelar: () => void;
    enter: () => void;
}
export interface CategoriaView {
    id: string;
    nome: string;
    lanc: string;
    travado: boolean;
    dica?: string;
    vinculo: Vinculo;
    /** só nas categorias específicas (não geral, não travada) */
    fornecedores: null | {
        itens: {
            nome: string;
            qtd: string;
            tirar: () => void;
        }[];
        form: FormServ;
        sugestoes: {
            nome: string;
            colocar: () => void;
        }[];
    };
}
export declare function useConfiguracoes(): {
    aba: AbaCadastro;
    abas: {
        valor: AbaCadastro;
        rotulo: string;
        oculta: boolean;
        travada: string | false;
    }[];
    mudarAba: (t: AbaCadastro) => void;
    serv: boolean;
    naturezas: {
        titulo: string;
        falta: string;
        cartaoVista: {
            ativo: boolean;
            titulo: string;
            semDoc: boolean;
        } | null;
        itens: ItemNatureza[];
        vazio: string;
    } | null;
    servicos: {
        titulo: string;
        vazio: string;
        categorias: CategoriaView[];
        tituloGeral?: undefined;
    } | {
        titulo: string;
        vazio: string;
        categorias: CategoriaView[];
        tituloGeral: string;
    } | null;
    alternarVista: () => void;
    naoContabil: (k: string, marcar: boolean) => void;
    vista: {
        editarVista: (k: string, t: c.TipoVista) => void;
        removerVista: (k: string, t: c.TipoVista) => void;
        digitarVista: (v: string) => void;
        textoEdit: string;
        salvarVista: () => void;
        cancelarVista: () => void;
        teclaVista: (tecla: string) => void;
    };
};
/** Classe da etiqueta de grupo na lista de contas (grupoTag ~L2344). */
export declare function classeGrupo(g: c.Grupo | undefined): string;
