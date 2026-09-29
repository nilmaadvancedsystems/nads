// O que as telas do Extrator podem pedir e gravar. A tela nunca sabe onde o dado mora.
// Implementação: repo.memoria.ts (neste navegador). Ligar ao banco é decisão pendente
// (docs/aplicativos/extrator/mapa.md).
import type { EmpresaDoEscritorio } from '../empresas';
import type { EmpresaExtrator } from './tipos';

export interface RepoExtrator {
  /** true = dados de exemplo */
  readonly exemplos: boolean;
  /** empresas da escolha de empresa */
  listarEmpresas(): readonly EmpresaDoEscritorio[];
  /** o que está guardado da empresa (null = nada ainda) */
  obter(nome: string): EmpresaExtrator | null;
  salvar(e: EmpresaExtrator): void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
  /** volta os exemplos ao início (só no modo exemplos) */
  restaurarExemplos(): void;
}
