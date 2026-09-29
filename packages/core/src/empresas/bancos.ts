// Os bancos de cada empresa (as contas que a etapa de extratos pede, uma linha por banco).
// PROVISÓRIO (29/09/2026): até os bancos virarem cadastro da empresa, ficam aqui; quem não está na lista
// aparece com uma linha "Banco" só. A 292 tem só o Sicoob.

/** id = a marca do banco (o logo), nome = como aparece na tela. */
export interface BancoDaEmpresa { id: string; nome: string }

const POR_CODIGO: Record<number, BancoDaEmpresa[]> = {
  292: [{ id: 'sicoob', nome: 'Sicoob' }],
};

const SEM_CADASTRO: BancoDaEmpresa[] = [{ id: 'banco', nome: 'Banco' }];

export function bancosDaEmpresa(codigo: number | null): BancoDaEmpresa[] {
  return (codigo != null && POR_CODIGO[codigo]) || SEM_CADASTRO;
}

/** Os bancos que dá para adicionar pela tela ("Adicionar banco ▾"), em ordem alfabética. */
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
