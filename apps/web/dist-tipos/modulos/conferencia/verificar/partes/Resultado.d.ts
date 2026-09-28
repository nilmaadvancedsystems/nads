import type { useVerificarConta } from '../useVerificarConta';
type Vm = ReturnType<typeof useVerificarConta>;
type Res = NonNullable<Vm['resultado']>;
export declare function Resultado({ vm, r }: {
    vm: Vm;
    r: Res;
}): import("react").JSX.Element;
export {};
