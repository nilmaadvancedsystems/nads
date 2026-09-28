import { conferencia as c } from '@nads/core';
export declare const ABAS: {
    valor: c.AbaRelatorio;
    rotulo: string;
}[];
export declare function useRelatorio(): {
    abas: {
        oculta: boolean;
        travada: string | false;
        valor: c.AbaRelatorio;
        rotulo: string;
    }[];
    aba: c.AbaRelatorio;
    escolherAba: (v: c.AbaRelatorio) => void;
    ehServ: boolean;
    stats: StatRelatorio[];
    saldo: c.LinhaSaldo[];
    grafico: {
        comp: string;
        ligado: boolean;
        titulo: string;
        alturaEnt: number;
        alturaSai: number;
        rotulo: string;
    }[] | null;
    rank: {
        k: string;
        tipo: c.TipoCfop;
        nome: string;
        cfops: string;
        valor: number;
        titulo: string;
        largura: number;
    }[] | null;
    alternarMes: (m: string) => void;
    abrirNatureza: (cfops: string) => void;
    revisar: (codigos: string[]) => void;
    tipoNf: c.TipoNotaFiscal | null;
    fiscal: {
        vazio: string;
        temDivergencias: boolean;
        pendentes: c.GrupoForaDoPadrao[];
        corrigidos: c.GrupoForaDoPadrao[];
        qtdCorrigidos: number;
    } | null;
    ordemDiv: c.OrdemGrupos;
    setOrdemDiv: (o: c.OrdemGrupos) => void;
    marcarNotaCorrigida: (t: c.TipoNotaFiscal, d: c.Divergencia, marcado: boolean) => void;
    marcarGrupoCorrigido: (t: c.TipoNotaFiscal, gr: c.GrupoForaDoPadrao, marcado: boolean) => void;
    tipoServ: c.TipoServico | null;
    serv: {
        stats: StatRelatorio[];
        /** title da coluna Notas: "3 fornecedores: A, B, C" */
        tituloNotas: (l: c.LinhaSaldoServ) => string;
        ordens: [c.OrdemServ, string][];
        /** "527 é de Telefone —" (a dica antes dos botões "Colocar em …") */
        dicaSugestao: (gr: c.GrupoForaDoPadraoServ) => string;
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
        saldo: c.LinhaSaldoServ[];
        temDivergencias: boolean;
        pendentes: c.GrupoForaDoPadraoServ[];
        corrigidos: c.GrupoForaDoPadraoServ[];
        qtdCorrigidos: number;
    } | null;
    ordemServ: c.OrdemServ;
    setOrdemServ: (o: c.OrdemServ) => void;
    marcarServCorrigido: (t: c.TipoServico, it: c.NotaForaDoPadraoServ, marcado: boolean) => void;
    marcarServGrupoCorrigido: (t: c.TipoServico, gr: c.GrupoForaDoPadraoServ, marcado: boolean) => void;
    colocarNaCategoria: (t: c.TipoServico, catId: string, nome: string) => void;
};
export interface StatRelatorio {
    rotulo: string;
    valor: string;
    cor?: 'entrada' | 'saida';
}
