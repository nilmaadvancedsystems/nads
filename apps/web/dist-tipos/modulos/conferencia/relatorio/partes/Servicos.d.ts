import { conferencia as c } from '@nads/core';
import type { useRelatorio } from '../useRelatorio';
type VM = ReturnType<typeof useRelatorio>;
export declare function Servicos({ vm, tipo }: {
    vm: VM;
    tipo: c.TipoServico;
}): import("react").JSX.Element | null;
export {};
