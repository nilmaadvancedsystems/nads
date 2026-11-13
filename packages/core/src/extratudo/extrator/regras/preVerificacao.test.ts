import { describe, expect, it } from 'vitest';
import { bancoDoTexto, deOutroBanco, nomeDeOutroDocumento, preVerificarExtrato, preVerificarOfx } from './preVerificacao';
import type { Lancamento } from '../tipos';

const lanc = (...historicos: string[]) => historicos.map((historico, i) => ({ data: '2026-03-0' + (i + 1), historico, valor: i % 2 ? -10 : 10 })) as Lancamento[];
const tipo = (texto: string, l = lanc('PIX RECEBIDO', 'TARIFA'), ocr = false) => preVerificarExtrato(texto, l, ocr)?.tipo ?? null;

describe('o extrato da conta passa', () => {
  it('com título e saldo, mesmo citando a fatura e a aplicação', () => {
    expect(tipo('Extrato de conta corrente Agência 1 Conta 2 Saldo anterior 10,00 Pagamento de fatura cartão Aplicação automática')).toBeNull();
  });
  it('sem título, com o saldo do dia', () => {
    expect(tipo('Banco Exemplo 01/03 PIX 10,00 SALDO DO DIA 20,00')).toBeNull();
  });
  it('a coluna Saldo, repetida', () => {
    expect(tipo('Data Histórico Valor Saldo 01/03 PIX 10,00 Saldo 20,00')).toBeNull();
  });
  it('o Bradesco com a coluna do investimento e o saldo (a amostra do Drive, 10/11/2026)', () => {
    expect(tipo('Extrato de: Ag: 1 | CC: 2 Total Disponível (R$) Investimento sem Baixa Saldo bruto em 01/03 Saldo Anterior 10,00')).toBeNull();
  });
  it('o BB com o título da conta e sem a palavra saldo', () => {
    expect(tipo('Consultas - Extrato de conta corrente Agência 1 Conta 2 01/03 PIX 10,00')).toBeNull();
  });
  it('o consolidado, com a conta e os fundos', () => {
    expect(tipo('Extrato consolidado Mês: Março/2026 > CONTA CORRENTE Saldo anterior 1,00 > FUNDOS saldo bruto em 31/03')).toBeNull();
  });
  it('o escaneado que o OCR leu sem o saldo', () => {
    expect(tipo('Banco Exemplo 01/03 PIX 10,00', lanc('PIX'), true)).toBeNull();
  });
});

describe('o que não é extrato fica de fora', () => {
  it('a fatura, que não tem saldo da conta', () => {
    expect(tipo('Resumo da fatura Total desta fatura 100,00 Vencimento 10/03')).toBe('fatura');
  });
  it('a fatura com "saldo fatura anterior" não vira extrato', () => {
    expect(tipo('Fatura do cartão Vencimento 10/03 Pagamento mínimo 10,00 Saldo fatura anterior 5,00')).toBe('fatura');
  });
  it('a aplicação, mesmo com saldo', () => {
    expect(tipo('Extrato de investimento Fundo Exemplo Saldo anterior 100,00 Saldo final 101,00', lanc('APLICACAO', 'RENDIMENTO', 'IR'))).toBe('aplicacao');
  });
  it('o empréstimo', () => {
    expect(tipo('Evolução contratual Contrato 123 Saldo devedor 500,00')).toBe('emprestimo');
  });
  it('a cobrança, a maquininha, o comprovante e a nota, sem saldo', () => {
    expect(tipo('Relatório de cobrança Títulos 01/03 10,00')).toBe('cobranca');
    expect(tipo('Relatório de vendas Bandeira 01/03 10,00')).toBe('maquininha');
    expect(tipo('Comprovante de pagamento 01/03 10,00')).toBe('comprovante');
    expect(tipo('DANFE Documento auxiliar 01/03 10,00')).toBe('nota');
  });
  it('o comprovante impresso da tela do BB, com o cabeçalho da consulta', () => {
    expect(tipo('Consultas - Extrato de conta corrente 01/03 - BANCO - 10:00 COMPROVANTE DE TED CLIENTE: EXEMPLO')).toBe('comprovante');
  });
  it('o boleto', () => {
    expect(tipo('Beneficiário Exemplo Pagador Exemplo 12345.67890 12345.678901 12345.678901 1 12345678901234')).toBe('boleto');
  });
  it('tem data e valor, mas nada de saldo', () => {
    expect(tipo('Relação de despesas 01/03 Aluguel 10,00')).toBe('sem-saldo');
  });
});

describe('o resto da porta de entrada', () => {
  it('o OFX de cartão e o de investimento', () => {
    expect(preVerificarOfx('<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>')?.tipo).toBe('fatura');
    expect(preVerificarOfx('<OFX><INVSTMTMSGSRSV1><INVSTMTRS>')?.tipo).toBe('aplicacao');
    expect(preVerificarOfx('<OFX><BANKMSGSRSV1><STMTRS>')).toBeNull();
  });
  it('o nome do arquivo', () => {
    expect(nomeDeOutroDocumento('Fatura 03-2026.pdf')).toBe(true);
    expect(nomeDeOutroDocumento('APLICAÇÃO 03-2026.pdf')).toBe(true);
    expect(nomeDeOutroDocumento('03-2026.pdf')).toBe(false);
    expect(nomeDeOutroDocumento('Extrato Sicoob 03-2026.pdf')).toBe(false);
  });
});

describe('o banco do arquivo pelo cabeçalho (12/11/2026)', () => {
  it('diz o banco quando o topo cita um só', () => {
    expect(bancoDoTexto('Relatório de movimentações CloudWalk Instituição de Pagamento Agência 0001 Saldo')).toBe('infinitepay');
    expect(bancoDoTexto('EXTRATO CONSOLIDADO agosto/2026 Prezado Cliente, O Santander tem soluções financeiras')).toBe('santander');
    expect(bancoDoTexto('Extrato de conta corrente Agência 1 Conta 2 Saldo anterior')).toBeNull();
    expect(bancoDoTexto('Santander e Bradesco no mesmo cabeçalho')).toBeNull();
    expect(bancoDoTexto('x '.repeat(400) + 'PIX recebido do Santander')).toBeNull();
  });
  it('outro banco só quando os dois são conhecidos e diferentes', () => {
    expect(deOutroBanco('infinitepay', 'santander')).toBe(true);
    expect(deOutroBanco('santander', 'santander')).toBe(false);
    expect(deOutroBanco(undefined, 'santander')).toBe(false);
    expect(deOutroBanco('santander', 'banco')).toBe(false);
  });
});
