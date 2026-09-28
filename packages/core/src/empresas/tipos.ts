// Empresa do escritório, como aparece na escolha de empresa de qualquer aplicativo.
export interface EmpresaDoEscritorio {
  /** código do ERP (null quando a empresa só existe pelo nome) */
  codigo: number | null;
  nome: string;
  regime: string;
}
