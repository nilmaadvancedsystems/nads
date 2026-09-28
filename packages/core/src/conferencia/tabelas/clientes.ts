// SEED — empresas que o original cria no banco na primeira carga (conferencia.html SEED ~L1517).
// A lista de empresas do escritório (CLIENTES) agora mora em empresas/, que é de todos os aplicativos.
import { EMPRESAS } from '../../empresas/lista';
import type { Empresa, EmpresaDaLista } from '../tipos';

/** A lista da tela de entrada (CLIENTES do original) = as empresas do escritório. */
export const CLIENTES: readonly EmpresaDaLista[] = EMPRESAS;

/** Empresas que o original cria no banco na primeira carga, se ainda não existirem. */
export const SEED: Readonly<Record<string, Partial<Empresa>>> = {
  "DORNAS HAVANA LTDA": {
    "contas": [],
    "entradas": [],
    "saidas": [],
    "dp": [
      {
        "lanc": "226",
        "conta": "40105",
        "nome": "Venda De Mercadorias Do Estabelecimento",
        "dc": "C",
        "travado": true
      },
      {
        "lanc": "227",
        "conta": "40101",
        "nome": "Vendas de produtos no mercado interno",
        "dc": "C",
        "travado": true
      },
      {
        "lanc": "637",
        "conta": "40102",
        "nome": "Vendas de produtos c/ fim específico de exportação",
        "dc": "C",
        "travado": true
      },
      {
        "lanc": "1",
        "conta": "40104",
        "nome": "Revenda de Mercadorias",
        "dc": "C",
        "travado": true
      },
      {
        "lanc": "667",
        "conta": "40203",
        "nome": "(-) Devoluçoes de Vendas de Produtos",
        "dc": "D",
        "travado": true
      },
      {
        "lanc": "14",
        "conta": "66015",
        "nome": "Fretes e Carretos",
        "dc": "D",
        "travado": true
      },
      {
        "lanc": "215",
        "conta": "31122",
        "nome": "Materiais para Uso e Consumo",
        "dc": "D",
        "travado": true
      },
      {
        "lanc": "624",
        "conta": "12738",
        "nome": "Compras de Insumos a Prazo",
        "dc": "D",
        "travado": true
      },
      {
        "lanc": "40",
        "conta": "31105",
        "nome": "Energia Elétrica",
        "dc": "D",
        "travado": true
      },
      {
        "lanc": "47",
        "conta": "31103",
        "nome": "Combustíveis",
        "dc": "D",
        "travado": true
      },
      {
        "lanc": "39",
        "conta": "31101",
        "nome": "Agua e Esgoto",
        "dc": "D",
        "travado": true
      },
      {
        "lanc": "38",
        "conta": "21401",
        "nome": "Telefone a pagar",
        "dc": "D",
        "travado": true
      },
      {
        "lanc": "6",
        "conta": "66005",
        "nome": "Compras de Mercadorias para Revenda à Prazo",
        "dc": "D",
        "travado": true
      }
    ]
  }
};
