import { describe, expect, it } from 'vitest';
import { competenciasDoAno, htmlDoProtocoloDaReinf, htmlDoProtocoloDeExtratos, linhasDoProtocoloDaReinf, linhasDoProtocoloDeExtratos } from './protocolosDoAno';

const logo = { definicao: '<svg id="def"></svg>', uso: '<svg><use href="#x"/></svg>' };

describe('o protocolo de extratos do ano (Heverton, 22/10/2026)', () => {
  it('OK quando o extrato chegou, S/M sem movimento, "-" para quem não manda extrato até a competência de trabalho', () => {
    const linhas = linhasDoProtocoloDeExtratos({
      ano: 2026, ate: '2026-09', preencher: true, semExtrato: new Set([277]),
      empresas: [{ codigo: 277, nome: 'G.A.S' }, { codigo: 10, nome: 'DORNAS' }],
      documentos: [
        { codigo: 10, competencia: '2026-01', extrato: true, semMovimento: false },
        { codigo: 10, competencia: '2026-02', extrato: false, semMovimento: true },
        { codigo: 10, competencia: '2025-12', extrato: true, semMovimento: false },
      ],
    });
    expect(linhas.map(l => l.codigo)).toEqual([10, 277]);
    expect(linhas[0].meses).toEqual(['OK', 'S/M', '', '', '', '', '', '', '', '', '', '']);
    expect(linhas[1].meses.slice(7, 11)).toEqual(['-', '-', '', '']);
  });
  it('desligado, tudo em branco', () => {
    const [l] = linhasDoProtocoloDeExtratos({ ano: 2026, ate: '2026-09', preencher: false, semExtrato: new Set([1]), empresas: [{ codigo: 1, nome: 'X' }],
      documentos: [{ codigo: 1, competencia: '2026-01', extrato: true, semMovimento: false }] });
    expect(l.meses.every(m => m === '')).toBe(true);
  });
  it('o HTML: em pé, o título com o ano, os meses e o código com zeros', () => {
    const h = htmlDoProtocoloDeExtratos({ ano: 2026, logo, linhas: [{ codigo: 10, nome: 'A & B', meses: ['OK', ...Array(11).fill('')] }] });
    expect(h).toContain('Protocolo de Extratos 2026');
    expect(h).not.toContain('landscape');
    expect(h).toContain('>DEZ<');
    expect(h).toContain('>00010<');
    expect(h).toContain('A &amp; B');
    expect(h.match(/id="def"/g)?.length).toBe(1);
  });
});

describe('o protocolo da REINF do ano (Heverton, 22/10/2026)', () => {
  const base = { codigo: 0, nome: '', noFiscal: true, noDp: true, doDp: {} };
  it('E pelo Fiscal (o "transmitido até" ou a marca do Fiscal no DP), P pelo DP, "-" para o lado sem REINF', () => {
    const [a, b] = linhasDoProtocoloDaReinf({ ano: 2026, ate: '2026-09', preencher: true, empresas: [
      { ...base, codigo: 49, nome: 'POSTO', noFiscal: false, doDp: { '2026-01': 'dp', '2026-03': 'fiscal' } },
      { ...base, codigo: 237, nome: 'BERIZAL', noDp: false, transmitidoAte: '2026-02' },
    ] });
    expect(a.meses.slice(0, 3)).toEqual([['-', 'P'], ['-', ''], ['E', '']]);
    expect(a.meses[10]).toEqual(['', '']);
    expect(b.meses.slice(0, 3)).toEqual([['E', '-'], ['E', '-'], ['', '-']]);
    expect(b.meses[9]).toEqual(['', '']);
  });
  it('o HTML: deitado, duas casas por mês', () => {
    const [l] = linhasDoProtocoloDaReinf({ ano: 2026, ate: '2026-09', preencher: false, empresas: [{ ...base, codigo: 605, nome: 'LL' }] });
    const h = htmlDoProtocoloDaReinf({ ano: 2026, logo, linhas: [l] });
    expect(h).toContain('size:A4 landscape');
    expect(h).toContain('Protocolo REINF 2026');
    expect(h.match(/>FISCAL</g)?.length).toBe(12);
    expect(h.match(/<td class="dp">/g)?.length).toBe(12);
  });
  it('as competências do ano', () => {
    expect(competenciasDoAno(2026)[0]).toBe('2026-01');
    expect(competenciasDoAno(2026)[11]).toBe('2026-12');
  });
});
