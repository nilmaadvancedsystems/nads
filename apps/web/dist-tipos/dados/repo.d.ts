import { conferencia } from '@nads/core';
import { type ReactNode } from 'react';
type Repo = conferencia.RepoConferencia;
type Empresa = conferencia.Empresa;
export declare function RepoProvider({ repo, children }: {
    repo: Repo;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useRepo(): Repo;
/** Redesenha a cada gravação no repositório. */
export declare function useVersaoDoRepo(): number;
/** A empresa (ou null se nunca foi aberta), sempre a versão mais nova. */
export declare function useEmpresaGuardada(nome: string | null): Empresa | null;
/**
 * Aplica uma ação (função pura do core: empresa → empresa nova) e guarda.
 * Devolve a empresa nova, para quem precisa dela na mesma hora.
 */
export declare function useAplicar(nome: string | null): (acao: (e: Empresa) => Empresa) => Empresa | null;
export {};
