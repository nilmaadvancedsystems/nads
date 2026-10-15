import { describe, expect, it } from 'vitest';
import type { Nota } from '../../conferencia/tipos';
import type { NotaDoSieg } from '../sieg';
import { chaveDaNota, conferirComAlterdata, conferirComSieg, documentoValido, lerSintegra, resumirSintegra } from './index';

// monta uma linha de 126 posições a partir dos campos (texto à esquerda com espaços; número à direita com zeros)
const t = (s: string, n: number) => s.slice(0, n).padEnd(n, ' ');
const z = (v: number | string, n: number) => String(v).padStart(n, '0');
const v = (reais: number, n = 13) => z(Math.round(reais * 100), n);

const EMPRESA = '27872981000113';
const FORNECEDOR = '11222333000181';
const CLIENTE = '45997418000153';

const r10 = () => '10' + EMPRESA + t('0012345670012', 14) + t('NILMA CONTABILIDADE LTDA', 35) + t('TAIOBEIRAS', 30) + 'MG' + z(0, 10) + '20260901' + '20260930' + '3' + '3' + '1';
const r11 = () => '11' + t('RUA A', 34) + z(10, 5) + t('', 22) + t('CENTRO', 15) + z(39550000, 8) + t('NILMA', 28) + z(3838451234, 12);
const r50 = (o: { cnpj: string; data: string; modelo?: string; serie?: string; numero: number; cfop: string; emit: 'P' | 'T'; valor: number; base?: number; icms?: number; aliq?: number; sit?: string }) =>
  '50' + o.cnpj + t('ISENTO', 14) + o.data + 'MG' + (o.modelo || '55') + t(o.serie || '1', 3) + z(o.numero, 6) + o.cfop + o.emit
  + v(o.valor) + v(o.base ?? o.valor) + v(o.icms ?? 0) + v(0) + v(0) + z(Math.round((o.aliq ?? 0) * 100), 4) + (o.sit || 'N');
const r90 = (pares: [string, number][]) => {
  let s = '90' + EMPRESA + t('0012345670012', 14);
  for (const [tipo, q] of pares) s += tipo + z(q, 8);
  return t(s, 125) + '1';
};

function arquivo(linhas50: string[], comTotais = true) {
  const corpo = [r10(), r11(), ...linhas50];
  const total = corpo.length + 1;
  return [...corpo, ...(comTotais ? [r90([['50', linhas50.length], ['99', total]])] : [])].join('\r\n');
}

describe('lerSintegra', () => {
  it('lê o cabeçalho, junta as linhas 50 da mesma nota e não acusa nada num arquivo certo', () => {
    const a = lerSintegra(arquivo([
      r50({ cnpj: FORNECEDOR, data: '20260905', numero: 123, cfop: '1102', emit: 'T', valor: 1000, icms: 180, aliq: 18 }),
      r50({ cnpj: FORNECEDOR, data: '20260905', numero: 123, cfop: '1403', emit: 'T', valor: 500, icms: 0 }),
      r50({ cnpj: CLIENTE, data: '20260910', numero: 45, cfop: '5102', emit: 'P', valor: 2500.5, icms: 450.09, aliq: 18 }),
    ]));
    expect(a.cabecalho).toMatchObject({ cnpj: EMPRESA, uf: 'MG', inicio: '2026-09-01', fim: '2026-09-30', razao: 'NILMA CONTABILIDADE LTDA' });
    expect(a.problemas).toEqual([]);
    expect(a.notas).toHaveLength(2);
    expect(a.notas[0]).toMatchObject({ numero: '000123', entrada: true, emitente: 'T', cfops: ['1102', '1403'], valor: 1500, icms: 180, linhas: 2 });
    expect(a.notas[1]).toMatchObject({ entrada: false, emitente: 'P', valor: 2500.5, icms: 450.09 });
  });

  it('aponta o que o validador recusaria', () => {
    const ruim = r50({ cnpj: '11222333000199', data: '20261005', numero: 9, cfop: '9102', emit: 'T', valor: 10 });
    const a = lerSintegra([r10(), r11(), ruim, ruim.slice(0, 120), r90([['50', 5], ['99', 9]])].join('\n'));
    const textos = a.problemas.map(p => p.problema).join(' | ');
    expect(textos).toContain('não confere');
    expect(textos).toContain('fora do período');
    expect(textos).toContain('CFOP 9102');
    expect(textos).toContain('120 posições');
    expect(textos).toContain('o 90 diz 5 registros 50, mas tem 2');
    expect(textos).toContain('o 90 diz 9 linhas no arquivo, mas tem 5');
  });

  it('acusa a falta do 10, do 11 e do 90', () => {
    const a = lerSintegra(r50({ cnpj: FORNECEDOR, data: '20260905', numero: 1, cfop: '1102', emit: 'T', valor: 1 }));
    expect(a.problemas.map(p => p.tipo)).toEqual(expect.arrayContaining(['10', '11', '90']));
  });
});

describe('resumirSintegra', () => {
  it('soma por entrada, saída e CFOP, sem as canceladas', () => {
    const a = lerSintegra(arquivo([
      r50({ cnpj: FORNECEDOR, data: '20260905', numero: 1, cfop: '1102', emit: 'T', valor: 100, icms: 18 }),
      r50({ cnpj: FORNECEDOR, data: '20260906', numero: 2, cfop: '1102', emit: 'T', valor: 50, icms: 9 }),
      r50({ cnpj: CLIENTE, data: '20260907', numero: 3, cfop: '5102', emit: 'P', valor: 300 }),
      r50({ cnpj: CLIENTE, data: '20260908', numero: 4, cfop: '5102', emit: 'P', valor: 999, sit: 'S' }),
    ]));
    const r = resumirSintegra(a);
    expect(r.entradas).toMatchObject({ notas: 2, valor: 150, icms: 27 });
    expect(r.entradas.porCfop).toEqual([expect.objectContaining({ cfop: '1102', notas: 2, valor: 150 })]);
    expect(r.saidas).toMatchObject({ notas: 1, valor: 300 });
    expect(r.canceladas).toBe(1);
  });
});

describe('conferirComSieg', () => {
  const chave = (emissor: string, numero: number, serie = 1, modelo = '55') => '31' + '2609' + emissor + modelo + z(serie, 3) + z(numero, 9) + '1' + z(12345678, 8) + '0';
  const sieg = (o: Partial<NotaDoSieg> & { chave: string }): NotaDoSieg => ({ tipo: 'NF-e', numero: '', serie: '1', data: '05/09/2026', emitente: { doc: '', nome: 'X' }, destinatario: { doc: '', nome: 'Y' }, valor: 0, ...o });

  it('casa pela chave de acesso e acha o que falta em cada lado', () => {
    const a = lerSintegra(arquivo([
      r50({ cnpj: FORNECEDOR, data: '20260905', numero: 123, cfop: '1102', emit: 'T', valor: 1000 }),
      r50({ cnpj: FORNECEDOR, data: '20260906', numero: 124, cfop: '1102', emit: 'T', valor: 10 }),
      r50({ cnpj: CLIENTE, data: '20260910', numero: 45, cfop: '5102', emit: 'P', valor: 2500 }),
    ]));
    const c = conferirComSieg(a, {
      recebidas: [
        sieg({ chave: chave(FORNECEDOR, 123), numero: '123', valor: 1000 }),
        sieg({ chave: chave(FORNECEDOR, 999), numero: '999', valor: 77, emitente: { doc: FORNECEDOR, nome: 'FORNECEDOR' } }),
      ],
      emitidas: [sieg({ chave: chave(EMPRESA, 45), numero: '45', valor: 2400 })],
    });
    expect(c.casadas).toBe(2);
    expect(c.soNoSieg).toEqual([expect.objectContaining({ numero: '999', valor: 77, entrada: true, nome: 'FORNECEDOR' })]);
    expect(c.soNoSintegra.map(n => n.numero)).toEqual(['000124']);
    expect(c.valorDiferente).toEqual([expect.objectContaining({ numero: '45', noSintegra: 2500, noSieg: 2400 })]);
  });

  it('acusa a cancelada num lado e normal no outro', () => {
    const a = lerSintegra(arquivo([r50({ cnpj: FORNECEDOR, data: '20260905', numero: 7, cfop: '1102', emit: 'T', valor: 5, sit: 'S' })]));
    const c = conferirComSieg(a, { recebidas: [sieg({ chave: chave(FORNECEDOR, 7), numero: '7', valor: 5 })], emitidas: [] });
    expect(c.situacaoDiferente).toEqual([expect.objectContaining({ numero: '7', noSintegra: 'S', noSieg: 'normal' })]);
  });
});

describe('conferirComAlterdata', () => {
  const nota = (o: Partial<Nota>): Nota => ({ cfop: '1102', lanc: '', valor: 0, numero: '', nome: '', data: '05/09/2026', desc: '', comp: '2026-09', ...o });

  it('compara por CFOP e acha as notas de um lado só', () => {
    const a = lerSintegra(arquivo([
      r50({ cnpj: FORNECEDOR, data: '20260905', numero: 123, cfop: '1102', emit: 'T', valor: 1000 }),
      r50({ cnpj: FORNECEDOR, data: '20260906', numero: 124, cfop: '1102', emit: 'T', valor: 10 }),
    ]));
    const c = conferirComAlterdata(a, [nota({ numero: '00123', doc: '11.222.333/0001-81', valor: 1000 }), nota({ numero: '555', valor: 3 })], []);
    expect(c.porCfop).toEqual([{ cfop: '1102', notasSintegra: 2, notasAlterdata: 2, valorSintegra: 1010, valorAlterdata: 1003 }]);
    expect(c.soNoAlterdata.map(n => n.numero)).toEqual(['555']);
    expect(c.soNoSintegra.map(n => n.numero)).toEqual(['000124']);
  });
});

describe('ajudantes', () => {
  it('valida CNPJ e CPF com os zeros do SINTEGRA', () => {
    expect(documentoValido(EMPRESA)).toBe(true);
    expect(documentoValido('11222333000199')).toBe(false);
    expect(documentoValido('00000000000000')).toBe(true);
    expect(documentoValido('000' + '52998224725')).toBe(true);
  });
  it('a chave ignora os zeros do número e da série', () => {
    expect(chaveDaNota(FORNECEDOR, '55', '001', '000123')).toBe(chaveDaNota(FORNECEDOR, '55', '1', '123'));
  });
});
