import { describe, expect, it } from 'vitest';
import { anoDoInforme, cnpjDaFontePagadora, idDoPedidoDeDocumentoDp, informeDaEmpresa, mesComArquivoDp, pedidoDeDocumentoDp, textoDoPdf, TITULO_DO_PEDIDO_DE_DOCUMENTO_DP } from './documentoAntigo';

describe('o informe de rendimentos da empresa (ficha 37, "Sim, pelo CNPJ")', () => {
  // o modelo da Receita (dados inventados): a empresa é a fonte pagadora, o funcionário o beneficiário
  const daEmpresa = 'COMPROVANTE DE RENDIMENTOS PAGOS E DE IMPOSTO SOBRE A RENDA RETIDO NA FONTE Ano-calendário 2025 1. Fonte Pagadora Pessoa Jurídica ou Pessoa Física CNPJ/CPF 49.032.922/0001-70 Nome Empresarial XTREME ACADEMIA LTDA 2. Pessoa Física Beneficiária dos Rendimentos CPF 123.456.789-09 Nome Completo FULANO';
  // o do banco: a empresa aparece como beneficiária, a fonte é o banco
  const doBanco = 'Informe de Rendimentos Financeiros 2025 Fonte pagadora: BANCO EXEMPLO S.A. CNPJ 00.000.000/0001-91 Beneficiário dos rendimentos XTREME ACADEMIA LTDA CNPJ 49.032.922/0001-70';
  // o do Nubank: o CNPJ da empresa antes, a fonte sem CNPJ depois
  const nubank = 'Informe de Rendimentos Pessoa jurídica beneficiária dos rendimentos CNPJ XTREME 49.032.922/0001-70 Fonte pagadora: Nu Pagamentos S.A. - Instituição de Pagamento';
  it('só o da empresa conta', () => {
    expect(informeDaEmpresa(daEmpresa, '49032922000170')).toBe(true);
    expect(informeDaEmpresa(doBanco, '49.032.922/0001-70')).toBe(false);
    expect(informeDaEmpresa(nubank, '49032922000170')).toBe(false);
    expect(informeDaEmpresa(daEmpresa, '')).toBe(false);
    expect(cnpjDaFontePagadora(doBanco)).toBe('00000000000191');
    expect(cnpjDaFontePagadora('sem fonte')).toBe('');
  });
  it('o texto do PDF em ordem e o ano pelo nome do arquivador', () => {
    expect(textoDoPdf([[{ texto: 'b', x: 10, y: 100 }, { texto: 'a', x: 0, y: 200 }, { texto: 'c', x: 50, y: 100 }]])).toBe('a b c');
    expect(anoDoInforme('2025 - INFORME DE RENDIMENTOS XTREME ACADEMIA.pdf')).toBe(2025);
    expect(anoDoInforme('3º TRIMESTRE 2026 - INFORME DE RENDIMENTOS NUBANK.pdf')).toBe(2026);
    expect(anoDoInforme('extrato.pdf')).toBeNull();
  });
});

describe('o documento antigo do RH sob pedido (ficha 37)', () => {
  it('o pedido vai marcado e volta o mesmo id', () => {
    const p = pedidoDeDocumentoDp('abc_123-x')!;
    expect(p).toEqual({ tipo: 'documento', titulo: TITULO_DO_PEDIDO_DE_DOCUMENTO_DP, texto: 'docdp:abc_123-x' });
    expect(idDoPedidoDeDocumentoDp(p)).toBe('abc_123-x');
  });
  it('id torto não vira pedido; chamado comum não é pedido', () => {
    expect(pedidoDeDocumentoDp('../x')).toBeNull();
    expect(pedidoDeDocumentoDp('')).toBeNull();
    expect(idDoPedidoDeDocumentoDp({ tipo: 'documento', titulo: 'Segunda via', texto: 'docdp:abc' })).toBe('');
    expect(idDoPedidoDeDocumentoDp({ tipo: 'duvida', titulo: TITULO_DO_PEDIDO_DE_DOCUMENTO_DP, texto: 'docdp:abc' })).toBe('');
    expect(idDoPedidoDeDocumentoDp({ tipo: 'documento', titulo: TITULO_DO_PEDIDO_DE_DOCUMENTO_DP, texto: 'docdp:a/b' })).toBe('');
    expect(idDoPedidoDeDocumentoDp(null)).toBe('');
  });
  it('os 3 meses recentes têm o PDF; os outros, sob pedido', () => {
    expect(['2026-11', '2026-10', '2026-09', '2026-08', '2025-12', '2026-12', 'x'].map(c => mesComArquivoDp(c, '2026-11'))).toEqual([true, true, true, false, false, false, false]);
    expect(mesComArquivoDp('2025-12', '2026-01')).toBe(true);
  });
});
