// Os bancos de cada empresa (as contas que a etapa de extratos pede, uma linha por conta).
// PROVISÓRIO (29/09/2026): até os bancos virarem cadastro da empresa, ficam aqui; quem não está na lista
// aparece com uma linha "Banco" só. A 292 tem só o Sicoob. Contas novas a pessoa adiciona na tela do
// Extrator (com agência e conta), valendo de uma competência em diante.

/**
 * Uma conta da empresa. id = a linha (único na empresa: marca + agência + conta); marca = o banco (o logo);
 * nome = como aparece na tela.
 */
export interface BancoDaEmpresa { id: string; nome: string; marca?: string; agencia?: string; conta?: string }

const POR_CODIGO: Record<number, BancoDaEmpresa[]> = {
  292: [{ id: 'sicoob', nome: 'Sicoob', marca: 'sicoob' }],
};

const SEM_CADASTRO: BancoDaEmpresa[] = [{ id: 'banco', nome: 'Banco' }];

export function bancosDaEmpresa(codigo: number | null): BancoDaEmpresa[] {
  return (codigo != null && POR_CODIGO[codigo]) || SEM_CADASTRO;
}

/** O id da linha de uma conta: o banco, a agência e a conta (só números e letras). */
export function idDaConta(marca: string, agencia: string, conta: string): string {
  const limpo = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return [marca, limpo(agencia), limpo(conta)].filter(Boolean).join('-');
}

/** "Ag. 3001 · C/C 12345-6" (o que tiver). */
export function rotuloDaConta(b: { agencia?: string; conta?: string }): string {
  return [b.agencia ? 'Ag. ' + b.agencia : '', b.conta ? 'C/C ' + b.conta : ''].filter(Boolean).join(' · ');
}

/** Os bancos que dá para adicionar pela tela ("Adicionar banco ▾"), em ordem alfabética (id = a marca). */
export const BANCOS_CONHECIDOS: readonly BancoDaEmpresa[] = [
  { id: 'banco-do-brasil', nome: 'Banco do Brasil' },
  { id: 'banrisul', nome: 'Banrisul' },
  { id: 'bradesco', nome: 'Bradesco' },
  { id: 'btg', nome: 'BTG Pactual' },
  { id: 'c6', nome: 'C6 Bank' },
  { id: 'caixa', nome: 'Caixa' },
  { id: 'cora', nome: 'Cora' },
  { id: 'inter', nome: 'Inter' },
  { id: 'itau', nome: 'Itaú' },
  { id: 'mercado-pago', nome: 'Mercado Pago' },
  { id: 'nubank', nome: 'Nubank' },
  { id: 'pagbank', nome: 'PagBank' },
  { id: 'safra', nome: 'Safra' },
  { id: 'santander', nome: 'Santander' },
  { id: 'sicoob', nome: 'Sicoob' },
  { id: 'sicredi', nome: 'Sicredi' },
  { id: 'stone', nome: 'Stone' },
];
