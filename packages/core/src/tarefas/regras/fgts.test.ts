import { describe, expect, it } from 'vitest';
import { conferirFgts, guiasDoFgtsDasLinhas, linhasDaGuiaDoFgts, linhasDoAlterdataDoFgts, trabalhadorDoHistorico, type GuiaDoFgts } from './fgts';
import type { RazaoDaConta } from './razao';

// a página do FGTS Digital vem girada: a linha da tabela é o x, as colunas vão pelo y (valores inventados)
const pagina = [
  { texto: 'Número da Guia:', x: 71, y: 12 }, { texto: '0100000000000001-2', x: 71, y: 92 },
  { texto: 'Vencimento da Guia:', x: 57, y: 12 }, { texto: '20/07/2026', x: 57, y: 103 },
  { texto: 'Total da Guia (FGTS):', x: 57, y: 589 }, { texto: '300,00', x: 57, y: 716 },
  // o trabalhador A
  { texto: '06/2026', x: 145, y: 15 }, { texto: 'FULANO DE TAL', x: 145, y: 78 }, { texto: '00010000001', x: 145, y: 190 },
  { texto: '111.222.333-44', x: 145, y: 295 }, { texto: '101', x: 145, y: 360 }, { texto: '20/07/2026', x: 145, y: 375 },
  { texto: 'Mensal', x: 145, y: 410 }, { texto: '2.500,00', x: 145, y: 492 }, { texto: '200,00', x: 145, y: 542 },
  // o trabalhador B (o nome e a matrícula num pedaço só)
  { texto: '06/2026', x: 156, y: 15 }, { texto: 'BELTRANO SOUZA 00010000002', x: 156, y: 78 },
  { texto: '555.666.777-88', x: 156, y: 295 }, { texto: '101', x: 156, y: 360 }, { texto: '20/07/2026', x: 156, y: 375 },
  { texto: 'Mensal', x: 156, y: 410 }, { texto: '1.250,00', x: 156, y: 492 }, { texto: '100,00', x: 156, y: 542 },
];

const razao = (linhas: [string, number, string][], saldoInicial = 0): RazaoDaConta => {
  let saldo = saldoInicial;
  const lancamentos = linhas.map(([data, valor, historico]) => {
    saldo = Math.round((saldo + valor) * 100) / 100;
    return { data, contrapartida: valor > 0 ? '85008' : '10501', nomeContrapartida: valor > 0 ? 'FGTS' : 'Banco', valor, codigoHistorico: '', historico, saldo };
  });
  return { lancamentos, saldoInicial, saldoFinal: saldo, inicio: lancamentos[0].data, fim: lancamentos[lancamentos.length - 1].data };
};

describe('as guias do FGTS Digital', () => {
  it('lê a página girada: o número, o vencimento, o total e cada trabalhador', () => {
    const [g] = guiasDoFgtsDasLinhas(linhasDaGuiaDoFgts([pagina]));
    expect(g).toMatchObject({ numero: '0100000000000001-2', competencia: '2026-06', vencimento: '2026-07-20', total: 300 });
    expect(g.trabalhadores.map(t => [t.nome, t.matricula, t.cpf, t.base, t.valor])).toEqual([
      ['FULANO DE TAL', '00010000001', '111.222.333-44', 2500, 200],
      ['BELTRANO SOUZA', '00010000002', '555.666.777-88', 1250, 100],
    ]);
    // a mesma guia em dois arquivos vira uma
    expect(guiasDoFgtsDasLinhas([...linhasDaGuiaDoFgts([pagina]), ...linhasDaGuiaDoFgts([pagina])])).toHaveLength(1);
  });

  it('o trabalhador no histórico da provisão', () => {
    expect(trabalhadorDoHistorico('Pelo valor de FGTS a recolher s/ folha   <06/2026> FULANO DE TAL')).toBe('FULANO DE TAL');
  });
});

describe('a conferência do FGTS', () => {
  const guia: GuiaDoFgts = { numero: '1', competencia: '2026-06', vencimento: '2026-07-20', emissao: '', total: 300, trabalhadores: [
    { nome: 'FULANO DE TAL', cpf: '1', matricula: '', base: 0, valor: 200 }, { nome: 'BELTRANO SOUZA', cpf: '2', matricula: '', base: 0, valor: 100 }] };

  it('a provisão bate; o pagamento que está só no extrato vira o lançamento sugerido e o saldo fecha', () => {
    const r = razao([
      ['2026-06-30', 200, 'Pelo valor de FGTS a recolher s/ folha <06/2026> FULANO DE TAL'],
      // a competência trocada no histórico
      ['2026-06-30', 100, 'Pelo valor de FGTS a recolher s/ folha <05/2026> BELTRANO SOUZA'],
    ]);
    const c = conferirFgts(r, [guia], ['2026-06', '2026-07'], [{ data: '2026-07-20', valor: -30000, historico: 'PIX EMITIDO', banco: 'Banco X' }]);
    const jun = c.meses[0];
    expect([jun.provisao, jun.diferenca, jun.situacao, jun.pagamento?.onde]).toEqual([300, 0, 'falta', 'extrato']);
    expect(jun.trabalhadores.every(t => t.diferenca === 0)).toBe(true);
    expect(jun.competenciaTrocada).toHaveLength(1);
    // sem pagamento no razão, a contrapartida sugerida é o genérico "Banco" (a pessoa escolhe a conta)
    expect(c.sugestoes.map(s => [s.data, s.debito, s.credito, s.valor, s.historico])).toEqual([
      ['2026-07-20', 'FGTS a recolher', 'Banco', 300, 'Pagamento de FGTS referente 06/2026, conforme GFD quitada.'],
    ]);
    expect([c.saldoDoRazao, c.saldoAjustado, c.saldoEsperado, c.antesDoPeriodo]).toEqual([300, 0, 0, 0]);
    expect(linhasDoAlterdataDoFgts(c.sugestoes, '52002', { [c.sugestoes[0].mes + '|pagamento|' + c.sugestoes[0].historico + '|300']: '10501' }))
      .toEqual([{ data: '20/07/2026', debito: '52002', credito: '10501', historico: 'Pagamento de FGTS referente 06/2026, conforme GFD quitada.', valor: 300 }]);
  });

  it('a guia que vence depois do período fica no saldo; a provisão a menos vira o ajuste do trabalhador', () => {
    const r = razao([['2026-06-30', 150, 'Pelo valor de FGTS a recolher s/ folha <06/2026> FULANO DE TAL'], ['2026-06-30', 100, 'Pelo valor de FGTS a recolher s/ folha <06/2026> BELTRANO SOUZA']]);
    const c = conferirFgts(r, [guia], ['2026-06']);
    expect(c.meses[0].situacao).toBe('depois');
    expect(c.sugestoes.map(s => [s.tipo, s.credito, s.valor])).toEqual([['provisao', 'FGTS a recolher', 50]]);
    expect([c.saldoAjustado, c.saldoEsperado, c.antesDoPeriodo]).toEqual([300, 300, 0]);
  });
});
