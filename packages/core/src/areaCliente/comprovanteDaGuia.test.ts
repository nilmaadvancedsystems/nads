// "Já paguei: mandar o comprovante" (plano do Acessórias, 17/11/2026, ficha comprovante-da-guia, parte A).
import { describe, expect, it } from 'vitest';
import { comprovanteDaGuia, guiaDoComprovante, MAIOR_NOME_DO_ENVIO, rotuloDoComprovante, nomeComPrefixo, prefixoDoComprovante } from './comprovanteDaGuia';
import type { ReciboDeEnvio } from './envios';

describe('o comprovante da guia', () => {
  it('o prefixo de cada tipo, com a sigla crua', () => {
    expect(prefixoDoComprovante({ tipo: 'FGTS', competencia: '2026-10' })).toBe('Comprovante FGTS 10-2026 - ');
    expect(prefixoDoComprovante({ tipo: 'DAS', competencia: '2026-09' })).toBe('Comprovante DAS 09-2026 - ');
    expect(prefixoDoComprovante({ tipo: 'DAE', competencia: '2026-01' })).toBe('Comprovante DAE 01-2026 - ');
    expect(prefixoDoComprovante({ tipo: 'outra', competencia: '2026-12' })).toBe('Comprovante Guia 12-2026 - ');
  });
  it('o nome com o prefixo cabe em 200 caracteres e mantém a extensão', () => {
    expect(nomeComPrefixo('Comprovante FGTS 10-2026 - ', 'pix.pdf')).toBe('Comprovante FGTS 10-2026 - pix.pdf');
    const longo = nomeComPrefixo('Comprovante FGTS 10-2026 - ', 'x'.repeat(300) + '.jpeg');
    expect(longo.length).toBe(MAIOR_NOME_DO_ENVIO);
    expect(longo.endsWith('.jpeg')).toBe(true);
    expect(longo.startsWith('Comprovante FGTS 10-2026 - ')).toBe(true);
    expect(nomeComPrefixo('P - ', 'sem extensao')).toBe('P - sem extensao');
  });
  it('acha o comprovante mais novo da guia e ignora outro mês e outro tipo', () => {
    const r = (id: string, nome: string, tipo: ReciboDeEnvio['tipo'], recebidoEm: string): ReciboDeEnvio => ({ id, nome, tipo, tamanho: 10, recebidoEm });
    const envios = [
      r('1', 'Comprovante FGTS 10-2026 - a.pdf', 'comprovante', '2026-11-10T10:00:00Z'),
      r('2', 'Comprovante FGTS 10-2026 - b.pdf', 'comprovante', '2026-11-12T10:00:00Z'),
      r('3', 'Comprovante FGTS 09-2026 - c.pdf', 'comprovante', '2026-11-15T10:00:00Z'),
      r('4', 'Comprovante FGTS 10-2026 - d.pdf', 'extrato', '2026-11-16T10:00:00Z'),
    ];
    expect(comprovanteDaGuia({ tipo: 'FGTS', competencia: '2026-10' }, envios)?.id).toBe('2');
    expect(comprovanteDaGuia({ tipo: 'DAS', competencia: '2026-10' }, envios)).toBeNull();
  });
});

// a parte B: o robô liga o comprovante à guia (18/11/2026, ficha comprovante-da-guia)
describe('a guia do comprovante (o inverso do prefixo)', () => {
  it('volta à guia de cada prefixo, inclusive o nome cortado em 200', () => {
    const guias = [
      { tipo: 'FGTS', competencia: '2026-10' }, { tipo: 'DAS', competencia: '2026-09' }, { tipo: 'outra', competencia: '2026-12' },
      { tipo: 'DARF', competencia: '2026-10', tributo: 'INSS' }, { tipo: 'DARF', competencia: '2026-10', tributo: 'PIS/COFINS' },
    ] as const;
    for (const g of guias) expect(guiaDoComprovante(nomeComPrefixo(prefixoDoComprovante(g), 'x'.repeat(300) + '.pdf'))).toEqual(g);
  });
  it('sem o prefixo, nada; mês torto ou texto no meio de guia sem tributo, nada', () => {
    expect(guiaDoComprovante('comprovante-das-setembro.jpg')).toBeNull();
    expect(guiaDoComprovante('Comprovante FGTS 13-2026 - a.pdf')).toBeNull();
    expect(guiaDoComprovante('Comprovante FGTS loja 10-2026 - a.pdf')).toBeNull();
    expect(guiaDoComprovante('')).toBeNull();
  });
  it('o rótulo para a equipe', () => {
    expect(rotuloDoComprovante({ tipo: 'FGTS', competencia: '2026-10' })).toBe('Comprovante do FGTS 10/2026');
    expect(rotuloDoComprovante({ tipo: 'DARF', competencia: '2026-10', tributo: 'INSS' })).toBe('Comprovante da DARF INSS 10/2026');
    expect(rotuloDoComprovante({ tipo: 'outra', competencia: '2026-12' })).toBe('Comprovante da guia 12/2026');
  });
});
