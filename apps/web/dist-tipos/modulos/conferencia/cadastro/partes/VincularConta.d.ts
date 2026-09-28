import type { ReactNode } from 'react';
import { type Vinculo } from '../useConfiguracoes';
export declare function ChipsDeContas({ v }: {
    v: Vinculo;
}): import("react").JSX.Element | null;
/** .ndp-add: botão que vira campo de busca; `extra` = botão ao lado que some com o campo aberto. */
export declare function CampoVincular({ v, rotulo, titulo, extra }: {
    v: Vinculo;
    rotulo: string;
    titulo: string;
    extra?: (escondido: boolean) => ReactNode;
}): import("react").JSX.Element;
