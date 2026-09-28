import type { useConfiguracoes } from '../useConfiguracoes';
type VM = ReturnType<typeof useConfiguracoes>;
type Naturezas = NonNullable<VM['naturezas']>;
export declare function Naturezas({ n, entradas, vm }: {
    n: Naturezas;
    entradas: boolean;
    vm: VM;
}): import("react").JSX.Element;
export {};
