import { describe, expect, it } from 'vitest';
import { mesDoAnexo, mesesCitados, separarPeloMes } from './mesDoEmail';

const a = (nome: string, assunto = '', trecho = '') => ({ nome, assunto, trecho });

describe('o mês de que o e-mail fala', () => {
  it('acha o mês pelo nome, abreviado com o ano e pelos números', () => {
    expect([...mesesCitados('BOLETOS PAGOS DEZ2025', '2026')]).toEqual(['2025-12']);
    expect([...mesesCitados('Extrato janeiro de 2026', '2026')]).toEqual(['2026-01']);
    expect([...mesesCitados('relatorio 01/2026', '2026')]).toEqual(['2026-01']);
    expect([...mesesCitados('liquidacao 2026-01', '2026')]).toEqual(['2026-01']);
    expect([...mesesCitados('extrato 012026', '2026')]).toEqual(['2026-01']);
    expect([...mesesCitados('Jan/26', '2026')]).toEqual(['2026-01']);
    expect([...mesesCitados('EXTRATO JAN', '2026')]).toEqual(['2026-01']);
  });
  it('no corpo, "mar", "set", "out" soltos não são mês', () => {
    expect(mesesCitados('segue o extrato, saiu o pagamento', '2026', false).size).toBe(0);
    expect([...mesesCitados('referente a set/2026', '2026', false)]).toEqual(['2026-09']);
  });
  it('o anexo de janeiro em cima; dezembro e fevereiro à parte; o que não cita mês no meio', () => {
    const lista = [
      a('BOLETOS PAGOS DEZ2025.pdf', 'COMPROVANTES PAGTOS TÍTULOS DA VOLPONI REF DEZ'),
      a('Relatorio.pdf', 'Liquidação janeiro/2026'),
      a('extrato FEV2026.pdf'),
      a('arquivo.pdf', 'segue', 'conforme combinado'),
    ];
    expect(mesDoAnexo(lista[0], '2026-01')).toBe('outro');
    const r = separarPeloMes(lista, '2026-01');
    expect(r.doMes.map(x => x.nome)).toEqual(['Relatorio.pdf']);
    expect(r.semMes.map(x => x.nome)).toEqual(['arquivo.pdf']);
    expect(r.outros.map(x => x.nome)).toEqual(['BOLETOS PAGOS DEZ2025.pdf', 'extrato FEV2026.pdf']);
  });
});
