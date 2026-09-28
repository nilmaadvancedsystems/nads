import type { Empresa, EmpresaDaLista } from './tipos';
export interface RepoConferencia {
    /** Lista da tela de entrada: as empresas da lista + as que já têm dado guardado. */
    listarEmpresas(): EmpresaDaLista[];
    /** Empresa pelo nome (null se nunca foi aberta). */
    obter(nome: string): Empresa | null;
    /** Nome da empresa pelo slug da URL. */
    nomePorSlug(slug: string): string | null;
    /** Guarda a empresa inteira (as ações já devolvem a versão nova). */
    salvar(e: Empresa): void;
    /** Avisa quem está ouvindo a cada mudança. Devolve "parar de ouvir". */
    assinar(aoMudar: () => void): () => void;
    /** Número que muda a cada gravação (para o React saber que precisa redesenhar). */
    versao(): number;
    /** Volta os dados de exemplo ao estado inicial. */
    restaurarExemplos(): void;
}
