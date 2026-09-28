import type { conferencia as c } from '@nads/core';
import type { useImportacao } from '../useImportacao';
type Plano = NonNullable<ReturnType<typeof useImportacao>['plano']>;
export declare function PlanoDeContas({ plano, onGrupo }: {
    plano: Plano;
    onGrupo: (g: c.Grupo) => void;
}): import("react").JSX.Element;
export {};
