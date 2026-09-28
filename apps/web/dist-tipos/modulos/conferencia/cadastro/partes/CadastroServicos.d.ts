import type { useConfiguracoes } from '../useConfiguracoes';
type Servicos = NonNullable<ReturnType<typeof useConfiguracoes>['servicos']>;
export declare function CadastroServicos({ sv }: {
    sv: Servicos;
}): import("react").JSX.Element;
export {};
