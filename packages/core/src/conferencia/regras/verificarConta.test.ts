import { describe, expect, it } from 'vitest';
import { conta, empresa, linha, nota } from '../__legado__/fixtures';
import { conferirConta, ehLinhaIcms, numerosDoHistorico, partesDoHistorico, semPendencias, totaisVerificacao, type LinhaRazao } from './verificarConta';

describe('numerosDoHistorico', () => {
  it('padrão fiscal: o número antes do CNPJ, ignorando o resto', () => {
    expect(numerosDoHistorico('conf NF-e ? - 29-54540585000161-NOME // NF 9009', false)).toEqual(['29']);
  });
  it('sem o padrão: números de 3+ dígitos (fiscal < 11 dígitos)', () => {
    expect(numerosDoHistorico('NF 12345 ref 9876543210123 e 777 12', false)).toEqual(['12345', '777']);
  });
  it('serviço: aceita até 15 dígitos, mas não 11 (CPF) nem 14 (CNPJ)', () => {
    expect(numerosDoHistorico('NFS 202600000012345 CNPJ 11222333000100 CPF 12345678901 nr 777', true)).toEqual(['202600000012345', '777']);
  });
});

describe('partesDoHistorico', () => {
  it('nota, documento, nome, contrapartida e lançamento', () => {
    expect(partesDoHistorico('Fornecedores 21101 pelo valor conf NF-e 00029 - 54540585000161 - EMPRESA X')).toEqual({
      nota: '29', doc: '54540585000161', nome: 'EMPRESA X', contra: 'Fornecedores', lanc: '21101',
    });
  });
  it('texto sem padrão devolve tudo vazio', () => {
    expect(partesDoHistorico('qualquer coisa')).toEqual({ nota: '', doc: '', nome: '', contra: '', lanc: '' });
  });
});

describe('ehLinhaIcms', () => {
  it('palavra ICMS inteira', () => {
    expect(ehLinhaIcms({ txt: 'ICMS a Recuperar s/ devolução' })).toBe(true);
    expect(ehLinhaIcms({ txt: 'Pelo valor do ICMS-ST' })).toBe(true);
    expect(ehLinhaIcms({ txt: 'DICMS 55' })).toBe(false);
  });
});

describe('conferirConta', () => {
  const COMPRA = 'Compra para comercialização';
  const e = empresa({
    contas: [conta('66005', 'Compras de Mercadorias'), conta('31122', 'Uso e Consumo')],
    entradas: [
      nota('1102', '6', 500, '100'),
      nota('1102', '6', 300, '101'),
      nota('1102', '6', 400, '200'),
      nota('1556', '215', 50, '200'), // mesma NF, outro CFOP
    ],
    naturezaConta: { [COMPRA]: ['66005'], 'Uso e Consumo': ['31122'] },
  });
  const conferir = (linhas: LinhaRazao[]) => conferirConta({ empresa: e, contas: [e.contas[0]], razaoPorConta: { 66005: linhas }, cfopGrupo: COMPRA, servTipo: null });

  it('tudo lançado: sem pendências', () => {
    const r = conferir([linha('100', 500), linha('101', 300), linha('200', 400)]);
    expect(semPendencias(r)).toBe(true);
    expect(r.somaFiscal).toBe(1200);
    expect(r.fonte).toBe('CFOP 1102 — ' + COMPRA);
  });
  it('nota que não está no razão: faltando', () => {
    const r = conferir([linha('100', 500), linha('200', 400)]);
    expect(r.faltando.map(n => n.numero)).toEqual(['101']);
  });
  it('mesmo número duas vezes somando o valor da nota (itens): não é duplicada', () => {
    const r = conferir([linha('100', 200), linha('100', 300), linha('101', 300), linha('200', 400)]);
    expect(r.duplicada).toEqual([]);
    expect(semPendencias(r)).toBe(true);
  });
  it('mesmo número passando do valor: duplicada com o excesso e a linha que sobra', () => {
    const r = conferir([linha('100', 500), linha('100', 120), linha('101', 300), linha('200', 400)]);
    expect(r.duplicada.length).toBe(1);
    expect(r.duplicada[0]).toMatchObject({ numero: '100', vezes: 2 });
    expect(r.duplicada[0].valor).toBeCloseTo(120, 5);
    expect(r.duplicada[0].linhas.map(l => l.valor)).toEqual([120]);
  });
  it('linha com o valor do item de outro CFOP da mesma NF: vai pra "a mais" com a dica', () => {
    const r = conferir([linha('100', 500), linha('101', 300), linha('200', 400), linha('200', 50)]);
    expect(r.duplicada).toEqual([]);
    expect(r.aMais.length).toBe(1);
    expect(r.aMais[0].valor).toBe(50);
    expect(r.aMais[0].dica).toBe('é do CFOP 1556 (conta 31122)');
  });
  it('linha de ICMS sai da conferência e vai pra lista própria', () => {
    const r = conferir([linha('100', 500), linha('101', 300), linha('200', 400), { ...linha('100', 90), txt: 'ICMS a Recuperar s/ NF 100' }]);
    expect(r.icms.length).toBe(1);
    expect(r.duplicada).toEqual([]);
    expect(r.somaSemIcms).toBe(1200);
    expect(r.somaRazao).toBe(1290);
  });
  it('totais: diferença = faltando − duplicadas − a mais − ICMS + sem explicação', () => {
    const r = conferir([linha('100', 500), linha('100', 120), linha('200', 400), { ...linha('0', 90), txt: 'ICMS s/ compra' }, linha('999', 7)]);
    const t = totaisVerificacao(r);
    expect(t.faltando).toBe(300);
    expect(t.duplicadas).toBeCloseTo(120, 5);
    expect(t.aMais).toBe(7);
    expect(t.icms).toBe(90);
    expect(t.diferenca).toBeCloseTo(1200 - 1117, 5);
    expect(t.faltando - t.duplicadas - t.aMais - t.icms + t.semExplicacao).toBeCloseTo(t.diferenca, 5);
    expect(t.semExplicacao).toBeCloseTo(0, 5);
  });
  it('sem CFOP escolhido: erro', () => {
    expect(() => conferirConta({ empresa: e, contas: [e.contas[0]], razaoPorConta: {}, cfopGrupo: null, servTipo: null })).toThrow('Escolha o CFOP');
  });
});
