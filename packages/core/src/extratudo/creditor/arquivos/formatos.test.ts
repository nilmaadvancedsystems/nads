import { describe, expect, it } from 'vitest';
import type { AnexoDoEmail } from '../drive';
import { candidatosDoEmail, periodoDaBuscaAutomatica, relatorioServeNoMes } from '../regras/automatico';
import { cedenteDosTitulosPorPeriodo, formatoDoRelatorio, lerCarteiraDeCobranca, relatorioDaEmpresa } from './formatos';

// as linhas como o pdf.js monta (linhasDosItens) do "Extrato de Movimentação da Carteira de Cobrança"
const PAGINA = [
  'Extrato de Movimentação da Carteira de Cobrança',
  'Ultim/Movim  Emissão  Folhas',
  '13/02/2026  02/03/2026  5',
  'Nosso Número  Seu Número  Nome do Pagador  Vencimento  Data Pagto  Valor do Título  Oscilação/Despesa  Valor Cobrado  CL',
  '60140000002  NF 714  MINERACAO GRANDUVALE  13/02/2026  13/02/2026  600,00  0,00  612,50  2',
  'LTDA',
  '0  TIT.  R$ 0,00  CODLANC.  0',
  'Saldo Anterior  Total de Entradas  Total das Baixas  Saldo Atual  CRÉDITO EM:  26/02/2026  319,50',
  'Agência  Razão  C/Creditada  Conta/Contrato',
  '2557 / TAIOBEIRAS  7 / 5  8939 - 7  25570008939',
  'VOLPONI CONSTRUCOES MECANICAS',
];

describe('os formatos do Creditor', () => {
  it('só os dois formatos', () => {
    expect(formatoDoRelatorio(PAGINA)).toBe('carteira-de-cobranca');
    expect(formatoDoRelatorio(['Relatório - Títulos por Período', 'Cedente:  232904 - TORNEARIA VOLPONI LTDA', 'Sacado  Nosso Número'])).toBe('titulos-por-periodo');
    expect(formatoDoRelatorio(['COMPROVANTE DE', 'PAGAMENTO DE BOLETO', 'Pagador:'])).toBeNull();
    expect(formatoDoRelatorio(['EXTRATO DE CONTA CORRENTE', 'CRÉD.LIQUIDAÇÃO COBRANÇA'])).toBeNull();
  });

  it('lê a carteira de cobrança: o título, o nome em duas linhas, a mora e o cedente', () => {
    const r = lerCarteiraDeCobranca([PAGINA, PAGINA]);
    expect(r.cedente).toBe('VOLPONI CONSTRUCOES MECANICAS');
    const ts = r.grupos.flatMap(g => g.titulos);
    expect(ts).toHaveLength(1);
    expect(ts[0]).toMatchObject({ nossoNumero: '60140000002', nf: 'NF 714', sacado: 'MINERACAO GRANDUVALE LTDA', valor: 600, mora: 12.5, desconto: 0, liquidacao: '13/02/2026', cobrado: 612.5 });
  });

  it('o cedente decide de qual empresa é', () => {
    expect(cedenteDosTitulosPorPeriodo(['Cedente:  232904 - TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA'])).toBe('TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA');
    expect(relatorioDaEmpresa('TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA', 'TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA')).toBe(true);
    expect(relatorioDaEmpresa('VOLPONI CONSTRUCOES MECANICAS', 'TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA')).toBe(false);
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
      anexo('extrato.pdf', '', 'Financeiro <fin@volponi.com.br>'),
      anexo('planilha.xlsx', 'títulos liquidados'),
    ], '2026-02', ['fin@volponi.com.br']);
    expect(r.map(a => a.nome)).toEqual(['TIT LIQUIDADOS SICOOB TV FEV2026.pdf', 'extrato.pdf']);
  });

  it('o relatório serve: formato aceito, da empresa e com título no mês', () => {
    const r = lerCarteiraDeCobranca([PAGINA]);
    expect(relatorioServeNoMes(r, '2026-02', 'VOLPONI CONSTRUCOES MECANICAS LTDA')).toBe(true);
    expect(relatorioServeNoMes(r, '2026-03', 'VOLPONI CONSTRUCOES MECANICAS LTDA')).toBe(false);
    expect(relatorioServeNoMes(r, '2026-02', 'TORNEARIA VOLPONI INDUSTRIA E COMERCIO LTDA')).toBe(false);
  });
});
