import { describe, expect, it } from 'vitest';
import { conta, empresa, linha, nota } from '../__legado__/fixtures';
import { conferirConta, ehLinhaIcms, naturezasDaConferencia, numerosDoHistorico, opcoesCfop, partesDoHistorico, semPendencias, totaisVerificacao, type LinhaRazao } from './verificarConta';

describe('numerosDoHistorico', () => {
  it('padrão fiscal: o número antes do CNPJ, ignorando o resto', () => {
    expect(numerosDoHistorico('conf NF-e ? - 29-54540585000161-NOME // NF 9009', false)).toEqual(['29']);
  });
  it('sem o padrão: números de 3+ dígitos (fiscal < 11 dígitos)', () => {
    expect(numerosDoHistorico('NF 12345 ref 9876543210123 e 777 12', false)).toEqual(['12345', '777']);
  });
  it('nota de 1 dígito com espaços em volta do traço (serviços tomados da 292)', () => {
    expect(numerosDoHistorico('Pelo valor de Serviços Tomados conf. NF nº - 6 - 27203457000150-RAIMUNDO PINHEIRO DOS SANTOS NETO 006679', true)).toEqual(['006679', '6']);
    expect(numerosDoHistorico('Pelo valor de Serviços Tomados conf. NF nº - 002600000000107 - 30295591000132-LEONEL RODRIGUES FREITAS', true)).toEqual(['002600000000107']);
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
  it('CNPJ sem o zero da frente ou com pontuação (razão de serviços da 292)', () => {
    const base = 'Internet a Pagar 00067 Pelo serviços de acesso a internet conf nota fiscal de serviços nº - ';
    expect(partesDoHistorico(base + '000041699 - 7314935000191-CONECTA FIBRA LTDA')).toMatchObject({ nota: '41699', doc: '07314935000191', nome: 'CONECTA FIBRA LTDA' });
    expect(partesDoHistorico(base + '16787-07314935/0001-91-CONECTA FIBRA LTDA')).toMatchObject({ nota: '16787', doc: '07314935000191', nome: 'CONECTA FIBRA LTDA' });
    expect(partesDoHistorico(base + '000000000207372 - 52622141000140-CONECTA DIGITAL LTDA')).toMatchObject({ nota: '207372', doc: '52622141000140', nome: 'CONECTA DIGITAL LTDA' });
    expect(partesDoHistorico('NF 55 - 123.456.789-01 - MARIA')).toMatchObject({ nota: '55', doc: '12345678901', nome: 'MARIA' });
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
  it('sem o número no histórico, mas com o mesmo valor perto da data: conferida pelo valor (o pagamento no banco)', () => {
    const banco = (valor: number, data: string): LinhaRazao => ({ txt: 'DB.TR.C.DIF.TIT.INT comissao DOC.: 16283133', data, valor, sinal: 1, contra: '' });
    const r = conferir([linha('100', 500), banco(300, '06/07/2026'), linha('200', 400)]);
    expect(r.faltando).toEqual([]);
    expect(r.aMais).toEqual([]);
    expect(r.peloValor.map(p => p.nota.numero)).toEqual(['101']);
    expect(semPendencias(r)).toBe(true);
    // longe da data (mais de 5 dias): continua faltando e a linha fica a mais
    const r2 = conferir([linha('100', 500), banco(300, '20/07/2026'), linha('200', 400)]);
    expect(r2.faltando.map(n => n.numero)).toEqual(['101']);
    expect(r2.aMais.length).toBe(1);
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
  it('nota de valor zero não entra em "faltando"', () => {
    const e0 = empresa({ ...e, entradas: [...e.entradas, nota('1102', '6', 0, '300')] });
    const r = conferirConta({ empresa: e0, contas: [e0.contas[0]], razaoPorConta: { 66005: [linha('100', 500), linha('101', 300), linha('200', 400)] }, cfopGrupo: COMPRA, servTipo: null });
    expect(r.faltando).toEqual([]);
    expect(semPendencias(r)).toBe(true);
  });
});

describe('conta ligada a várias naturezas (ex.: 96501 = 5102 + 5405)', () => {
  const V5102 = 'Venda de mercadoria adquirida ou recebida de terceiros';
  const V5405 = 'Venda de mercadoria, adquirida ou recebida de terceiros, na condição de contribuinte-substituído';
  const e = empresa({
    contas: [conta('96501', 'Vendas de Mercadorias', 0, 'Receita', 'C')],
    saidas: [
      nota('5102', '182', 100, '9001'),
      nota('5405', '182', 250, '9002'),
      nota('5102', '182', 68.09, '9756'),
      nota('5405', '182', 269.37, '9756'), // mesma NF, os dois CFOPs na mesma conta
    ],
    naturezaConta: { [V5102]: ['96501'], [V5405]: ['96501'] },
  });
  const conta96501 = e.contas[0];

  it('o campo CFOP mostra as duas naturezas juntas', () => {
    const op = opcoesCfop(e, conta96501);
    expect(op.vinculada).toBe(V5102);
    expect(op.rotulos[V5102]).toBe('5102, 5405 (4 notas)');
    expect(naturezasDaConferencia(e, ['96501'], V5102)).toEqual([V5102, V5405]);
  });
  it('confere contra todas: a venda 5405 não vira "a mais"', () => {
    const r = conferirConta({ empresa: e, contas: [conta96501], razaoPorConta: { 96501: [linha('9001', 100), linha('9002', 250), linha('9756', 337.46)] }, cfopGrupo: V5102, servTipo: null });
    expect(semPendencias(r)).toBe(true);
    expect(r.somaFiscal).toBeCloseTo(687.46, 5);
    expect(r.fonte).toBe('CFOP 5102, 5405');
  });
  it('NF com os dois CFOPs lançada duas vezes: duplicada pelo valor da nota inteira', () => {
    const r = conferirConta({ empresa: e, contas: [conta96501], razaoPorConta: { 96501: [linha('9001', 100), linha('9002', 250), linha('9756', 337.46), linha('9756', 337.46)] }, cfopGrupo: V5102, servTipo: null });
    expect(r.aMais).toEqual([]);
    expect(r.duplicada.length).toBe(1);
    expect(r.duplicada[0].valor).toBeCloseTo(337.46, 5);
  });
  it('CFOP escolhido à mão, que não é ligado à conta: só ele', () => {
    expect(naturezasDaConferencia(e, ['99999'], V5405)).toEqual([V5405]);
  });
});
