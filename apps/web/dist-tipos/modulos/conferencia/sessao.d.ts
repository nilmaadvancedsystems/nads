import { conferencia as c } from '@nads/core';
import { type ReactNode } from 'react';
export type AbaCadastro = 'entradas' | 'saidas' | 'tomados' | 'prestados';
/** Estado do Verificar por conta (o "vc" do original) — o relatório nunca é salvo. */
export interface EstadoVerificar {
    /** códigos das contas escolhidas (uma, ou o grupo que divide os CFOPs) */
    contas: string[];
    razaoPorConta: Record<string, c.LinhaRazao[]>;
    razaoNome: Record<string, string>;
    cfopGrupo: string | null;
    resultado: c.ResultadoVerificacao | null;
    abaRes: string;
}
export declare const VERIFICAR_VAZIO: EstadoVerificar;
export interface Sessao {
    nome: string;
    slug: string;
    empresa: c.Empresa;
    aplicar: (acao: (e: c.Empresa) => c.Empresa) => c.Empresa | null;
    /** página aberta ("secao/pagina") */
    pagina: string;
    irPara: (pagina: string) => void;
    filtro: c.FiltroMovimento;
    setFiltro: (f: c.FiltroMovimento | ((f: c.FiltroMovimento) => c.FiltroMovimento)) => void;
    abaRelatorio: c.AbaRelatorio;
    setAbaRelatorio: (a: c.AbaRelatorio) => void;
    abaCadastro: AbaCadastro;
    setAbaCadastro: (a: AbaCadastro) => void;
    abaConsulta: c.GrupoConsulta;
    setAbaConsulta: (a: c.GrupoConsulta) => void;
    filtroConsulta: Record<c.GrupoConsulta, c.FiltroConsulta>;
    setFiltroConsulta: (g: c.GrupoConsulta, f: c.FiltroConsulta) => void;
    ordemDiv: Record<c.TipoNotaFiscal, c.OrdemGrupos>;
    setOrdemDiv: (t: c.TipoNotaFiscal, o: c.OrdemGrupos) => void;
    ordemServ: Record<c.TipoServico, c.OrdemServ>;
    setOrdemServ: (t: c.TipoServico, o: c.OrdemServ) => void;
    verificar: EstadoVerificar;
    setVerificar: (v: EstadoVerificar | ((v: EstadoVerificar) => EstadoVerificar)) => void;
    /** abre o Verificar por conta já com a conta (atalho "Revisar" do Relatório) */
    revisarConta: (codigos: string[]) => void;
    /** Checklist: a linha que acabou de ser marcada (anima o risco uma vez) */
    natAnimar: string | null;
    setNatAnimar: (m: string | null) => void;
    /** avisa que a página depende de um arquivo ainda não importado */
    avisoImportar: (req: keyof typeof AVISO_IMPORTAR) => void;
}
export declare function useSessao(): Sessao;
export declare const MSG_CADASTRO_BLOQ = "Cadastro fica dispon\u00EDvel depois de importar o balancete e as notas (entradas e sa\u00EDdas, ou servi\u00E7os).";
/** Os avisos de "falta importar" (AVISO_IMPORTAR do original, ~L1816). */
export declare const AVISO_IMPORTAR: {
    readonly entradas: {
        readonly titulo: "Entradas ainda não importadas";
        readonly html: "Importe o relatório de <b>entradas</b> pra ver esses dados.";
        readonly botao: "Importar entradas";
        readonly ir: "importacao/entradas";
    };
    readonly saidas: {
        readonly titulo: "Saídas ainda não importadas";
        readonly html: "Importe o relatório de <b>saídas</b> pra ver esses dados.";
        readonly botao: "Importar saídas";
        readonly ir: "importacao/saidas";
    };
    readonly notas: {
        readonly titulo: "Nenhuma nota importada";
        readonly html: "O Movimento precisa das notas de <b>entradas</b> ou <b>saídas</b>. Importe pelo menos um dos relatórios.";
        readonly botao: "Importar notas";
        readonly ir: "importacao/entradas";
    };
    readonly prestados: {
        readonly titulo: "Serviços prestados ainda não importados";
        readonly html: "Importe o relatório de <b>serviços prestados</b> pra ver esses dados.";
        readonly botao: "Importar serviços prestados";
        readonly ir: "importacao/prestados";
    };
    readonly tomados: {
        readonly titulo: "Serviços tomados ainda não importados";
        readonly html: "Importe o relatório de <b>serviços tomados</b> pra ver esses dados.";
        readonly botao: "Importar serviços tomados";
        readonly ir: "importacao/tomados";
    };
    readonly fiscais: {
        readonly titulo: "Nenhuma nota fiscal importada";
        readonly html: "Importe o relatório de <b>entradas</b> ou de <b>saídas</b> pra ver esses dados.";
        readonly botao: "Importar notas";
        readonly ir: "importacao/entradas";
    };
    readonly servicos: {
        readonly titulo: "Nenhum serviço importado";
        readonly html: "Importe o relatório de <b>serviços tomados</b> ou <b>prestados</b> pra ver esses dados.";
        readonly botao: "Importar serviços";
        readonly ir: "importacao/tomados";
    };
    readonly todas: {
        readonly titulo: "Cadastro ainda indisponível";
        readonly html: "O Cadastro fica disponível depois de importar o <b>balancete</b> e as notas: <b>entradas e saídas</b>, ou os <b>serviços</b>.";
        readonly botao: "Ir para a importação";
        readonly ir: null;
    };
};
export declare function SessaoProvider({ nome, slug, pagina, children }: {
    nome: string;
    slug: string;
    pagina: string;
    children: ReactNode;
}): import("react").JSX.Element;
