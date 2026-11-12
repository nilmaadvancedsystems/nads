import { describe, expect, it } from 'vitest';
import { conferirInsumo, porCliente, porPessoa, quantidadeDigitada, totaisDosInsumos, type Insumo } from './insumos';

const i = (uid: string, tipo: Insumo['tipo'], quantidade: number, cliente: string, codigo: number | null): Insumo => ({
  id: uid + tipo + quantidade, uid, nome: uid.toUpperCase(), competencia: '2026-11', data: '2026-11-10', tipo, quantidade, cliente, codigo, criadoEm: '',
});

describe('os Insumos da Carteira (12/11/2026)', () => {
  it('o cliente é obrigatório e a quantidade é inteira', () => {
    expect(conferirInsumo({ data: '2026-11-10', tipo: 'pasta', quantidade: 2, cliente: 'EMPRESA EXEMPLO', codigo: 1 })).toEqual([]);
    expect(conferirInsumo({ data: '2026-11-10', tipo: 'pasta', quantidade: 2, cliente: ' ', codigo: null })).toContain('Escolha o cliente.');
    expect(conferirInsumo({ data: '2026-11-10', tipo: 'pasta', quantidade: 1.5, cliente: 'X', codigo: null })).toHaveLength(1);
    expect(conferirInsumo({ data: '', tipo: 'pasta', quantidade: 0, cliente: 'X', codigo: null })).toHaveLength(2);
  });

  it('a quantidade digitada', () => {
    expect(quantidadeDigitada('1.200')).toBe(1200);
    expect(quantidadeDigitada(' 15 ')).toBe(15);
    expect(quantidadeDigitada('2,5')).toBeNaN();
  });

  it('somados por tipo, por pessoa e por cliente', () => {
    const l = [i('ana', 'impressao', 30, 'EMPRESA A', 10), i('ana', 'pasta', 2, 'EMPRESA A', 10), i('bia', 'impressao', 5, 'EMPRESA B', null), i('bia', 'caixa', 1, 'Empresa B', null)];
    expect(totaisDosInsumos(l)).toEqual({ impressao: 35, pasta: 2, envelope: 0, caixa: 1 });
    expect(porPessoa(l).map(p => [p.nome, p.totais.impressao, p.quantos])).toEqual([['ANA', 30, 2], ['BIA', 5, 2]]);
    const c = porCliente(l);
    expect(c).toHaveLength(2);
    expect(c.find(x => x.codigo === 10)?.totais.pasta).toBe(2);
    expect(c.find(x => x.codigo == null)?.totais).toEqual({ impressao: 5, pasta: 0, envelope: 0, caixa: 1 });
  });
});
