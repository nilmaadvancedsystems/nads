import { describe, expect, it } from 'vitest';
import {
  boletosEfiDoBanco, boletosParaConsultar, boletoQueVale, configDoBoletoDoBanco, conferirConfigDoBoleto, corpoDoBolix, CONFIG_PADRAO_DO_BOLETO, diaDoContrato,
  lerBolixEmitido, lerCobrancaDoEfi, pedidoDeBoleto, porQueNaoEmitir, recebimentoDaBaixa, seloDoBoletoEfi, vencimentoDoHonorario, type BoletoEfiDoMes,
} from './boletoEfi';
import type { ContratoDeHonorario } from './honorarios';

const contrato = (mais: Partial<ContratoDeHonorario> = {}): ContratoDeHonorario => ({
  id: 'h1', clienteId: '', codigo: '101', nome: 'ALFA COMERCIO  EXEMPLO LTDA', cnpj: '11222333000181', valor: 850, ativo: true, criadoEm: '', criadoPor: '', ...mais,
});
const pedido = (mais: Partial<BoletoEfiDoMes> = {}): BoletoEfiDoMes =>
  ({ status: 'pedido', valor: 850, vencimento: '2026-11-10', destinatarios: ['a@b.com'], pedidoEm: '2026-11-19T10:00:00Z', pedidoPor: 'Vitor', ...mais });

describe('o vencimento do boleto do honorário', () => {
  it('o dia do cliente no mês seguinte à competência; mês curto vence no último dia; dezembro vira o ano', () => {
    expect(vencimentoDoHonorario('2026-10', 10, '2026-10-20')).toEqual({ vencimento: '2026-11-10', ajustado: false });
    expect(vencimentoDoHonorario('2027-01', 31, '2027-01-05')).toEqual({ vencimento: '2027-02-28', ajustado: false });
    expect(vencimentoDoHonorario('2026-12', 5, '2026-12-20')).toEqual({ vencimento: '2027-01-05', ajustado: false });
  });
  it('dia que já passou (ou hoje): vence em 3 dias, avisando', () => {
    expect(vencimentoDoHonorario('2026-10', 10, '2026-11-19')).toEqual({ vencimento: '2026-11-22', ajustado: true });
    expect(vencimentoDoHonorario('2026-10', 19, '2026-11-19')).toEqual({ vencimento: '2026-11-22', ajustado: true });
  });
  it('o dia do contrato, ou o padrão', () => {
    expect(diaDoContrato({ diaVencimento: 5 }, CONFIG_PADRAO_DO_BOLETO)).toBe(5);
    expect(diaDoContrato({}, { ...CONFIG_PADRAO_DO_BOLETO, diaPadrao: 15 })).toBe(15);
    expect(diaDoContrato({ diaVencimento: 40 }, CONFIG_PADRAO_DO_BOLETO)).toBe(10);
  });
});

describe('a configuração do boleto (config/boletoEfi)', () => {
  it('confere os limites do Efí', () => {
    expect(conferirConfigDoBoleto({ multa: 2, jurosAoMes: 1, diaPadrao: 10 })).toEqual([]);
    expect(conferirConfigDoBoleto({ multa: 11, jurosAoMes: -1, diaPadrao: 0 })).toHaveLength(3);
  });
  it('do banco: o que não serve vira o padrão, campo a campo', () => {
    expect(configDoBoletoDoBanco(null)).toEqual(CONFIG_PADRAO_DO_BOLETO);
    expect(configDoBoletoDoBanco({ multa: 2, jurosAoMes: 'x', diaPadrao: 5 })).toEqual({ multa: 2, jurosAoMes: 0, diaPadrao: 5 });
    expect(configDoBoletoDoBanco({ multa: 50, jurosAoMes: 1, diaPadrao: 2.5 })).toEqual({ multa: 0, jurosAoMes: 1, diaPadrao: 10 });
  });
});

describe('quem pode pedir o boleto', () => {
  it('trava o parado, o sem valor, o pago, o sem documento e o que já tem boleto (o com erro pode de novo)', () => {
    expect(porQueNaoEmitir(contrato(), '2026-10', null)).toBe('');
    expect(porQueNaoEmitir(contrato(), '', null)).toBe('Escolha uma competência.');
    expect(porQueNaoEmitir(contrato({ ativo: false }), '2026-10', null)).toMatch(/parado/);
    expect(porQueNaoEmitir(contrato({ valor: 0 }), '2026-10', null)).toMatch(/valor/);
    expect(porQueNaoEmitir(contrato({ cnpj: '' }), '2026-10', null)).toMatch(/CNPJ/);
    expect(porQueNaoEmitir(contrato(), '2026-10', { id: 'r', contratoId: 'h1', competencia: '2026-10', valor: 850, recebidoEm: '2026-11-05', forma: 'pix', por: '', em: '' })).toMatch(/pago/);
    expect(porQueNaoEmitir(contrato({ boletosEfi: { '2026-10': pedido() } }), '2026-10', null)).toMatch(/já foi pedido/);
    expect(porQueNaoEmitir(contrato({ boletosEfi: { '2026-10': pedido({ status: 'erro' }) } }), '2026-10', null)).toBe('');
    expect(porQueNaoEmitir(contrato({ boletosEfi: { '2026-09': pedido() } }), '2026-10', null)).toBe('');
    expect(boletoQueVale(contrato({ boletosEfi: { '2026-10': pedido({ status: 'erro' }) } }), '2026-10')).toBeNull();
  });
  it('o pedido: o valor, o vencimento pelo dia do cliente e os e-mails sem repetir', () => {
    const p = pedidoDeBoleto(contrato({ diaVencimento: 5, valor: 850.005 }), '2026-10', CONFIG_PADRAO_DO_BOLETO, '2026-10-30', ['A@B.com', 'a@b.com ', ''], 'Vitor', '2026-10-30T12:00:00Z');
    expect(p).toEqual({ status: 'pedido', valor: 850.01, vencimento: '2026-11-05', destinatarios: ['a@b.com'], pedidoEm: '2026-10-30T12:00:00Z', pedidoPor: 'Vitor' });
  });
});

describe('o boleto com Pix no Efí (charge/one-step)', () => {
  it('PJ, com multa em centésimos de % e juros ao dia em milésimos de %', () => {
    expect(corpoDoBolix(contrato(), '2026-10', pedido(), { multa: 2, jurosAoMes: 1, diaPadrao: 10 })).toEqual({
      items: [{ name: 'Honorários contábeis 10/2026', value: 85000, amount: 1 }],
      metadata: { custom_id: 'h1_2026-10' },
      payment: { banking_billet: {
        expire_at: '2026-11-10', customer: { juridical_person: { corporate_name: 'ALFA COMERCIO EXEMPLO LTDA', cnpj: '11222333000181' }, email: 'a@b.com' },
        configurations: { fine: 200, interest: 33 }, message: 'Honorários contábeis de 10/2026 · Nilma Contabilidade',
      } },
    });
  });
  it('PF pelo CPF; sem multa e juros, sem as configurações; sem e-mail, sem o campo', () => {
    const b = corpoDoBolix(contrato({ cnpj: '12345678909', nome: 'FULANO' }), '2026-10', pedido({ destinatarios: [] }), CONFIG_PADRAO_DO_BOLETO);
    expect((b.payment as { banking_billet: Record<string, unknown> }).banking_billet).toEqual({
      expire_at: '2026-11-10', customer: { name: 'FULANO', cpf: '12345678909' }, message: 'Honorários contábeis de 10/2026 · Nilma Contabilidade',
    });
  });
  it('lê a resposta: o número, a linha (só dígitos), o Pix, o link e o PDF; sem eles, erro', () => {
    const resposta = { code: 200, data: {
      charge_id: 4321, status: 'waiting', barcode: '36490.00019 00000.000000 00000.000000 1 99990000085000',
      pix: { qrcode: '00020101021226...', qrcode_image: 'data:image/svg+xml;base64,AAA' }, link: 'https://l', billet_link: 'https://b', pdf: { charge: 'https://pdf' },
    } };
    expect(lerBolixEmitido(resposta)).toEqual({ chargeId: 4321, linha: '36490000190000000000000000000000199990000085000', pix: '00020101021226...', link: 'https://b', pdf: 'https://pdf' });
    expect(() => lerBolixEmitido({ data: { barcode: '1' } })).toThrow(/número da cobrança/);
    expect(() => lerBolixEmitido({ data: { charge_id: 1, barcode: '123' } })).toThrow(/linha digitável/);
  });
});

describe('o boleto na tela e no banco', () => {
  it('o selo de cada status; o de homologação avisa que é teste', () => {
    expect(seloDoBoletoEfi(null)).toBeNull();
    expect(seloDoBoletoEfi(pedido())?.rotulo).toBe('Boleto pedido');
    expect(seloDoBoletoEfi(pedido({ status: 'emitido', ambiente: 'producao' }))).toEqual({ rotulo: 'Boleto até 10/11', tom: 'info' });
    expect(seloDoBoletoEfi(pedido({ status: 'emitido', ambiente: 'homologacao' }))?.rotulo).toBe('Boleto de teste · 10/11');
    expect(seloDoBoletoEfi(pedido({ status: 'erro', erro: 'recusado' }))).toEqual({ rotulo: 'Boleto com erro', tom: 'bad', dica: 'recusado' });
  });
  it('do banco: só competência e status que existem', () => {
    expect(boletosEfiDoBanco({ '2026-10': { status: 'emitido', valor: 850, vencimento: '2026-11-10', chargeId: 9, linha: '1', ambiente: 'producao', x: 1 }, 'lixo': { status: 'pedido' }, '2026-09': { status: 'outro' } }))
      .toEqual({ '2026-10': { status: 'emitido', valor: 850, vencimento: '2026-11-10', destinatarios: [], pedidoEm: '', pedidoPor: '', ambiente: 'producao', chargeId: 9, linha: '1' } });
    expect(boletosEfiDoBanco(null)).toBeUndefined();
  });
});

describe('a baixa pelo Efí (fase 3: consulta a cada hora)', () => {
  const emitido = (mais: Partial<BoletoEfiDoMes> = {}) => pedido({ status: 'emitido', chargeId: 4321, emitidoEm: '2026-11-19T10:00:00Z', ...mais });
  it('consulta só os emitidos, com o número da cobrança, de até 120 dias', () => {
    const contratos: Pick<ContratoDeHonorario, 'id' | 'boletosEfi'>[] = [
      { id: 'h1', boletosEfi: { '2026-10': emitido(), '2026-09': emitido({ status: 'pago' }), '2026-08': emitido({ chargeId: undefined }) } },
      { id: 'h2', boletosEfi: { '2026-06': emitido({ emitidoEm: '2026-07-01T10:00:00Z' }), '2026-10': pedido() } },
      { id: 'h3' },
    ];
    expect(boletosParaConsultar(contratos, '2026-11-20').map(x => [x.contratoId, x.competencia])).toEqual([['h1', '2026-10']]);
    expect(boletosParaConsultar(contratos, '2026-10-20').map(x => [x.contratoId, x.competencia])).toEqual([['h1', '2026-10'], ['h2', '2026-06']]);
  });
  it('lê a cobrança: paga (valor, dia, forma), em aberto e cancelada', () => {
    expect(lerCobrancaDoEfi({ code: 200, data: { charge_id: 4321, status: 'paid', total: 85000, paid_value: 86700, payment: { method: 'banking_billet', paid_at: '2026-11-12 14:03:00' } } }))
      .toEqual({ situacao: 'pago', valor: 867, pagoEm: '2026-11-12', forma: 'boleto' });
    // o bolix pago pelo QR: o histórico diz Pix; sem o dia no pagamento, o do histórico
    expect(lerCobrancaDoEfi({ data: { status: 'paid', total: 85000, history: [{ message: 'Cobrança criada', created_at: '2026-11-10 08:00:00' }, { message: 'Pagamento via Pix confirmado', created_at: '2026-11-11 09:30:00' }] } }))
      .toEqual({ situacao: 'pago', valor: 850, pagoEm: '2026-11-11', forma: 'pix' });
    expect(lerCobrancaDoEfi({ data: { status: 'settled' } })).toEqual({ situacao: 'pago', valor: null, pagoEm: null, forma: 'boleto' });
    expect(lerCobrancaDoEfi({ data: { status: 'waiting' } })).toEqual({ situacao: 'aberto' });
    expect(lerCobrancaDoEfi({ data: { status: 'unpaid' } })).toEqual({ situacao: 'aberto' });
    expect(lerCobrancaDoEfi({ data: { status: 'canceled' } })).toEqual({ situacao: 'cancelado' });
    expect(lerCobrancaDoEfi(null)).toEqual({ situacao: 'aberto' });
  });
  it('o recebimento da baixa: o valor e o dia pagos (sem eles, os do boleto e hoje)', () => {
    expect(recebimentoDaBaixa('h1', '2026-10', emitido(), { valor: 867, pagoEm: '2026-11-12', forma: 'pix' }, '2026-11-20', 'Robô (Efí)', 'agora')).toEqual({
      contratoId: 'h1', competencia: '2026-10', valor: 867, recebidoEm: '2026-11-12', forma: 'pix', observacoes: 'Baixa automática pelo Efí (cobrança 4321)', por: 'Robô (Efí)', em: 'agora',
    });
    expect(recebimentoDaBaixa('h1', '2026-10', emitido(), { valor: null, pagoEm: null, forma: 'boleto' }, '2026-11-20', 'R', 'a')).toMatchObject({ valor: 850, recebidoEm: '2026-11-20' });
  });
  it('o cancelado deixa pedir outro e tem o selo; o pago mostra o dia', () => {
    expect(porQueNaoEmitir(contrato({ boletosEfi: { '2026-10': emitido({ status: 'cancelado' }) } }), '2026-10', null)).toBe('');
    expect(seloDoBoletoEfi(emitido({ status: 'cancelado' }))?.rotulo).toBe('Boleto cancelado');
    expect(seloDoBoletoEfi(emitido({ status: 'pago', pagoEm: '2026-11-12' }))?.rotulo).toBe('Boleto pago em 12/11');
    expect(boletosEfiDoBanco({ '2026-10': { status: 'cancelado' } })?.['2026-10'].status).toBe('cancelado');
  });
});
