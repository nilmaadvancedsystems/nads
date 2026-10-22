import { describe, expect, it } from 'vitest';
import { historicoDaLinha, historicoDaNota, lancamentosFaltando, nomeLancamentosFaltando } from './lancamentosFaltando';
import type { LinhaRazao, NotaAlvo, ResultadoVerificacao } from './verificarConta';

const TXT_B = 'CLIENTE A LTDA 00014 Pelos Serviços Prestados conf. Nota Fiscal nº 000000000000190/000000000000190 -11222333000100 -CLIENTE A LTDA';
const TXT_A = 'CLIENTE B LTDA 00014 Pelos Serviços Prestados conf. Nota Fiscal nº - 000000000000065-04555666000177-CLIENTE B LTDA - ME';

describe('os lançamentos das notas faltando (Vitor, 22/10/2026)', () => {
  it('o código e o texto do histórico da linha do razão', () => {
    expect(historicoDaLinha(TXT_B)).toEqual({ codigo: '00014', texto: 'Pelos Serviços Prestados conf. Nota Fiscal nº 000000000000190/000000000000190 -11222333000100 -CLIENTE A LTDA' });
    expect(historicoDaLinha('AJUSTE SEM HISTÓRICO')).toBeNull();
  });

  it('o texto da nota segue o modelo: a nota com os zeros dele, o documento e o nome trocados', () => {
    const b = historicoDaLinha(TXT_B)!.texto;
    expect(historicoDaNota(b, { numero: '246', doc: '99888777000166', nome: 'CLIENTE C LTDA' }))
      .toBe('Pelos Serviços Prestados conf. Nota Fiscal nº 000000000000246/000000000000246 -99888777000166 -CLIENTE C LTDA');
    const a = historicoDaLinha(TXT_A)!.texto;
    expect(historicoDaNota(a, { numero: '7', doc: '99888777000166', nome: 'CLIENTE C LTDA' }))
      .toBe('Pelos Serviços Prestados conf. Nota Fiscal nº - 000000000000007-99888777000166-CLIENTE C LTDA');
    // sem o padrão de nota, documento e nome: o texto simples
    expect(historicoDaNota('Pelo valor do mês', { numero: '7', doc: '', nome: 'CLIENTE C LTDA' })).toBe('conf. NF nº 7 - CLIENTE C LTDA');
  });

  const linha = (txt: string, contra: string, data: string, valor = 100): LinhaRazao => ({ txt, contra, data, valor, sinal: 1 });
  const nota = (numero: string, nome: string, doc: string, valor: number, tipo: 'Entrada' | 'Saída' = 'Saída'): NotaAlvo =>
    ({ numero, nome, doc, valor, tipo, data: '14/07/2026', comp: '2026-07', cfop: '5102', lanc: '', desc: '' });
  const resultado = (faltando: NotaAlvo[], extra: Partial<ResultadoVerificacao> = {}): ResultadoVerificacao => ({
    faltando, duplicada: [], aMais: [], operacaoIncorreta: [], operacoesDaConta: [], peloValor: [], icms: [],
    somaRazao: 0, somaSemIcms: 0, icmsSub: 0, somaFiscal: 0, serv: null, conta: { codigo: '75001', nome: 'Receita' }, contas: null, fonte: '',
    linhas: [linha(TXT_A, '63080', '05/05/2026'), linha(TXT_B, '98228', '31/08/2026')], ...extra,
  });

  it('a contrapartida é a conta do participante no razão (pelo CNPJ, senão pelo nome); sem ela, a nota fica de fora', () => {
    const r = lancamentosFaltando(resultado([
      nota('246', 'CLIENTE B LTDA', '04.555.666/0001-77', 800),
      nota('247', 'CLIENTE A', '', 1300),
      nota('248', 'CLIENTE NOVO LTDA', '33444555000166', 50),
    ]));
    expect(r.lancamentos).toEqual([
      {
        automatico: '', data: '14/07/2026', debito: '63080', credito: '75001', valor: 800, codHistorico: '00014', documento: '246',
        historico: 'Pelos Serviços Prestados conf. Nota Fiscal nº 000000000000246/000000000000246 -04555666000177 -CLIENTE B LTDA',
      },
      // a nota sem CNPJ: o do participante no razão
      expect.objectContaining({ debito: '98228', credito: '75001', valor: 1300, documento: '247', historico: 'Pelos Serviços Prestados conf. Nota Fiscal nº 000000000000247/000000000000247 -11222333000100 -CLIENTE A' }),
    ]);
    expect(r.semConta.map(n => n.numero)).toEqual(['248']);
  });

  it('nota de entrada: a conta é debitada e o participante creditado; a coluna conta do relatório vale antes', () => {
    const n = { ...nota('9', 'CLIENTE B LTDA', '04555666000177', 10, 'Entrada'), conta: '21101' };
    expect(lancamentosFaltando(resultado([n])).lancamentos[0]).toMatchObject({ debito: '75001', credito: '21101' });
  });

  it('várias contas juntas: não exporta', () => {
    const r = lancamentosFaltando(resultado([nota('246', 'CLIENTE B LTDA', '', 800)], { contas: [{ codigo: '1', nome: 'a' }, { codigo: '2', nome: 'b' }] }));
    expect(r).toEqual({ lancamentos: [], semConta: [] });
  });

  it('o nome do arquivo', () => {
    expect(nomeLancamentosFaltando('Empresa Teste', '75001')).toBe('lancamentos-faltando-empresa-teste-75001.xls');
  });
});
