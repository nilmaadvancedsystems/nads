import { conferencia as c } from '@nads/core';
export declare function Situacao({ sit, contas, servico, onRevisar }: {
    sit: c.Situacao;
    contas: string[];
    servico?: boolean;
    onRevisar: (contas: string[]) => void;
}): import("react").JSX.Element;
/** Ícone de alerta da conta do Passivo (vínculo errado vindo de antes) — o avisoPassivo (~L2282). */
export declare function IconePassivo({ aviso }: {
    aviso: string | null;
}): import("react").JSX.Element | null;
/** Props da <tr> com conta do Passivo. */
export declare function linhaPassivo(aviso: string | null): {
    className: string;
    title: string;
} | {
    className?: undefined;
    title?: undefined;
};
