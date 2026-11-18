// Os comprovantes do Lançatudo (18/11/2026). Layouts no jeito dos bancos, dados fictícios.
import { describe, expect, it } from 'vitest';
import { casarComprovantes, lerComprovante, textoEmLinhas, textoParaAprender, textoParaAsRegras, type ComprovanteDoLancatudo } from './regras/comprovantes';
import { chaveLembrada } from './regras/motor';
import { adicionarComprovantes, comprovantesDoMes, configVazia, criarRegra, escolherConta, ligarComprovante, mesVazio, removerComprovante } from './regras/mudancas';
import { montarRegistro } from './regras/registro';
import { documentoDoMes, mesDoDocumento } from './regras/documento';

const PIX_ENVIADO = [
  'Comprovante de Pix', 'Pix enviado', 'Valor', 'R$ 1.250,00', 'Data do pagamento 05/09/2026 - 14:32',
  'Destino', 'Nome FORNECEDOR EXEMPLO LTDA', 'CNPJ 12.345.678/0001-90', 'Instituição BANCO EXEMPLO',
  'Origem', 'Nome EMPRESA PAGADORA LTDA', 'CNPJ 98.765.432/0001-10',
].join('\n');

const TED = [
  'COMPROVANTE DE TRANSFERÊNCIA - TED', 'Conta origem: 1234-5 EMPRESA PAGADORA LTDA',
  'Favorecido: MARIA DE SOUZA', 'CPF: 123.456.789-09', 'Banco: 001 Agência: 0001 Conta: 99999-9',
  'Valor da transferência: R$ 3.500,00', 'Data da transferência: 10/09/2026',
].join('\n');

const BOLETO = [
  'Comprovante de pagamento de boleto', 'Código de barras 34191.79001 01043.510047 91020.150008 1 10010000015000',
  'Beneficiário', 'ENERGIA EXEMPLO S.A.', 'CNPJ: 11.222.333/0001-81',
  'Pagador', 'EMPRESA PAGADORA LTDA', 'CNPJ: 98.765.432/0001-10',
  'Data de vencimento 08/09/2026', 'Data do pagamento 09/09/2026', 'Valor do documento R$ 150,00', 'Valor pago R$ 150,00',
].join('\n');

const PIX_RECEBIDO = [
  'Pix recebido', 'R$ 890,00', '12/09/2026 09:10',
  'De', 'CLIENTE EXEMPLO COMERCIO LTDA', 'CNPJ 44.555.666/0001-77',
  'Para', 'EMPRESA RECEBEDORA LTDA', 'CNPJ 98.765.432/0001-10',
].join('\n');

const DARF = ['Comprovante de Arrecadação', 'DARF', 'Código da receita 6106', 'Período de apuração 31/08/2026', 'Data de arrecadação 20/09/2026', 'Valor total R$ 412,33'].join('\n');

describe('ler o comprovante (18/11/2026: "com os comprovantes tem como saber o cliente")', () => {
  it('Pix enviado: o destino é o favorecido, não a origem', () => {
    expect(lerComprovante(PIX_ENVIADO)).toEqual({ data: '2026-09-05', valor: 125000, favorecido: 'FORNECEDOR EXEMPLO LTDA', documento: '12345678000190', tipo: 'pix' });
  });
  it('TED: o favorecido e o CPF dele', () => {
    expect(lerComprovante(TED)).toEqual({ data: '2026-09-10', valor: 350000, favorecido: 'MARIA DE SOUZA', documento: '12345678909', tipo: 'transferencia' });
  });
  it('boleto: o beneficiário, a data do pagamento (não a do vencimento) e o valor pago', () => {
    expect(lerComprovante(BOLETO)).toEqual({ data: '2026-09-09', valor: 15000, favorecido: 'ENERGIA EXEMPLO S.A', documento: '11222333000181', tipo: 'boleto' });
  });
  it('Pix recebido: quem pagou é o cliente', () => {
    expect(lerComprovante(PIX_RECEBIDO)).toEqual({ data: '2026-09-12', valor: 89000, favorecido: 'CLIENTE EXEMPLO COMERCIO LTDA', documento: '44555666000177', tipo: 'pix', recebido: true });
  });
  it('guia: sem favorecido, o tipo guia', () => {
    expect(lerComprovante(DARF)).toMatchObject({ data: '2026-09-20', valor: 41233, tipo: 'guia', documento: '' });
  });
  it('sem valor não é comprovante', () => {
    expect(lerComprovante('Extrato de conta\nSaldo do dia')).toBeNull();
  });
  it('o texto do PDF em linhas, de cima para baixo e da esquerda para a direita', () => {
    const it = (texto: string, x: number, y: number) => ({ texto, x, y, largura: 10 });
    expect(textoEmLinhas([[it('R$ 10,00', 200, 700), it('Valor', 40, 701), it('Pix', 40, 750)]])).toBe('Pix\nValor R$ 10,00');
  });
});

describe('casar o comprovante com a linha do extrato', () => {
  const comp = (id: string, data: string, valor: number, extra: Partial<ComprovanteDoLancatudo> = {}): ComprovanteDoLancatudo =>
    ({ id, nome: id + '.pdf', data, valor, favorecido: '', documento: '', tipo: 'pix', em: '', por: '', ...extra });
  const linhas = [
    { chave: 'a', data: '2026-09-05', valor: -125000 },
    { chave: 'b', data: '2026-09-08', valor: -15000 },
    { chave: 'c', data: '2026-09-12', valor: 89000 },
    { chave: 'd', data: '2026-09-20', valor: -15000 },
  ];
  it('pelo valor e a data mais perto (até 3 dias), no sentido do comprovante; uma linha, um comprovante', () => {
    const m = casarComprovantes(linhas, [comp('pix', '2026-09-05', 125000), comp('bol', '2026-09-09', 15000), comp('rec', '2026-09-12', 89000, { recebido: true }), comp('longe', '2026-09-01', 15000)]);
    expect(Object.fromEntries([...m].map(([k, c]) => [k, c.id]))).toEqual({ a: 'pix', b: 'bol', c: 'rec' });
  });
  it('o Pix recebido não casa com a saída do mesmo valor', () => {
    expect(casarComprovantes([{ chave: 'x', data: '2026-09-12', valor: -89000 }], [comp('rec', '2026-09-12', 89000, { recebido: true })]).size).toBe(0);
  });
  it('a linha escolhida pela pessoa vale mais', () => {
    const m = casarComprovantes(linhas, [comp('bol', '2026-09-09', 15000, { linha: 'd' })]);
    expect(m.get('d')?.id).toBe('bol');
    expect(m.has('b')).toBe(false);
  });
});

describe('o comprovante ajuda a achar a conta', () => {
  it('as regras olham o nome e o CPF/CNPJ do comprovante; o aprendido, o CPF/CNPJ na frente', () => {
    const c = { favorecido: 'FORNECEDOR EXEMPLO LTDA', documento: '12345678000190' };
    expect(textoParaAsRegras('PIX EMIT', c)).toBe('PIX EMIT FORNECEDOR EXEMPLO LTDA 12345678000190');
    expect(chaveLembrada(textoParaAprender('PIX EMIT FORNECEDOR', c), -100)).toBe('s:doc:12345678000190');
    // sem o documento no comprovante, a chave continua a do histórico do banco
    expect(textoParaAprender('PIX EMIT FORNECEDOR', { documento: '' })).toBe('PIX EMIT FORNECEDOR');
  });
});

describe('o comprovante no Registro e no mês', () => {
  const comp: ComprovanteDoLancatudo = { id: 'c1', nome: 'pix.pdf', data: '2026-09-05', valor: 125000, favorecido: 'FORNECEDOR EXEMPLO LTDA', documento: '12345678000190', tipo: 'pix', em: '', por: 'Ana' };
  const dados = { extrato: [{ data: '2026-09-05', valor: -125000, historico: 'PIX EMITIDO OUTRA IF' }], razaoDoMes: [], modelos: [], razaoInvertido: false };
  const base = { dados, banco: 'sicoob', contaDoBanco: '10503', decisoes: {}, plano: null };

  it('a regra de favorecido pelo CNPJ do comprovante dá a conta; a linha mostra quem é', () => {
    const config = criarRegra(configVazia(), { tipo: 'favorecido', expressao: '12.345.678/0001-90', sentido: 'saida', conta: '21101', comHistoricoDoExtrato: false }, new Date(), 'Ana');
    const [l] = montarRegistro({ ...base, config, comprovantes: [comp] });
    expect([l.conta, l.origem, l.comprovante?.favorecido, l.comprovante?.documento]).toEqual(['21101', 'regra', 'FORNECEDOR EXEMPLO LTDA', '12345678000190']);
    expect(montarRegistro({ ...base, config }).map(x => x.conta)).toEqual([null]);
  });

  it('o nads aprende pelo CNPJ do comprovante e usa no mês seguinte', () => {
    const [l] = montarRegistro({ ...base, config: configVazia(), comprovantes: [comp] });
    const { config } = escolherConta(mesVazio('2026-09'), configVazia(), 'sicoob', [l], '21101', new Date(), 'Ana');
    expect(Object.keys(config.lembradas)).toEqual(['s:doc:12345678000190']);
    const outubro = { ...dados, extrato: [{ data: '2026-10-06', valor: -9900, historico: 'PIX EMITIDO OUTRA IF' }] };
    const [o] = montarRegistro({ ...base, dados: outubro, config, comprovantes: [{ ...comp, id: 'c2', data: '2026-10-06', valor: 9900 }] });
    expect([o.conta, o.origem]).toEqual(['21101', 'lembrada']);
  });

  it('guardar: o mesmo arquivo não entra duas vezes; ligar à mão; vai e volta do banco', () => {
    const r = adicionarComprovantes(mesVazio('2026-09'), 'sicoob', [comp, { ...comp, id: 'c9' }]);
    expect(r.entraram).toBe(1);
    const mes = ligarComprovante(r.mes, 'sicoob', 'c1', 'k-1');
    expect(comprovantesDoMes(mes, 'sicoob')[0].linha).toBe('k-1');
    expect(mesDoDocumento(documentoDoMes(mes), '2026-09')).toEqual(mes);
    expect(comprovantesDoMes(removerComprovante(mes, 'sicoob', 'c1'), 'sicoob')).toEqual([]);
  });
});
