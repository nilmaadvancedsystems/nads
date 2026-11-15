import { describe, expect, it } from 'vitest';
import {
  comPreco, conferirInsumo, conferirTipos, idDoInsumo, INSUMOS_PADRAO, quantidadeDigitada, rotuloDoInsumo, totaisDosInsumos, valorDoInsumo,
  type Insumo, type TipoConfigurado,
} from './insumos';

// a lista do Financeiro (15/11/2026: "o preço do insumo é o financeiro que decide, e quais insumos são")
const tipos: TipoConfigurado[] = [
  { id: 'impressao', nome: 'Impressão', preco: 0.5 },
  { id: 'envelope', nome: 'Envelope', preco: 2 },
  { id: 'caixa', nome: 'Caixa', preco: 8.9 },
  { id: 'pasta-de-couro', nome: 'Pasta de couro', preco: 35 },
];

describe('insumos', () => {
  it('confere o registro: o insumo tem de estar na lista do Financeiro; o cliente avulso vale', () => {
    expect(conferirInsumo({ data: '2026-11-10', tipo: 'envelope', quantidade: 2, cliente: 'EMPRESA EXEMPLO', codigo: 1 }, tipos)).toEqual([]);
    expect(conferirInsumo({ data: '2026-11-10', tipo: 'caixa', quantidade: 1, cliente: 'CLIENTE AVULSO', codigo: null }, tipos)).toEqual([]);
    expect(conferirInsumo({ data: '2026-11-10', tipo: 'envelope', quantidade: 2, cliente: ' ', codigo: null }, tipos)).toContain('Escolha o cliente.');
    expect(conferirInsumo({ data: '2026-11-10', tipo: 'envelope', quantidade: 1.5, cliente: 'X', codigo: null }, tipos)).toHaveLength(1);
    expect(conferirInsumo({ data: '', tipo: 'envelope', quantidade: 0, cliente: 'X', codigo: null }, tipos)).toHaveLength(2);
    // fora da lista (a pasta antiga, ou um que o Financeiro tirou) não se registra
    expect(conferirInsumo({ data: '2026-11-10', tipo: 'pasta', quantidade: 2, cliente: 'X', codigo: null }, tipos)).toEqual(['Escolha o insumo.']);
    // sem a lista do Financeiro, valem Impressão, Envelope e Caixa
    expect(INSUMOS_PADRAO.map(t => t.id)).toEqual(['impressao', 'envelope', 'caixa']);
    expect(conferirInsumo({ data: '2026-11-10', tipo: 'pasta-de-couro', quantidade: 1, cliente: 'X', codigo: null })).toEqual(['Escolha o insumo.']);
  });

  it('o registro guarda o nome e o preço do dia; o valor é a quantidade × o preço', () => {
    const x = comPreco({ data: '2026-11-10', tipo: 'caixa', quantidade: 3, cliente: 'X', codigo: null }, tipos);
    expect(x).toMatchObject({ nomeDoTipo: 'Caixa', preco: 8.9 });
    expect(valorDoInsumo(x)).toBe(26.7);
    expect(valorDoInsumo({ quantidade: 3, preco: 0 })).toBe(0);
  });

  it('o nome: o guardado, senão o da lista, senão o dos ids de antes', () => {
    expect(rotuloDoInsumo({ tipo: 'caixa', nomeDoTipo: 'Caixa grande' }, tipos)).toBe('Caixa grande');
    expect(rotuloDoInsumo({ tipo: 'pasta-de-couro', nomeDoTipo: '' }, tipos)).toBe('Pasta de couro');
    expect(rotuloDoInsumo({ tipo: 'pasta', nomeDoTipo: '' }, tipos)).toBe('Pasta');
  });

  it('a lista do Financeiro: nome, sem repetir, preço de 0 a 100.000', () => {
    expect(conferirTipos(tipos)).toEqual([]);
    expect(conferirTipos([])).toContain('Deixe pelo menos um insumo.');
    expect(conferirTipos([{ id: 'a', nome: '  ', preco: 1 }])).toContain('Dê um nome a cada insumo.');
    expect(conferirTipos([{ id: 'a', nome: 'Caixa', preco: 1 }, { id: 'b', nome: 'caixa', preco: 2 }])).toContain('Há dois insumos com o mesmo nome.');
    expect(conferirTipos([{ id: 'a', nome: 'Caixa', preco: -1 }])).toHaveLength(1);
    expect(idDoInsumo('Pasta de Couro', [])).toBe('pasta-de-couro');
    expect(idDoInsumo('Caixa', ['caixa'])).toBe('caixa-2');
  });

  it('lê a quantidade digitada', () => {
    expect(quantidadeDigitada('1.200')).toBe(1200);
    expect(quantidadeDigitada(' 15 ')).toBe(15);
    expect(quantidadeDigitada('1,5')).toBeNaN();
  });

  it('totais por insumo, na ordem da lista, com o valor; a pasta antiga entra no fim', () => {
    const i = (tipo: string, quantidade: number, preco: number, nomeDoTipo = ''): Insumo => ({
      id: tipo + quantidade, uid: 'u', nome: 'Ana', competencia: '2026-11', data: '2026-11-10', tipo, nomeDoTipo, preco, quantidade, cliente: 'X', codigo: null, criadoEm: '',
    });
    const t = totaisDosInsumos([i('impressao', 30, 0.5), i('impressao', 10, 0.5), i('caixa', 2, 8.9), i('pasta', 4, 0)], tipos);
    expect(t.porInsumo.map(x => [x.nome, x.quantidade, x.valor])).toEqual([
      ['Impressão', 40, 20], ['Envelope', 0, 0], ['Caixa', 2, 17.8], ['Pasta de couro', 0, 0], ['Pasta', 4, 0],
    ]);
    expect(t.valor).toBe(37.8);
  });
});
