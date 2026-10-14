import { describe, expect, it } from 'vitest';
import type { AnexoDoEmail } from '../drive';
import { bancosSemRelatorio, candidatosDoEmail, juntarSemRepetir, periodoDaBuscaAutomatica, relatorioServeNoMes } from '../regras/automatico';
import { cedenteDosTitulosPorPeriodo, formatoDoRelatorio, lerCarteiraDeCobranca, relatorioDaEmpresa } from './formatos';

// as linhas como o pdf.js monta (linhasDosItens) do "Extrato de Movimentação da Carteira de Cobrança"
const PAGINA = [
  'Extrato de Movimentação da Carteira de Cobrança',
  'Ultim/Movim  Emissão  Folhas',
  '13/02/2026  02/03/2026  5',
  'Nosso Número  Seu Número  Nome do Pagador  Vencimento  Data Pagto  Valor do Título  Oscilação/Despesa  Valor Cobrado  CL',
  '60140000002  NF 101  CLIENTE DA CARTEIRA  13/02/2026  13/02/2026  600,00  0,00  612,50  2',
  'LTDA',
  '0  TIT.  R$ 0,00  CODLANC.  0',
  'Saldo Anterior  Total de Entradas  Total das Baixas  Saldo Atual  CRÉDITO EM:  26/02/2026  319,50',
  'Agência  Razão  C/Creditada  Conta/Contrato',
  '1234 / CIDADE  7 / 5  1234 - 5  12340001234',
  'EXEMPLO CONSTRUCOES MECANICAS',
];

describe('os formatos do Creditor', () => {
  it('só os dois formatos', () => {
    expect(formatoDoRelatorio(PAGINA)).toBe('carteira-de-cobranca');
    expect(formatoDoRelatorio(['Relatório - Títulos por Período', 'Cedente:  100200 - EMPRESA EXEMPLO LTDA', 'Sacado  Nosso Número'])).toBe('titulos-por-periodo');
    expect(formatoDoRelatorio(['COMPROVANTE DE', 'PAGAMENTO DE BOLETO', 'Pagador:'])).toBeNull();
    expect(formatoDoRelatorio(['EXTRATO DE CONTA CORRENTE', 'CRÉD.LIQUIDAÇÃO COBRANÇA'])).toBeNull();
  });

  it('lê a carteira de cobrança: o título, o nome em duas linhas, a mora e o cedente', () => {
    const r = lerCarteiraDeCobranca([PAGINA, PAGINA]);
    expect(r.cedente).toBe('EXEMPLO CONSTRUCOES MECANICAS');
    const ts = r.grupos.flatMap(g => g.titulos);
    expect(ts).toHaveLength(1);
    expect(ts[0]).toMatchObject({ nossoNumero: '60140000002', nf: 'NF 101', sacado: 'CLIENTE DA CARTEIRA LTDA', valor: 600, mora: 12.5, desconto: 0, liquidacao: '13/02/2026', cobrado: 612.5 });
  });

  it('o cedente decide de qual empresa é', () => {
    expect(cedenteDosTitulosPorPeriodo(['Cedente:  100200 - EMPRESA EXEMPLO INDUSTRIA E COMERCIO LTDA'])).toBe('EMPRESA EXEMPLO INDUSTRIA E COMERCIO LTDA');
    expect(relatorioDaEmpresa('EMPRESA EXEMPLO INDUSTRIA E COMERCIO LTDA', 'EMPRESA EXEMPLO INDUSTRIA E COMERCIO LTDA')).toBe(true);
    expect(relatorioDaEmpresa('EXEMPLO CONSTRUCOES MECANICAS', 'EMPRESA EXEMPLO INDUSTRIA E COMERCIO LTDA')).toBe(false);
    expect(relatorioDaEmpresa('', 'X')).toBe(false);
  });
});

describe('o importar automático', () => {
  const anexo = (nome: string, assunto = '', de = 'x@y.com'): AnexoDoEmail => ({ caixa: 'robo', mensagemId: nome, anexoId: nome, nome, tamanho: nome.length, de, assunto, em: '2026-03-02' });

  it('o período vai até 45 dias depois do fim do mês', () => {
    expect(periodoDaBuscaAutomatica('2026-02', new Date('2026-10-14'))).toEqual({ de: '2026-02-01', ate: '2026-04-14' });
    expect(periodoDaBuscaAutomatica('2026-10', new Date('2026-10-14'))).toEqual({ de: '2026-10-01', ate: '2026-10-14' });
  });

  it('só os PDFs que falam de liquidação (ou do cliente), sem os de outros meses', () => {
    const r = candidatosDoEmail([
      anexo('TIT LIQUIDADOS SICOOB TV FEV2026.pdf'),
      anexo('TIT LIQUIDADOS SICOOB TV JAN2026.pdf'),
      anexo('nota.pdf', 'segue a nota'),
      anexo('extrato.pdf', '', 'Financeiro <financeiro@cliente.com.br>'),
      anexo('planilha.xlsx', 'títulos liquidados'),
    ], '2026-02', ['financeiro@cliente.com.br']);
    expect(r.map(a => a.nome)).toEqual(['TIT LIQUIDADOS SICOOB TV FEV2026.pdf', 'extrato.pdf']);
  });

  it('Sicoob e Bradesco contam; "títulos pagos" não (é o que a empresa pagou)', () => {
    const r = candidatosDoEmail([anexo('relatorio sicoob fev.pdf'), anexo('Bradesco 02-2026.pdf'), anexo('TITULOS PAGOS EMPRESA FEV2026.pdf')], '2026-02', []);
    expect(r.map(a => a.nome).sort()).toEqual(['Bradesco 02-2026.pdf', 'relatorio sicoob fev.pdf']);
  });

  it('dois relatórios do mês com títulos em comum: cada título uma vez', () => {
    const a = lerCarteiraDeCobranca([PAGINA]);
    const outra = PAGINA.map(l => l.replace('60140000002  NF 101', '60140000009  NF 102'));
    const b = lerCarteiraDeCobranca([PAGINA, outra]);
    const j = juntarSemRepetir([a, b]);
    expect(j.usados).toEqual([1]);
    expect(j.relatorio.grupos.flatMap(g => g.titulos).map(t => t.nf).sort()).toEqual(['NF 101', 'NF 102']);
  });

  it('os bancos do Cadastro: só o formato deles e o que falta', () => {
    const r = lerCarteiraDeCobranca([PAGINA]);
    expect(relatorioServeNoMes(r, '2026-02', 'EXEMPLO CONSTRUCOES MECANICAS', ['sicoob'])).toBe(false);
    expect(relatorioServeNoMes(r, '2026-02', 'EXEMPLO CONSTRUCOES MECANICAS', ['sicoob', 'bradesco'])).toBe(true);
    expect(bancosSemRelatorio([r], ['sicoob', 'bradesco'])).toEqual(['Sicoob']);
    expect(candidatosDoEmail([anexo('liquidados jan.pdf'), anexo('relatorio bradesco.pdf')], '2026-02', [], ['bradesco'])[0].nome).toBe('relatorio bradesco.pdf');
  });

  it('o relatório serve: formato aceito, da empresa e com título no mês', () => {
    const r = lerCarteiraDeCobranca([PAGINA]);
    expect(relatorioServeNoMes(r, '2026-02', 'EXEMPLO CONSTRUCOES MECANICAS LTDA')).toBe(true);
    expect(relatorioServeNoMes(r, '2026-03', 'EXEMPLO CONSTRUCOES MECANICAS LTDA')).toBe(false);
    expect(relatorioServeNoMes(r, '2026-02', 'EMPRESA EXEMPLO INDUSTRIA E COMERCIO LTDA')).toBe(false);
  });
});
