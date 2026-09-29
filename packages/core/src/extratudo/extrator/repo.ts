// O que as telas do Extrator podem pedir e gravar. A tela nunca sabe onde o dado mora.
// Implementações: repo.memoria.ts (neste navegador, e os exemplos) e, no site ligado ao banco,
// apps/web/src/aplicativos/extratudo/dados/extrator.firestore.ts (Firestore da Conferência).
import type { EmpresaDoEscritorio } from '../../empresas';
import type { EmpresaExtrator } from './tipos';

export interface RepoExtrator {
  /** true = dados de exemplo */
  readonly exemplos: boolean;
  /** empresas da escolha de empresa */
  listarEmpresas(): readonly EmpresaDoEscritorio[];
  /** o que está guardado da empresa (null = nada ainda). No banco, pedir já começa a carregar. */
  obter(nome: string): EmpresaExtrator | null;
  /** a empresa já foi carregada? (antes disso, nada é gravado e a tela mostra "Carregando…") */
  carregada(nome: string): boolean;
  salvar(e: EmpresaExtrator): void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
  /** volta os exemplos ao início (só no modo exemplos) */
  restaurarExemplos(): void;
}
