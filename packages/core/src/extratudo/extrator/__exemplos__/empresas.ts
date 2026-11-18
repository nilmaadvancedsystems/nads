// Dados de EXEMPLO do Extrator. Tudo inventado: nomes "EXEMPLO…", históricos e valores montados
// para a conferência mostrar todos os casos (conferido, faltando, diferente, a mais, duplicado).
import type { EmpresaDoEscritorio } from '../../../empresas';
import type { EmpresaExtrator, Lancamento } from '../tipos';

export const EMPRESAS_EXEMPLO: EmpresaDoEscritorio[] = [
  { codigo: 901, nome: 'EXEMPLO COMERCIO DE ALIMENTOS LTDA', regime: 'Simples' },
  { codigo: 902, nome: 'EXEMPLO SERVICOS MEDICOS LTDA', regime: 'Presumido' },
  { codigo: 903, nome: 'EXEMPLO EMPRESA NOVA LTDA', regime: 'Simples' },
];

const l = (dia: number, valor: number, historico: string, conta?: string): Lancamento => ({ data: '2026-08-' + String(dia).padStart(2, '0'), valor, historico, ...(conta ? { conta } : {}) });

export function empresasDeExemplo(): EmpresaExtrator[] {
  const quando = '2026-09-01T12:00:00.000Z';
  return [{
    nome: EMPRESAS_EXEMPLO[0].nome,
    arquivos: [
      {
        id: 'ex-banco', lado: 'banco', nome: 'extrato-agosto.pdf', importadoEm: quando, modo: 'primeira', lancamentos: [
          l(3, 450000, 'PIX RECEBIDO CLIENTE ALFA'), l(4, -128900, 'PAGTO BOLETO ENERGIA'), l(4, -4590, 'TARIFA PACOTE SERVICOS'),
          l(5, -350000, 'SISPAG SALARIOS'), l(10, -73500, 'DARF SIMPLES NACIONAL'), l(10, -73500, 'DARF SIMPLES NACIONAL'),
          l(12, 89000, 'TED RECEBIDA BETA LTDA'), l(18, -1290, 'TARIFA PIX'), l(20, -55000, 'PIX ENVIADO FORNECEDOR DELTA'),
          l(22, 125000, 'DEPOSITO EM DINHEIRO'), l(25, -21000, 'PAGTO BOLETO INTERNET'),
        ],
      },
      {
        id: 'ex-sistema', lado: 'sistema', nome: 'razao-banco-agosto.xlsx', importadoEm: quando, modo: 'primeira', lancamentos: [
          // com a contrapartida, como o razão da conciliação do Alterdata (o Lançatudo lê a conta do cliente por ela)
          l(3, 450000, 'Recebimento cliente Alfa', '11201'), l(4, -128900, 'Pagamento energia elétrica', '81020'), l(4, -4590, 'Tarifa bancária', '81012'),
          l(5, -350000, 'Pagamento salários', '20510'), l(10, -73500, 'Simples Nacional', '20501'), l(14, 89000, 'Recebimento Beta', '11202'),
          l(20, -50500, 'Pagamento fornecedor Delta', '21101'), l(22, -125000, 'Depósito em dinheiro', '10101'), l(25, -21000, 'Internet', '81030'),
          l(25, -21000, 'Internet', '81030'), l(28, -60000, 'Honorários contábeis', '81030'),
        ],
      },
    ],
    auditoria: [
      { ts: quando, acao: 'Importou extrato', detalhe: 'extrato-agosto.pdf · 11 gravado(s)', tom: 'ok' },
      { ts: quando, acao: 'Importou lançamentos do sistema', detalhe: 'razao-banco-agosto.xlsx · 11 gravado(s)', tom: 'ok' },
    ],
  }];
}
