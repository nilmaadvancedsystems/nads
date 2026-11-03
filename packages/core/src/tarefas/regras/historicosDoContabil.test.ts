import { describe, expect, it } from 'vitest';
import {
  HISTORICOS_DO_CONTABIL, LIMITE_DO_CODIGO, MODELOS_PADRAO, codigoValido, modelosDoDocumento, preencherHistorico,
  type ModelosDoHistorico,
} from './historicosDoContabil';
import { historicoDaProvisaoDeHonorario, lancamentosDosHonorarios, pagamentosDosHonorarios, type CobrancaDeHonorario } from './honorarios';
import { historicoDoPagamento, pagamentosDoProLabore } from './proLabore';
import { historicoDoAdiantamentoSalarial, pagamentosQueFaltam } from './adiantamentoSalarial';
import type { RazaoDaConta } from './razao';

// Cliente fictício: cobrança 123 emitida em 31/03/2026 e paga em 10/04/2026.
const cobranca: CobrancaDeHonorario = {
  codigoCliente: 1, emissao: '2026-03-31', numero: '000000123', vencimento: '2026-04-10', pagamento: '2026-04-10',
  valor: 1000, recebido: 1020, aReceber: 0,
};

describe('registro dos históricos do Contábil', () => {
  it('tem ids únicos e um padrão para cada um', () => {
    const ids = HISTORICOS_DO_CONTABIL.map(h => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(MODELOS_PADRAO).sort()).toEqual([...ids].sort());
  });

  it('cada {variável} do padrão está listada nas variáveis do histórico', () => {
    for (const h of HISTORICOS_DO_CONTABIL) {
      const usadas = [...h.padrao.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
      for (const nome of usadas) expect(h.variaveis.map(v => v.nome)).toContain(nome);
    }
  });

  it('o código do Cheque especial é o 92029 e é o único código', () => {
    const codigos = HISTORICOS_DO_CONTABIL.filter(h => h.codigo).map(h => h.id);
    expect(codigos).toEqual(['cheque.codigo']);
    expect(MODELOS_PADRAO['cheque.codigo']).toBe('92029');
  });
});

describe('modelosDoDocumento', () => {
  it('sem documento, devolve os padrões', () => {
    expect(modelosDoDocumento(null)).toEqual(MODELOS_PADRAO);
    expect(modelosDoDocumento('lixo')).toEqual(MODELOS_PADRAO);
  });

  it('texto em branco ou que não é texto volta ao padrão; texto com espaços nas pontas é aparado', () => {
    const m = modelosDoDocumento({ 'fgts.pagamento': '   ', 'inss.pagamento': 42, 'prolabore.pagamento': '  Pgto {socio}  ' });
    expect(m['fgts.pagamento']).toBe(MODELOS_PADRAO['fgts.pagamento']);
    expect(m['inss.pagamento']).toBe(MODELOS_PADRAO['inss.pagamento']);
    expect(m['prolabore.pagamento']).toBe('Pgto {socio}');
  });

  it('código: só dígitos, até o limite; o inválido volta ao padrão', () => {
    expect(LIMITE_DO_CODIGO).toBe(10);
    expect(codigoValido('12345')).toBe(true);
    expect(codigoValido('')).toBe(false);
    expect(codigoValido('12a')).toBe(false);
    expect(codigoValido('12345678901')).toBe(false);
    expect(modelosDoDocumento({ 'cheque.codigo': ' 5001 ' })['cheque.codigo']).toBe('5001');
    expect(modelosDoDocumento({ 'cheque.codigo': '50-01' })['cheque.codigo']).toBe('92029');
    expect(modelosDoDocumento({ 'cheque.codigo': '12345678901' })['cheque.codigo']).toBe('92029');
  });
});

describe('preencherHistorico', () => {
  it('troca cada {variável} pelo valor e deixa o resto do texto', () => {
    expect(preencherHistorico('prolabore.pagamento', { ref: '01/2026', socio: 'FULANO DE TAL' })).toBe('Pagamento de pro-labore 01/2026 FULANO DE TAL');
  });

  it('variável que não veio vira vazio', () => {
    expect(preencherHistorico('fgts.pagamento', {})).toBe('Pagamento de FGTS referente , conforme GFD quitada.');
  });

  it('usa o texto guardado no lugar do padrão quando ele é passado', () => {
    const modelos: ModelosDoHistorico = { ...MODELOS_PADRAO, 'adiantamento.pagamento': 'Adiant. {ref} (x)' };
    expect(preencherHistorico('adiantamento.pagamento', { ref: '03/2026' }, modelos)).toBe('Adiant. 03/2026 (x)');
    expect(preencherHistorico('adiantamento.pagamento', { ref: '03/2026' })).toBe('Pagamento de adiantamento salarial 03/2026');
  });
});

// O texto de cada etapa com o padrão tem que ser o mesmo que o sistema já gerava (a exportação não muda sem configuração).
describe('padrão de cada etapa = texto antigo', () => {
  it('honorários', () => {
    expect(preencherHistorico('honorarios.provisao', { ref: '03/2026', cobranca: '123' })).toBe('Honorários contábeis ref. 03/2026 conf. cobrança nº 123');
    expect(preencherHistorico('honorarios.pagamento', { ref: '03/2026', cobranca: '123' })).toBe('Pagamento de honorários contábeis ref. 03/2026 conf. cobrança nº 123');
    expect(preencherHistorico('honorarios.juros', { ref: '03/2026', cobranca: '123' })).toBe('Juros e multa s/ pagamento de honorários contábeis ref. 03/2026 conf. cobrança nº 123');
  });
  it('pró-labore e adiantamento salarial', () => {
    expect(preencherHistorico('prolabore.pagamento', { ref: '01/2026', socio: 'SOCIO FICTICIO' })).toBe('Pagamento de pro-labore 01/2026 SOCIO FICTICIO');
    expect(preencherHistorico('adiantamento.pagamento', { ref: '07/2026' })).toBe('Pagamento de adiantamento salarial 07/2026');
  });
  it('INSS', () => {
    expect(preencherHistorico('inss.provisao_a_maior', { grupo: 'patronal', ref: '02/2026' })).toBe('Pelo valor de INSS provisionado a maior — patronal <02/2026>');
    expect(preencherHistorico('inss.provisao_a_recolher', { grupo: 'patronal', ref: '02/2026' })).toBe('Pelo valor de INSS a recolher — patronal <02/2026>');
    expect(preencherHistorico('inss.producao_rural', { ref: '02/2026' })).toBe('INSS sobre aquisição de produção rural de PF (sub-rogação) <02/2026>');
    expect(preencherHistorico('inss.ajuste_centavos', { ref: '02/2026' })).toBe('Ajuste de centavos do INSS a recolher <02/2026>');
    expect(preencherHistorico('inss.pagamento', { ref: '02/2026' })).toBe('Pagamento de INSS ref 02/2026 conforme DARF.');
  });
  it('FGTS', () => {
    expect(preencherHistorico('fgts.provisao_a_maior', { ref: '06/2026', trabalhador: 'FULANO' })).toBe('Pelo valor de FGTS provisionado a maior s/ folha <06/2026> FULANO');
    expect(preencherHistorico('fgts.provisao_a_recolher', { ref: '06/2026', trabalhador: 'FULANO' })).toBe('Pelo valor de FGTS a recolher s/ folha <06/2026> FULANO');
    expect(preencherHistorico('fgts.pagamento', { ref: '06/2026' })).toBe('Pagamento de FGTS referente 06/2026, conforme GFD quitada.');
  });
});

describe('os construtores usam os modelos guardados', () => {
  const trocado: ModelosDoHistorico = {
    ...MODELOS_PADRAO,
    'honorarios.provisao': 'Prov {ref} nº {cobranca}',
    'honorarios.juros': 'Mora {ref} nº {cobranca}',
    'prolabore.pagamento': 'PL {ref} {socio}',
    'adiantamento.pagamento': 'AS {ref}',
  };

  it('honorários: padrão e trocado', () => {
    expect(historicoDaProvisaoDeHonorario(cobranca)).toBe('Honorários contábeis ref. 03/2026 conf. cobrança nº 123');
    expect(historicoDaProvisaoDeHonorario(cobranca, trocado)).toBe('Prov 03/2026 nº 123');
    const padrao = pagamentosDosHonorarios([cobranca], '21405', '42105', () => '10503');
    expect(padrao.map(l => l.historico)).toEqual([
      'Pagamento de honorários contábeis ref. 03/2026 conf. cobrança nº 123',
      'Juros e multa s/ pagamento de honorários contábeis ref. 03/2026 conf. cobrança nº 123',
    ]);
    const custom = pagamentosDosHonorarios([cobranca], '21405', '42105', () => '10503', trocado);
    expect(custom[1].historico).toBe('Mora 03/2026 nº 123');
    expect(lancamentosDosHonorarios([cobranca], '42105', '21405', trocado)[0].historico).toBe('Prov 03/2026 nº 123');
  });

  it('pró-labore: a competência e o sócio entram no texto trocado', () => {
    expect(historicoDoPagamento('2026-01', 'SOCIO FICTICIO')).toBe('Pagamento de pro-labore 01/2026 SOCIO FICTICIO');
    expect(historicoDoPagamento('2026-01', 'SOCIO FICTICIO', trocado)).toBe('PL 01/2026 SOCIO FICTICIO');
    const razao: RazaoDaConta = {
      inicio: '2026-01-01', saldoInicial: 0, lancamentos: [
        { data: '2026-01-31', valor: 500, historico: 'Pelo valor de retirada pró-labore a pagar <01/2026> SOCIO FICTICIO', contrapartida: '', nomeContrapartida: '' },
      ],
    } as unknown as RazaoDaConta;
    expect(pagamentosDoProLabore(razao).map(p => p.historico)).toEqual(['Pagamento de pro-labore 01/2026 SOCIO FICTICIO']);
    expect(pagamentosDoProLabore(razao, trocado).map(p => p.historico)).toEqual(['PL 01/2026 SOCIO FICTICIO']);
  });

  it('adiantamento salarial: o histórico do pagamento que falta', () => {
    expect(historicoDoAdiantamentoSalarial('2026-07')).toBe('Pagamento de adiantamento salarial 07/2026');
    expect(historicoDoAdiantamentoSalarial('2026-07', trocado)).toBe('AS 07/2026');
    const razao = {
      inicio: '2026-06-01', saldoInicial: 0, lancamentos: [
        { data: '2026-06-15', valor: 800, historico: 'Pelo valor de adiantamento salarial 06/2026', contrapartida: '', nomeContrapartida: '' },
      ],
    } as unknown as RazaoDaConta;
    expect(pagamentosQueFaltam(razao, '2026-06').map(p => p.historico)).toEqual(['Pagamento de adiantamento salarial 06/2026']);
    expect(pagamentosQueFaltam(razao, '2026-06', trocado).map(p => p.historico)).toEqual(['AS 06/2026']);
  });
});
