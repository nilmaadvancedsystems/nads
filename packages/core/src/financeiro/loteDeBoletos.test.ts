import { describe, expect, it } from 'vitest';
import type { ContratoDeHonorario, RecebimentoDeHonorario } from './honorarios';
import { acharClienteDoBoleto, acharContratoDoBoleto, codigoDoArquivoDoBoleto, conferirBoleto, documentosDoBoleto, sacadosDoBoleto, resumoDoLote, separarEmails, type BoletoDoLote, type ContextoDoLote } from './loteDeBoletos';

const contrato = (id: string, nome: string, cnpj: string, extra: Partial<ContratoDeHonorario> = {}): ContratoDeHonorario =>
  ({ id, clienteId: '', codigo: id, nome, cnpj, valor: 500, ativo: true, criadoEm: '', criadoPor: '', ...extra });
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

describe('documentosDoBoleto', () => {
  it('o CNPJ do sacado no boleto do Alterdata, com a pontuação', () => {
    const t = 'SACADO SACADOR/AVALISTA VS MEDICINA ESPECIALIZADA LTDA CNPJ/CPF: 49.118.974/0001-63 RUA SAO VICENTE, 284 - CENTRO 39990-000';
    expect(documentosDoBoleto(t)).toEqual(['49118974000163']);
  });
  it('sem pontuação, o CPF, e sem repetir', () => {
    expect(documentosDoBoleto('CNPJ 49118974000163 ... CNPJ: 49.118.974/0001-63 CPF: 123.456.789-09')).toEqual(['49118974000163', '12345678909']);
  });
  it('o CPF seguido do CEP fica só com o CPF', () => {
    expect(documentosDoBoleto('CPF: 123.456.789-09 39990-000 Águas Vermelhas')).toEqual(['12345678909']);
  });
  it('não pega pedaço da linha digitável nem número sem a palavra', () => {
    expect(documentosDoBoleto('75691.31449 01129.611602 01494.290016 3 16320000035000')).toEqual([]);
  });
});

// o texto de um boleto do Alterdata Pack como o leitor de PDF devolve (inventado, no mesmo jeito do real; 10/11/2026)
const BOLETO = 'VALOR DO DOCUMENTO  450,00  SACADO  ALFA COMERCIO EXEMPLO LTDA  NOSSO NÚMERO  00100001  CEDENTE  VENCIMENTO  16/11/2026 '
  + '11111.11111 22222.222222 33333.333333 4 16320000045000 SACADO SACADOR/AVALISTA  ALFA COMERCIO EXEMPLO LTDA   CNPJ/CPF: 11.222.333/0001-81 '
  + 'RUA DAS FLORES, 10 - CENTRO 39000-000 - Cidade Exemplo - MG NILMA DIAS OLIVEIRA';
const clientes = [
  { codigo: 101, nome: 'ALFA COMERCIO EXEMPLO LTDA', documento: '11222333000181' },
  { codigo: 102, nome: 'ALFA C FILHO & CIA LTDA', documento: '44555666000199' },
  { codigo: 103, nome: 'BETA FLORESTAL EXEMPLO LTDA', documento: '' },
];

describe('codigoDoArquivoDoBoleto', () => {
  it('o código do cliente no começo do nome do Alterdata', () => {
    expect(codigoDoArquivoDoBoleto('00103_10001_16-11-2026.PDF')).toBe(103);
    expect(codigoDoArquivoDoBoleto('C:\\Downloads\\00101_10002_16-11-2026.pdf')).toBe(101);
  });
  it('outro jeito de nome não tem código', () => {
    expect(codigoDoArquivoDoBoleto('Boleto BETA FLORESTAL.pdf')).toBeNull();
    expect(codigoDoArquivoDoBoleto('2026-11-16.pdf')).toBeNull();
    expect(codigoDoArquivoDoBoleto('00000_1_x.pdf')).toBeNull();
  });
});

describe('sacadosDoBoleto', () => {
  it('o sacado do recibo e o da ficha, sem repetir', () => expect(sacadosDoBoleto(BOLETO)).toEqual(['ALFA COMERCIO EXEMPLO LTDA']));
  it('o pagador de outros bancos', () => expect(sacadosDoBoleto('Pagador: ALFA COMERCIO LTDA CNPJ 11.222.333/0001-81')).toEqual(['ALFA COMERCIO LTDA']));
});

describe('acharClienteDoBoleto (entre os clientes do escritório)', () => {
  it('pelo CNPJ do sacado, mesmo com o código de outro no nome do arquivo', () => {
    expect(acharClienteDoBoleto(BOLETO, '00102_1_16-11-2026.PDF', clientes)).toEqual({ codigo: 101, achadoPor: 'documento' });
  });
  it('sem o CNPJ no cadastro, pelo código no nome do arquivo', () => {
    const t = 'SACADO  BETA FLORESTAL EXEMPLO LTDA  NOSSO NÚMERO 00100003 SACADO SACADOR/AVALISTA  BETA FLORESTAL EXEMPLO LTDA   CNPJ/CPF: 77.888.999/0001-55';
    expect(acharClienteDoBoleto(t, '00103_10001_16-11-2026.PDF', clientes)).toEqual({ codigo: 103, achadoPor: 'nome' });
  });
  it('o código do arquivo não vale quando o sacado impresso é outro cliente', () => {
    const semCnpj = clientes.map(c => ({ ...c, documento: '' }));
    expect(acharClienteDoBoleto(BOLETO, '00102_1_16-11-2026.PDF', semCnpj)).toEqual({ codigo: 101, achadoPor: 'nome' });
  });
  it('sem CNPJ e sem código, pelo nome do sacado', () => {
    expect(acharClienteDoBoleto(BOLETO, 'boleto.pdf', clientes.map(c => ({ ...c, documento: '' })))).toEqual({ codigo: 101, achadoPor: 'nome' });
  });
  it('o CNPJ da Nilma (o cedente) não conta', () => {
    expect(acharClienteDoBoleto('CNPJ: 27.872.981/0001-50', 'x.pdf', [{ codigo: 1, nome: 'NILMA', documento: '27872981000150' }])).toBeNull();
  });
  it('código que não é de cliente nenhum, sem CNPJ e sem nome: fica para a pessoa', () => {
    expect(acharClienteDoBoleto('', '00999_1_16-11-2026.PDF', clientes)).toBeNull();
  });
});

describe('conferirBoleto', () => {
  it('tudo certo fica pronto', () => {
    expect(conferirBoleto(boleto(), ctx())).toEqual({ situacao: 'pronto', pendencias: [], avisos: [], podeDisparar: true });
  });
  it('o vencimento é o do PDF: qualquer dia, sem aviso (10/11/2026: "não ligando pro cadastro")', () => {
    for (const vencimento of ['2026-11-06', '2026-11-15', '2026-12-28']) {
      expect(conferirBoleto(boleto({ vencimento }), ctx())).toEqual({ situacao: 'pronto', pendencias: [], avisos: [], podeDisparar: true });
    }
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
