import type { RepoConferencia } from './repo';
import type { Empresa, EmpresaDaLista } from './tipos';
interface Guarda {
    ler(): string | null;
    gravar(v: string): void;
    apagar(): void;
}
export declare function criarRepoConferenciaMemoria(opcoes?: {
    guarda?: Guarda | null;
    lista?: EmpresaDaLista[];
    exemplos?: () => Empresa[];
}): RepoConferencia;
export {};
