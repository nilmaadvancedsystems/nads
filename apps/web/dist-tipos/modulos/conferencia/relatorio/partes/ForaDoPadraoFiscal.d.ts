import { conferencia as c } from '@nads/core';
import type { useRelatorio } from '../useRelatorio';
type VM = ReturnType<typeof useRelatorio>;
export declare function ForaDoPadraoFiscal({ vm, tipo }: {
    vm: VM;
    tipo: c.TipoNotaFiscal;
}): import("react").JSX.Element | null;
export {};
