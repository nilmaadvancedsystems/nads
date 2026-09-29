// O que o Creditor pede e grava. A tela nunca sabe onde o dado mora.
// Implementações: repo.memoria.ts (exemplos, neste navegador) e, no site ligado ao banco,
// apps/web/src/aplicativos/extratudo/dados/creditor.firestore.ts (Firestore da Conferência).
import type { ClientesAprendidos } from './regras/aprendizado';
import type { BalanceteDaEmpresa, ConfigCreditor } from './regras/balancete';

export interface RepoCreditor {
  /** true = dados de exemplo */
  readonly exemplos: boolean;
  /** o balancete da empresa, ao vivo (só leitura). No banco, pedir já começa a ouvir. */
  balancete(nome: string): BalanceteDaEmpresa;
  /** as contas salvas da empresa */
  config(nome: string): ConfigCreditor;
  /** as contas dos clientes já conciliados na empresa */
  clientes(nome: string): ClientesAprendidos;
  /** o balancete, as contas salvas e os clientes já chegaram? (antes disso, nada é gravado) */
  carregada(nome: string): boolean;
  salvarConfig(nome: string, c: ConfigCreditor): void;
  salvarClientes(nome: string, c: ClientesAprendidos): void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}
