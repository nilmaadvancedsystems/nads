import { describe, expect, it } from 'vitest';
import { empresasDeExemplo } from '../__exemplos__/empresas';
import { alternarOrdem, csvConsulta, FILTRO_CONSULTA_VAZIO, filtrarConsulta, listaConsulta } from './consulta';

const [comercio] = empresasDeExemplo();
const fiscais = listaConsulta(comercio, 'fiscais');

describe('filtrarConsulta', () => {
  it('busca pelo nome (sem diferenciar maiúscula)', () => {
    const l = filtrarConsulta(fiscais, { ...FILTRO_CONSULTA_VAZIO, q: 'transportadora' });
    expect(l.length).toBe(4);
    expect(l.every(n => n.nome.indexOf('TRANSPORTADORA') === 0)).toBe(true);
  });
  it('busca por CFOP e por lançamento', () => {
    expect(filtrarConsulta(fiscais, { ...FILTRO_CONSULTA_VAZIO, q: '5405' }).length).toBe(2);
    expect(filtrarConsulta(fiscais, { ...FILTRO_CONSULTA_VAZIO, q: '00182' }).length).toBe(1);
  });
  it('período de/até (data incompleta é ignorada)', () => {
    const ago = filtrarConsulta(fiscais, { ...FILTRO_CONSULTA_VAZIO, de: '01/08/2026', ate: '31/08/2026' });
    expect(ago.length).toBeGreaterThan(0);
    expect(ago.every(n => n.data.endsWith('/08/2026'))).toBe(true);
    expect(filtrarConsulta(fiscais, { ...FILTRO_CONSULTA_VAZIO, de: '01/08/20' }).length).toBe(fiscais.length);
  });
  it('ordena por valor decrescente', () => {
    const l = filtrarConsulta(fiscais, { ...FILTRO_CONSULTA_VAZIO, sortCol: 'valor', sortDir: 'desc' });
    expect(l[0].valor).toBe(Math.max(...fiscais.map(n => n.valor)));
  });
});

describe('alternarOrdem', () => {
  it('mesma coluna inverte; outra começa crescente', () => {
    const f1 = alternarOrdem(FILTRO_CONSULTA_VAZIO, 'data');
    expect([f1.sortCol, f1.sortDir]).toEqual(['data', 'desc']);
    const f2 = alternarOrdem({ ...f1 }, 'valor');
    expect([f2.sortCol, f2.sortDir]).toEqual(['valor', 'asc']);
  });
});

describe('csvConsulta', () => {
  it('cabeçalho de fiscais e de serviços', () => {
    const f = csvConsulta(fiscais.slice(0, 2), 'fiscais');
    expect(f[0]).toBe('Tipo;Data;Nota;Participante;CFOP;Lançamento;Valor');
    expect(f.length).toBe(3);
    expect(csvConsulta([], 'servicos')).toEqual(['Tipo;Data;Nota;Participante;Valor de ISS;Lançamento;Valor']);
  });
  it('linha com o rótulo do tipo e valor pt-BR', () => {
    const n = fiscais.find(x => x.numero === '4101');
    expect(n).toBeDefined();
    expect(csvConsulta([n!], 'fiscais')[1]).toBe('Entrada;3/07/2026;4101;DISTRIBUIDORA ALFA DE ALIMENTOS LTDA;1102;00006;1.850,40');
  });
});
