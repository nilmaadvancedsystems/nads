import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { type NomeIcone } from './icones';
/** Aviso dentro de uma caixa (.alert). tom "ok" = verde. */
export declare function Alerta({ titulo, texto, tom, children, onFechar }: {
    titulo: string;
    texto?: ReactNode;
    tom?: 'ok';
    children?: ReactNode;
    onFechar?: () => void;
}): import("react").JSX.Element;
/**
 * Mensagem flutuante de importação: some sozinha em 3,7 s, tem ×, e fecha ao trocar de tela
 * (o componente sai da tela junto). id = o do CSS original (#planoMsg, #msgEnt, #msgSai, #msgPrest, #msgTom).
 */
export declare function MensagemFlutuante({ id, children, onFechar, chave }: {
    id: string;
    children: ReactNode | null;
    onFechar: () => void;
    chave: number;
}): import("react").JSX.Element;
/** Campo "Escolher arquivo" (.file-picker) com × para tirar. */
export declare function CampoArquivo({ id, arquivo, onEscolher, aceitar, oculto, abrirAgora }: {
    id: string;
    arquivo: File | null;
    onEscolher: (f: File | null) => void;
    aceitar: string;
    oculto?: boolean;
    /** muda de valor → abre a janela de escolher arquivo (Reimportar) */
    abrirAgora?: number;
}): import("react").JSX.Element;
/** Seletor interno (.steps / .step-pill). Opção travada = apagada, clicar chama onTravada. */
export declare function Segmentado<T extends string>({ valor, opcoes, onMudar, id }: {
    valor: T;
    opcoes: {
        valor: T;
        rotulo: string;
        oculta?: boolean;
        travada?: string | false;
    }[];
    onMudar: (v: T) => void;
    id?: string;
}): import("react").JSX.Element;
/** Um número da faixa (.stat). */
export declare function Stat({ rotulo, valor, cor, grande }: {
    rotulo: string;
    valor: ReactNode;
    cor?: 'entrada' | 'saida';
    grande?: boolean;
}): import("react").JSX.Element;
/** Chave On/Off (.toggle-switch). */
export declare function Interruptor({ ligado, onMudar, rotulo }: {
    ligado: boolean;
    onMudar: () => void;
    rotulo: string;
}): import("react").JSX.Element;
/** Botão de ação que mostra spinner + texto no gerúndio enquanto trabalha. */
export declare function BotaoAcao({ carregando, textoCarregando, className, children, ...resto }: {
    carregando?: boolean;
    textoCarregando?: string;
    className?: string;
    children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>): import("react").JSX.Element;
/** Ícone clicável (.icon-btn). */
export declare function BotaoIcone({ icone, titulo, pequeno, className, ...resto }: {
    icone: NomeIcone;
    titulo: string;
    pequeno?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>): import("react").JSX.Element;
/** Campo de data dd/mm/aaaa com máscara. */
export declare function CampoData({ valor, onMudar, rotulo, id, onEnter }: {
    valor: string;
    onMudar: (v: string) => void;
    rotulo: string;
    id?: string;
    onEnter?: () => void;
}): import("react").JSX.Element;
/** Estado local que volta ao valor inicial quando a chave muda (ex.: trocar de empresa). */
export declare function useEstadoPorChave<T>(chave: string, inicial: T): [T, (v: T | ((a: T) => T)) => void];
