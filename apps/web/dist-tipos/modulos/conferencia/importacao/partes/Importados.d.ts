import { type useImportacao } from '../useImportacao';
type Notas = NonNullable<ReturnType<typeof useImportacao>['notas']>;
type Servicos = NonNullable<ReturnType<typeof useImportacao>['servicos']>;
export declare function NotasImportadas({ r }: {
    r: Notas;
}): import("react").JSX.Element;
export declare function ServicosImportados({ r }: {
    r: Servicos;
}): import("react").JSX.Element;
export {};
