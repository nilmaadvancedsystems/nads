import { describe, expect, it } from 'vitest';
import type { ContratoDeHonorario, RecebimentoDeHonorario } from './honorarios';
import { acharContratoDoBoleto, conferirBoleto, resumoDoLote, separarEmails, vencimentoDoContrato, type BoletoDoLote, type ContextoDoLote } from './loteDeBoletos';

const contrato = (id: string, nome: string, cnpj: string, extra: Partial<ContratoDeHonorario> = {}): ContratoDeHonorario =>
  ({ id, clienteId: '', codigo: id, nome, cnpj, valor: 500, ativo: true, diaVencimento: 10, criadoEm: '', criadoPor: '', ...extra });
const alfa = contrato('a', 'ALFA COMERCIO LTDA', '11222333000181');
const beta = contrato('b', 'BETA SERVICOS LTDA', '44555666000199');
const boleto = (extra: Partial<BoletoDoLote> = {}): BoletoDoLote => ({
  id: '1', competencia: '2026-10', arquivo: 'x.pdf', contratoId: 'a', achadoPor: 'documento', linha: '1'.repeat(47), valor: 500, vencimento: '2026-11-10', destinatarios: ['a@b.com.br'], ...extra,
});
const ctx = (extra: Partial<ContextoDoLote> = {}): ContextoDoLote => ({ contratos: [alfa, beta], recebimentos: [], boletos: [], hoje: '2026-11-05', ...extra });

describe('acharContratoDoBoleto', () => {
  it('acha pelo CNPJ com ou sem pontuação', () => {
    expect(acharContratoDoBoleto('Pagador: FULANO 11.222.333/0001-81', 'x.pdf', [alfa, beta])).toEqual({ contratoId: 'a', achadoPor: 'documento' });
    expect(acharContratoDoBoleto('CNPJ 44555666000199', 'x.pdf', [alfa, beta])).toEqual({ contratoId: 'b', achadoPor: 'documento' });
  });
  it('não confunde o CNPJ com um pedaço de um número maior', () => {
    expect(acharContratoDoBoleto('99911222333000181999', 'x.pdf', [alfa, beta])).toBeNull();
  });
  it('sem o documento, acha pelo nome no texto ou no arquivo', () => {
    expect(acharContratoDoBoleto('Pagador ALFA COMÉRCIO LTDA', 'x.pdf', [alfa, beta])).toEqual({ contratoId: 'a', achadoPor: 'nome' });
    expect(acharContratoDoBoleto('', 'Boleto - beta servicos ltda.pdf', [alfa, beta])).toEqual({ contratoId: 'b', achadoPor: 'nome' });
  });
  it('dois clientes no mesmo PDF ficam para a pessoa', () => {
    expect(acharContratoDoBoleto('11222333000181 e 44555666000199', 'x.pdf', [alfa, beta])).toBeNull();
  });
  it('ignora o contrato parado', () => {
    expect(acharContratoDoBoleto('11222333000181', 'x.pdf', [{ ...alfa, ativo: false }])).toBeNull();
  });
});

describe('vencimentoDoContrato', () => {
  it('é o dia no mês seguinte à competência', () => {
    expect(vencimentoDoContrato(10, '2026-10')).toBe('2026-11-10');
    expect(vencimentoDoContrato(5, '2026-12')).toBe('2027-01-05');
  });
  it('usa o último dia do mês curto', () => expect(vencimentoDoContrato(31, '2026-01')).toBe('2026-02-28'));
  it('sem dia não há data', () => expect(vencimentoDoContrato(undefined, '2026-10')).toBe(''));
});

describe('conferirBoleto', () => {
  it('tudo certo fica pronto', () => {
    expect(conferirBoleto(boleto(), ctx())).toEqual({ situacao: 'pronto', pendencias: [], avisos: [], podeDisparar: true });
  });
  it('vencimento diferente do cadastro avisa e não trava: vale o PDF', () => {
    const c = conferirBoleto(boleto({ vencimento: '2026-11-15' }), ctx());
    expect(c.situacao).toBe('conferir');
    expect(c.podeDisparar).toBe(true);
    expect(c.avisos[0]).toContain('Vale o do PDF');
  });
  it('valor diferente do honorário avisa e não trava', () => {
    const c = conferirBoleto(boleto({ valor: 650 }), ctx());
    expect(c.situacao).toBe('conferir');
    expect(c.podeDisparar).toBe(true);
  });
  it('trava sem cliente, sem leitura, sem e-mail, com e-mail inválido e vencido', () => {
    expect(conferirBoleto(boleto({ contratoId: '' }), ctx()).podeDisparar).toBe(false);
    expect(conferirBoleto(boleto({ linha: '', valor: null, vencimento: null }), ctx()).podeDisparar).toBe(false);
    expect(conferirBoleto(boleto({ destinatarios: [] }), ctx()).pendencias).toContain('O cliente não tem e-mail cadastrado.');
    expect(conferirBoleto(boleto({ destinatarios: ['sem-arroba'] }), ctx()).podeDisparar).toBe(false);
    expect(conferirBoleto(boleto({ vencimento: '2026-11-01' }), ctx()).podeDisparar).toBe(false);
  });
  it('trava o honorário já recebido', () => {
    const r = { contratoId: 'a', competencia: '2026-10' } as RecebimentoDeHonorario;
    expect(conferirBoleto(boleto(), ctx({ recebimentos: [r] })).podeDisparar).toBe(false);
  });
  it('trava dois boletos do mesmo cliente e quem já recebeu no mês', () => {
    const outro = boleto({ id: '2' });
    expect(conferirBoleto(boleto(), ctx({ boletos: [outro] })).pendencias).toContain('Há outro boleto deste cliente no lote: deixe só um.');
    const enviado = boleto({ id: '2', envio: { status: 'enviado', para: [], em: '', por: '' } });
    expect(conferirBoleto(boleto(), ctx({ boletos: [enviado] })).pendencias[0]).toContain('já recebeu');
    expect(conferirBoleto(boleto(), ctx({ boletos: [{ ...outro, fora: true }] })).podeDisparar).toBe(true);
  });
  it('quem deu erro pode tentar de novo; quem saiu ou está na fila não dispara', () => {
    const erro = conferirBoleto(boleto({ envio: { status: 'erro', para: [], em: '', por: '', erro: 'x' } }), ctx());
    expect(erro).toMatchObject({ situacao: 'erro', podeDisparar: true });
    expect(conferirBoleto(boleto({ envio: { status: 'enviado', para: [], em: '', por: '' } }), ctx()).podeDisparar).toBe(false);
    expect(conferirBoleto(boleto({ envio: { status: 'fila', para: [], em: '', por: '' } }), ctx()).podeDisparar).toBe(false);
    expect(conferirBoleto(boleto({ fora: true }), ctx())).toMatchObject({ situacao: 'fora', podeDisparar: false });
  });
});

describe('resumoDoLote', () => {
  it('conta sem o que saiu do lote e soma só o que vai sair', () => {
    const c = ctx();
    const linhas = [boleto(), boleto({ id: '2', contratoId: 'b', valor: 300.1 }), boleto({ id: '3', contratoId: '' }), boleto({ id: '4', fora: true }), boleto({ id: '5', contratoId: 'b', competencia: '2026-09', envio: { status: 'enviado', para: [], em: '', por: '' } })]
      .map(b => ({ boleto: b, conferencia: conferirBoleto(b, c) }));
    expect(resumoDoLote(linhas)).toEqual({ total: 4, prontos: 1 + 1, pendentes: 1, enviados: 1, aDisparar: 800.1 });
  });
});

describe('separarEmails', () => {
  it('separa, junta iguais e põe em minúsculas', () => expect(separarEmails(' A@b.com; c@d.com,a@B.com ')).toEqual(['a@b.com', 'c@d.com']));
});
