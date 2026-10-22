import { describe, expect, it } from 'vitest';
import { grupoDoProtocolo, htmlDoProtocolo, linhasDoProtocolo } from './protocoloDeTributos';
import { htmlDosEnvelopes, paginasDosEnvelopes, regimeAbreviado, tipoNaEtiqueta } from './etiquetasDoEnvelope';

const logo = { definicao: '<svg id="def"></svg>', uso: '<svg><use href="#x"/></svg>' };

describe('as etiquetas do envelope (Heverton, 20/10/2026)', () => {
  it('a sigla do regime e as páginas', () => {
    expect(['Simples', 'MEI', 'Presumido', 'Real', 'Física', 'Isentas', 'Domésticas', '', 'Outro'].map(regimeAbreviado)).toEqual(['SN', 'MEI', 'LP', 'LR', 'PF', 'ISENTA', 'DOM', '', 'OUTRO']);
    expect(paginasDosEnvelopes(5, 2)).toBe(3);
    expect(paginasDosEnvelopes(4, 4)).toBe(1);
  });
  it('o tipo na caixa: PJ-F (pessoa jurídica, Fiscal), PF para Física e Domésticas, a letra do departamento', () => {
    expect(tipoNaEtiqueta('Presumido', 'Fiscal')).toBe('PJ-F');
    expect(tipoNaEtiqueta('Simples', 'Contábil')).toBe('PJ-C');
    expect(tipoNaEtiqueta('Física', 'Pessoal')).toBe('PF-P');
    expect(tipoNaEtiqueta('Domésticas', 'Fiscal')).toBe('PF-F');
    expect(tipoNaEtiqueta(null, 'Fiscal')).toBe('PJ-F');
  });
  it('uma por página: a folha deitada, a etiqueta na folha inteira; duas: em pé', () => {
    const um = htmlDosEnvelopes({ competencia: '2026-09', departamento: 'Fiscal', porPagina: 1, logo, etiquetas: [{ codigo: 462, nome: 'X', caixa: 'LP' }] });
    expect(um).toContain('size:A4 landscape');
    expect(um).toContain('height:194mm');
    const dois = htmlDosEnvelopes({ competencia: '2026-09', departamento: 'Fiscal', porPagina: 2, logo, etiquetas: [{ codigo: 462, nome: 'X', caixa: 'LP' }] });
    expect(dois).not.toContain('landscape');
  });
  it('o HTML: a logo uma vez só, o movimento, o código, o nome, a caixa e o departamento', () => {
    const h = htmlDosEnvelopes({ competencia: '2026-09', departamento: 'Fiscal', porPagina: 2, logo,
      etiquetas: [{ codigo: 302, nome: 'TEOBALDO MENDES DE OLIVEIRA', caixa: 'PF' }, { codigo: 1, nome: 'A & B', caixa: '' }, { codigo: 2, nome: 'C', caixa: 'SN' }] });
    expect(h.match(/id="def"/g)?.length).toBe(1);
    expect(h).toContain('MOVIMENTO 09/2026');
    expect(h).toContain('>302<');
    expect(h).toContain('A &amp; B');
    expect(h).toContain('DEPARTAMENTO FISCAL');
    expect(h.match(/<section class="pagina p2">/g)?.length).toBe(2);
  });
});

describe('o protocolo de entrega de tributos (Heverton, 20/10/2026)', () => {
  it('preenche o valor por coluna, a data da última entrega e o e-mail', () => {
    const sn = grupoDoProtocolo('sn');
    const linhas = linhasDoProtocolo(sn, [{ codigo: 51, nome: 'ROSILENE' }, { codigo: 10, nome: 'DORNAS' }], [
      { codigo: 51, itens: [{ tipo: 'DAS', valor: 2260.45 }, { tipo: 'ICMS Antec.', valor: 247.35 }, { tipo: 'ICMS ST', valor: 545.63 }, { tipo: 'Honorário', valor: null }], em: '2026-09-18T19:57:10.607Z', porEmail: true },
      { codigo: 51, itens: [{ tipo: 'PARCSN', valor: null }], em: '2026-09-20T10:00:00.000Z', porEmail: false },
    ], true);
    expect(linhas.map(l => l.codigo)).toEqual([10, 51]);
    expect(linhas[1]).toMatchObject({ data: '20/09', email: 'Sim', valores: { das: '2.260,45', 'icms-ant': '247,35', 'st-ent': '545,63', parc: '✓' } });
    expect(linhas[0]).toMatchObject({ data: '', email: '', valores: {} });
    expect(linhasDoProtocolo(sn, [{ codigo: 51, nome: 'X' }], [{ codigo: 51, itens: [{ tipo: 'DAS', valor: 1 }], em: null, porEmail: true }], false)[0].valores).toEqual({});
  });
  it('o HTML: o selo, a referência, as colunas e o código com zeros', () => {
    const h = htmlDoProtocolo({ competencia: '2026-06', grupo: grupoDoProtocolo('sn'), linhas: [{ codigo: 51, nome: 'ROSILENE', valores: {}, data: '', email: '' }], logo });
    expect(h).toContain('SIMPLES NACIONAL');
    expect(h).toContain('Ref: 06/2026');
    expect(h).toContain('ICMS DIF. ALIQ ATIVO');
    expect(h).toContain('>00051<');
    expect(h).toContain('size:A4 landscape');
  });
});
