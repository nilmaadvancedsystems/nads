import { describe, expect, it } from 'vitest';
import { andamentoDaNota, competenciaDaNota, duracao, type NotaFiscal, conferirPedido, CONFIG_PADRAO, documentoValido, faltasNaConfig, rotuloDoStatus } from './index';

describe('o emissor de NFS-e', () => {
  it('confere CPF e CNPJ pelos dígitos verificadores', () => {
    expect(documentoValido('529.982.247-25')).toBe(true);
    expect(documentoValido('529.982.247-24')).toBe(false);
    expect(documentoValido('11.222.333/0001-81')).toBe(true);
    expect(documentoValido('11.222.333/0001-80')).toBe(false);
    expect(documentoValido('000.000.000-00')).toBe(false);
    expect(documentoValido('123')).toBe(false);
  });

  it('põe a competência no último dia do mês', () => {
    expect(competenciaDaNota('2026-02')).toBe('2026-02-28');
    expect(competenciaDaNota('2028-02')).toBe('2028-02-29');
    expect(competenciaDaNota('2026-10')).toBe('2026-10-31');
    expect(competenciaDaNota('10/2026')).toBe('');
  });

  it('confere o pedido antes de mandar para o robô', () => {
    const certo = { tomador: { documento: '11222333000181', nome: 'Cliente Exemplo Ltda', endereco: { cMun: '3168002', cep: '39550000', logradouro: 'RUA A', numero: '1', bairro: 'CENTRO' } }, servico: { descricao: 'Honorários contábeis de outubro', valor: 850, competencia: '2026-10-31' } };
    expect(conferirPedido(certo)).toEqual([]);
    expect(conferirPedido({ ...certo, tomador: { ...certo.tomador, documento: '11222333000180' } })).toContain('O CPF ou CNPJ do tomador não confere.');
    expect(conferirPedido({ ...certo, servico: { ...certo.servico, valor: 0 } })).toContain('O valor precisa ser maior que zero.');
    expect(conferirPedido({ ...certo, tomador: { ...certo.tomador, email: 'sem-arroba' } })).toContain('O e-mail do tomador não parece um e-mail.');
    expect(conferirPedido({ ...certo, tomador: { ...certo.tomador, fone: '9977' } })).toContain('O telefone do tomador precisa do DDD (10 ou 11 dígitos).');
    expect(conferirPedido({ ...certo, tomador: { ...certo.tomador, endereco: { cMun: '3130655', cep: '39536-000', logradouro: 'Fazenda Marquesa', numero: '0', bairro: 'Zona Rural' } } })).toEqual([]);
  });

  it('diz o que falta na configuração', () => {
    expect(faltasNaConfig(null, false)).toEqual(['a configuração do emissor']);
    // o padrão já vem com os dados da Nilma (da nota real): só falta o token
    expect(faltasNaConfig(CONFIG_PADRAO, false)).toEqual(['o token da prefeitura']);
    expect(faltasNaConfig(CONFIG_PADRAO, true)).toEqual([]);
    const errada = { ...CONFIG_PADRAO, prestador: { ...CONFIG_PADRAO.prestador, cnpj: '11222333000180' }, servico: { ...CONFIG_PADRAO.servico, cIntContrib: '', pAliq: 9 } };
    expect(faltasNaConfig(errada, true)).toEqual(['o CNPJ do escritório', 'o código do serviço na prefeitura', 'a alíquota do ISS (entre 0 e 5%)']);
  });

  it('dá nome às situações', () => {
    expect(rotuloDoStatus('processando').rotulo).toBe('Na prefeitura');
    expect(rotuloDoStatus('erro').tom).toBe('bad');
  });

  it('conta o andamento com o que o robô grava', () => {
    expect(duracao(12_000)).toBe('12 s');
    expect(duracao(3 * 60_000)).toBe('3 min');
    expect(duracao(80 * 60_000)).toBe('1 h 20 min');
    const agora = new Date('2026-10-15T20:11:00Z');
    const base: NotaFiscal = { id: 'x', status: 'pedida', ambiente: 'homologacao', tomador: { documento: '11222333000181', nome: 'X' }, servico: { descricao: 'Honorários', valor: 1, competencia: '2026-10-15' },
      empresaCodigo: null, pedidoPor: 'V', pedidoEm: '2026-10-15T20:07:00Z', dps: null, chaveAcesso: '', numeroNfse: '', erros: [], cancelamento: null,
      enviadaEm: '2026-10-15T20:08:00Z', consultas: 6, autorizadaEm: '', atualizadoEm: '2026-10-15T20:10:48Z' };
    expect(andamentoDaNota({ ...base, status: 'processando' }, agora)).toBe('Na prefeitura há 3 min · 6 consultas · última há 12 s');
    expect(andamentoDaNota({ ...base, status: 'autorizada', autorizadaEm: '2026-10-15T20:10:00Z' }, agora)).toBe('Autorizada em 2 min depois do envio');
    expect(andamentoDaNota({ ...base, status: 'erro' }, agora)).toBe('');
  });
});