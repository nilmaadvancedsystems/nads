import { describe, expect, it } from 'vitest';
import { grupoDoControle, htmlDoControle, linhaEmBranco, numeroDoControle, preencherComSugestao, situacaoDaLinha, sugestoesDoEntregas, valorDoControle } from './controleDeTributos';

const logo = { definicao: '<svg id="def"></svg>', uso: '<svg><use href="#x"/></svg>' };

describe('o controle de tributos do Fiscal (27/10/2026)', () => {
  it('o valor como fica na tela', () => {
    expect(valorDoControle('1234,5')).toBe('1.234,50');
    expect(valorDoControle('2.595,81')).toBe('2.595,81');
    expect(valorDoControle('49.63')).toBe('49,63');
    expect(valorDoControle('R$ 10')).toBe('10,00');
    expect(valorDoControle('-')).toBe('—');
    expect(valorDoControle('Ø')).toBe('0');
    expect(valorDoControle(' ver obs ')).toBe('ver obs');
    expect(valorDoControle('')).toBe('');
  });

  it('o número para os totais', () => {
    expect(numeroDoControle('1.234,50')).toBe(1234.5);
    expect(numeroDoControle('—')).toBe(0);
    expect(numeroDoControle('ver obs')).toBe(0);
  });

  it('as sugestões do Entregas vão só nos campos em branco', () => {
    const sn = grupoDoControle('sn');
    const s = sugestoesDoEntregas(sn, [{ codigo: 7, nome: 'A' }, { codigo: 8, nome: 'B' }], [
      { codigo: 7, itens: [{ tipo: 'DAS', valor: 100 }, { tipo: 'ICMS ST', valor: 20.5 }], em: '2026-09-15T10:00:00Z', porEmail: true },
    ]);
    expect(s.get(7)).toEqual({ valores: { das: '100,00', 'st-ent': '20,50' }, data: '2026-09-15', email: true });
    expect(s.has(8)).toBe(false);
    const escrita = { ...linhaEmBranco('2026-09', 7, 'sn'), valores: { das: '99,00' } };
    const junta = preencherComSugestao(escrita, s.get(7));
    expect(junta.valores).toEqual({ das: '99,00', 'st-ent': '20,50' });
    expect(junta.data).toBe('2026-09-15');
    expect(junta.entregue).toBe('email');
  });

  it('a situação da linha', () => {
    const b = linhaEmBranco('2026-09', 1, 'lp');
    expect(situacaoDaLinha(undefined)).toBe('branco');
    expect(situacaoDaLinha(b)).toBe('branco');
    expect(situacaoDaLinha({ ...b, marcas: { dctf: 'ok' } })).toBe('comecada');
    expect(situacaoDaLinha({ ...b, entregue: 'zap' })).toBe('entregue');
  });

  it('a folha impressa: as colunas do grupo, as conferências, a observação e a retificação', () => {
    const lp = grupoDoControle('lp');
    const linha = { ...linhaEmBranco('2026-08', 12, 'lp'), valores: { pis: '10,00' }, data: '2026-09-02', marcas: { dctf: 'ok' as const, spc: 'na' as const }, entregue: 'zap' as const };
    const html = htmlDoControle({ competencia: '2026-08', grupo: lp, empresas: [{ codigo: 12, nome: 'X & Y LTDA' }], linhas: new Map([[12, linha]]), logo,
      folha: { observacoes: ['Cliente pediu boleto'], retificacoes: [{ codigo: 12, referencia: '07/2026', valores: { cofins: '5,00' }, marcas: {}, entregue: 'email' }] } });
    expect(html).toContain('LUCRO PRESUMIDO');
    expect(html).toContain('Ref: 08/2026');
    expect(html).toContain('X &amp; Y LTDA');
    expect(html).toContain('<th class="mk">DAPI</th>');
    expect(html).toContain('02/09/26');
    expect(html).toContain('>OK<');
    expect(html).toContain('>zap<');
    expect(html).toContain('Cliente pediu boleto');
    expect(html).toContain('07/2026');
  });
});
