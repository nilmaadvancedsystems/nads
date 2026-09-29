// Arquivos de exemplo do Creditor, para testar o fluxo inteiro sem arquivo real. Inventados, e
// montados para passar por todos os casos:
// - 01/09: grupo que bate de primeira (com mora num título e desconto noutro);
// - 02/09: um dígito lido errado (CANTINA: 980,00 no lugar de 930,00) → o grupo não bate por 50,00;
// - NF 4548: duas parcelas (615,33 em 02/09 e 615,34 em 03/09), lançadas juntas no sistema (1.230,67);
// - NF 4555: valor do banco (450,00) diferente do sistema (405,00);
// - NF 4560: não está no sistema;
// - uma seção "Baixa - Pedido Cedente", que fica de fora.
import type { BalanceteDaEmpresa, ContaDoBalancete } from './regras/balancete';

export const EXEMPLO_RELATORIO = `BANCO EXEMPLO S.A. - RELATORIO DE TITULOS LIQUIDADOS
Cedente: EMPRESA EXEMPLO LTDA   Periodo: 01/09/2026 a 03/09/2026

Liquidacao
Sacado  Nosso Numero  Seu Numero  Vencimento  Valor (R$)  Vlr. Mora  Vlr. Desc. Acresc.  Dt. Liquidacao  Vlr. Cobrado
MERCADO BOM PRECO LTDA  00012345671  4521  28/08/2026  1.250,00  12,50  0,00  01/09/2026  1.262,50
PADARIA SAO JORGE ME  00012345682  4533  01/09/2026  830,40  0,00  16,61  01/09/2026  813,79
RESTAURANTE SABOR CASEIRO  00012345693  4540  01/09/2026  2.100,00  0,00  0,00  01/09/2026  2.100,00
Total de Valores do grupo  4.180,40  12,50  16,61  4.176,29
SUPERMERCADO ALVORADA LTDA  00012345704  4548  25/08/2026  615,33  0,00  0,00  02/09/2026  615,33
ACOUGUE BOI GORDO  00012345737  4555  02/09/2026  450,00  0,00  0,00  02/09/2026  450,00
CANTINA DA NONNA LTDA  00012345748  4557  30/08/2026  980,00  9,30  0,00  02/09/2026  939,30
Total de Valores do grupo  1.995,33  9,30  0,00  2.004,63
SUPERMERCADO ALVORADA LTDA  00012345715  4548  25/09/2026  615,34  0,00  0,00  03/09/2026  615,34
EMPORIO VERDE EIRELI  00012345759  4560  03/09/2026  322,15  0,00  0,00  03/09/2026  322,15
MERCEARIA DOIS IRMAOS  00012345760  4562  03/09/2026  1.480,00  0,00  29,60  03/09/2026  1.450,40
Total de Valores do grupo  2.417,49  0,00  29,60  2.387,89

Baixa - Pedido Cedente
Sacado  Nosso Numero  Seu Numero  Vencimento  Vlr. Baixado
LANCHONETE PONTO CERTO  00012345726  4502  20/08/2026  300,00
Total de Valores Baixados  300,00

Total de Valores Liquidados  8.593,22  21,80  46,21  8.568,81
`;

export const EXEMPLO_SISTEMA_CSV = `Data;Documento;Cliente;Contrapartida;Histórico;Valor
01/09/2026;4521;MERCADO BOM PRECO LTDA;11201;Recebimento de clientes NF 4521 - MERCADO BOM PRECO LTDA;1.250,00
01/09/2026;4533;PADARIA SAO JORGE ME;11201;Recebimento de clientes NF 4533 - PADARIA SAO JORGE ME;830,40
01/09/2026;4540;RESTAURANTE SABOR CASEIRO LTDA;11203;Recebimento de clientes NF 4540 - RESTAURANTE SABOR CASEIRO LTDA;2.100,00
02/09/2026;4548;SUPERMERCADO ALVORADA LTDA;11201;Recebimento de clientes NF 4548 - SUPERMERCADO ALVORADA LTDA;1.230,67
02/09/2026;4555;ACOUGUE BOI GORDO;11201;Recebimento de clientes NF 4555 - ACOUGUE BOI GORDO;405,00
02/09/2026;4557;CANTINA DA NONNA LTDA;11202;Recebimento de clientes NF 4557 - CANTINA DA NONNA LTDA;930,00
03/09/2026;4562;MERCEARIA DOIS IRMAOS;11201;Recebimento de clientes NF 4562 - MERCEARIA DOIS IRMAOS;1.480,00
`;

// Balancetes de exemplo (os mesmos nomes de empresa do Extratudo), para ver as contas do Creditor:
// - 901: balancete completo: as três contas são sugeridas (com os códigos do prompt);
// - 902: só sobrou o plano (o balancete foi apagado ao sair da Conferência) e não há conta de descontos;
// - 903: nunca teve balancete: valem os padrões do prompt.
const conta = (codigo: string, nome: string, grupo: string, sintetica = false): ContaDoBalancete => ({ codigo, nome, grupo, sintetica });

export const BALANCETES_EXEMPLO: Record<string, BalanceteDaEmpresa> = {
  'EXEMPLO COMERCIO DE ALIMENTOS LTDA': {
    origem: 'balancete', em: '2026-09-02T13:10:00.000Z', contas: [
      conta('10000', 'ATIVO', 'Ativo', true),
      conta('10101', 'CAIXA GERAL', 'Ativo'),
      conta('10502', 'BANCO DO BRASIL C/ MOVIMENTO', 'Ativo'),
      conta('10503', 'BANCO SICOOB C/ MOVIMENTO', 'Ativo'),
      conta('10510', 'SICOOB APLICACAO FINANCEIRA', 'Ativo'),
      conta('30000', 'RECEITAS', 'Receita', true),
      conta('97301', 'JUROS PASSIVOS', 'Despesa'),
      conta('97304', 'JUROS RECEBIDOS', 'Receita'),
      conta('85001', 'DESCONTOS CONCEDIDOS', 'Despesa'),
      conta('85002', 'DESCONTOS OBTIDOS', 'Receita'),
    ],
  },
  'EXEMPLO SERVICOS MEDICOS LTDA': {
    origem: 'plano', em: '2026-08-28T10:00:00.000Z', contas: [
      { codigo: '11101', nome: 'CAIXA' },
      { codigo: '11205', nome: 'SICOOB CREDICOOP C MOVIMENTO' },
      { codigo: '31120', nome: 'JUROS ATIVOS' },
    ],
  },
};
