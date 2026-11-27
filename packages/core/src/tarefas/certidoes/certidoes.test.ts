// A certidão municipal de Taiobeiras e o lote do dia (27/11/2026). Dados inventados, no desenho da certidão real.
import { describe, expect, it } from 'vitest';
import { certidaoFgtsDoTexto, certidaoMunicipalDoTexto, certidoesParaPedir, nomeDoPdfDaCertidao, somarDias, type CertidoesDaEmpresa } from './index';

const NEGATIVA = 'PREFEITURA MUNICIPAL DE TAIOBEIRAS CNPJ: 18.677.591/0001-00 - Estado de Minas Gerais SECRETARIA DA FAZENDA '
  + 'CERTIDÃO NEGATIVA DE DÉBITOS Nº 1234/2026 Certifico, para os devido fins que: PADARIA FICTICIA LTDA CPF/CNPJ: 99.888.777/0001-66 '
  + 'Endereço: Rua Inventada Nº000100 - - CENTRO - Taiobeiras-MG CEP: 39550-000 Que em nome do(s) requerentes(s), até a presente data, '
  + 'não existe nesta repartição qualquer dívida referente a tributos municipais. Ressalvando o direito da Fazenda Municipal, de cobrar as '
  + 'dívidas que venham a ser apuradas, conforme Código Tributário Municipal Chave de Validação WEB: ab12cd34 '
  + 'Prefeitura Municipal de Taiobeiras, sexta-feira, 27 de novembro de 2026 VALIDADE: 90 dias';

describe('a certidão municipal de Taiobeiras', () => {
  it('lê número, CNPJ, nome, emissão, validade, vencimento e chave', () => {
    expect(certidaoMunicipalDoTexto(NEGATIVA)).toEqual({
      orgao: 'municipal', numero: '1234/2026', cnpj: '99888777000166', nome: 'PADARIA FICTICIA LTDA', emitidaEm: '2026-11-27',
      validadeDias: 90, vence: '2027-02-25', chave: 'ab12cd34', negativa: true,
    });
  });
  it('o texto com os acentos trocados (a página lida em outra codificação) também serve', () => {
    expect(certidaoMunicipalDoTexto(NEGATIVA.replace(/Ã/g, '�').replace(/ã/g, '�'))?.vence).toBe('2027-02-25');
  });
  it('a positiva fica marcada', () => {
    const positiva = NEGATIVA.replace('CERTIDÃO NEGATIVA DE DÉBITOS', 'CERTIDÃO POSITIVA DE DÉBITOS').replace('não existe nesta repartição qualquer dívida', 'constam débitos');
    expect(certidaoMunicipalDoTexto(positiva)?.negativa).toBe(false);
    expect(nomeDoPdfDaCertidao({ vence: '2027-02-25', emitidaEm: '2026-11-27', negativa: false })).toBe('CND - MUNICIPAL - Venc. 25.02.2027 (POSITIVA).pdf');
  });
  it('sem a data de emissão não é a certidão', () => {
    expect(certidaoMunicipalDoTexto('Prefeitura Municipal de Taiobeiras Código de emissão não informado!')).toBeNull();
    expect(certidaoMunicipalDoTexto('')).toBeNull();
  });
  it('o nome do PDF e a conta dos dias', () => {
    expect(nomeDoPdfDaCertidao({ vence: '2027-02-25', emitidaEm: '2026-11-27', negativa: true })).toBe('CND - MUNICIPAL - Venc. 25.02.2027.pdf');
    expect(somarDias('2026-12-25', 10)).toBe('2027-01-04');
  });
});

describe('o CRF do FGTS (27/11/2026)', () => {
  const CRF = 'Certificado de Regularidade do FGTS - CRF Inscrição: 99.888.777/0001-66 Razão social: PADARIA FICTICIA LTDA Endereço: RUA INVENTADA 100 / '
    + 'CENTRO / TAIOBEIRAS / MG / 39550-000 A Caixa Econômica Federal, no uso da atribuição que lhe confere o Art. 7, da Lei 8.036, de 11 de maio de 1990, '
    + 'certifica que, nesta data, a empresa acima identificada encontra-se em situação regular perante o Fundo de Garantia do Tempo de Serviço - FGTS. '
    + 'Validade: 09/11/2026 a 08/12/2026 Certificado Número: 2026110900000000000001 Informação obtida em 27/11/2026 15:48:55';
  it('lê a validade, o número, a inscrição e o nome', () => {
    expect(certidaoFgtsDoTexto(CRF)).toEqual({ orgao: 'fgts', numero: '2026110900000000000001', cnpj: '99888777000166', nome: 'PADARIA FICTICIA LTDA',
      emitidaEm: '2026-11-09', validadeDias: null, vence: '2026-12-08', chave: null, negativa: true });
    expect(nomeDoPdfDaCertidao({ orgao: 'fgts', vence: '2026-12-08', emitidaEm: '2026-11-09', negativa: true })).toBe('CRF - FGTS - Venc. 08.12.2026.pdf');
  });
  it('sem a validade não é o CRF', () => {
    expect(certidaoFgtsDoTexto('Situação de Regularidade do Empregador A empresa abaixo identificada esta REGULAR no FGTS.')).toBeNull();
  });
  it('o lote do FGTS: só o vencido ou vencendo amanhã (o CRF novo só sai quando o anterior vence)', () => {
    const resumos = new Map<number, CertidoesDaEmpresa>([[1, { codigo: 1, fgts: { numero: null, emitidaEm: '2026-11-09', vence: '2026-12-08', chave: null, negativa: true, consultadoEm: '' } }],
      [2, { codigo: 2, fgts: { numero: null, emitidaEm: '2026-10-30', vence: '2026-11-28', chave: null, negativa: true, consultadoEm: '' } }], [3, { codigo: 3, fgtsSemCadastro: '2026-11-20' }]]);
    const empresas = [1, 2, 3, 4].map(c => ({ codigo: c, nome: 'E' + c, cnpj: '9988877700010' + c }));
    expect(certidoesParaPedir({ empresas, resumos, naFila: new Set(), hoje: '2026-11-27', limite: 10, orgao: 'fgts' }).map(p => [p.codigo, p.orgao])).toEqual([[4, 'fgts'], [2, 'fgts']]);
  });
});

describe('o lote do dia', () => {
  const e = (codigo: number, cnpj = '99888777000' + String(100 + codigo).slice(-3)) => ({ codigo, nome: 'EMPRESA ' + codigo, cnpj });
  const r = (codigo: number, x: Partial<CertidoesDaEmpresa>): [number, CertidoesDaEmpresa] => [codigo, { codigo, ...x }];
  const mun = (vence: string) => ({ numero: null, emitidaEm: '2026-09-01', vence, chave: null, negativa: true, consultadoEm: '' });
  it('sem certidão ou vencendo em até 10 dias; sem quem a prefeitura não conhece nem quem está na fila', () => {
    const resumos = new Map([r(2, { municipal: mun('2026-12-05') }), r(3, { municipal: mun('2027-02-01') }), r(4, { municipalSemCadastro: '2026-11-20' }), r(6, { municipal: mun('2026-12-01') })]);
    const plano = certidoesParaPedir({ empresas: [e(1), e(2), e(3), e(4), e(5, '123'), e(6), e(7)], resumos, naFila: new Set([7]), hoje: '2026-11-27', limite: 10 });
    expect(plano.map(p => p.codigo)).toEqual([1, 6, 2]);
    expect(plano[0]).toEqual({ status: 'pendente', orgao: 'municipal', cnpj: '99888777000101', codigo: 1, empresa: 'EMPRESA 1' });
    expect(certidoesParaPedir({ empresas: [e(1), e(2), e(6)], resumos, naFila: new Set(), hoje: '2026-11-27', limite: 2 })).toHaveLength(2);
  });
});

describe('a CDT de Minas (27/11/2026; o formato real ainda será conferido)', () => {
  it('lê a validade, a emissão e o CNPJ pelos rótulos de costume', async () => {
    const { certidaoEstadualDoTexto } = await import('./index');
    const t = 'GOVERNO DO ESTADO DE MINAS GERAIS SECRETARIA DE ESTADO DE FAZENDA CERTIDÃO DE DÉBITOS TRIBUTÁRIOS NEGATIVA Certidão Nº 2026.000.111 '
      + 'CNPJ: 99.888.777/0001-66 Data de emissão: 27/11/2026 Válida até: 26/12/2026';
    expect(certidaoEstadualDoTexto(t)).toMatchObject({ orgao: 'estadual', cnpj: '99888777000166', emitidaEm: '2026-11-27', vence: '2026-12-26', negativa: true });
    expect(certidaoEstadualDoTexto(t.replace('NEGATIVA', 'POSITIVA'))?.negativa).toBe(false);
    expect(certidaoEstadualDoTexto('Login Único da SEF-MG')).toBeNull();
  });
});

describe('a CNDT do TST (27/11/2026)', () => {
  it('lê o número, a expedição, a validade e se é negativa', async () => {
    const { certidaoTrabalhistaDoTexto, nomeDoPdfDaCertidao } = await import('./index');
    const t = 'PODER JUDICIÁRIO JUSTIÇA DO TRABALHO CERTIDÃO NEGATIVA DE DÉBITOS TRABALHISTAS Nome: PADARIA FICTICIA LTDA (MATRIZ E FILIAIS) '
      + 'CNPJ: 99.888.777/0001-66 Certidão nº: 12345678/2026 Expedição: 27/11/2026, às 15:00:00 Validade: 26/05/2027 - 180 (cento e oitenta) dias, contados da data de sua expedição.';
    expect(certidaoTrabalhistaDoTexto(t)).toEqual({ orgao: 'trabalhista', numero: '12345678/2026', cnpj: '99888777000166', nome: 'PADARIA FICTICIA LTDA',
      emitidaEm: '2026-11-27', validadeDias: null, vence: '2027-05-26', chave: null, negativa: true });
    expect(certidaoTrabalhistaDoTexto(t.replace('CERTIDÃO NEGATIVA', 'CERTIDÃO POSITIVA'))?.negativa).toBe(false);
    expect(certidaoTrabalhistaDoTexto(t.replace('CERTIDÃO NEGATIVA', 'CERTIDÃO POSITIVA') + ' POSITIVA COM EFEITO DE NEGATIVA')?.negativa).toBe(true);
    expect(nomeDoPdfDaCertidao({ orgao: 'trabalhista', vence: '2027-05-26', emitidaEm: '2026-11-27', negativa: true })).toBe('CNDT - TRABALHISTA - Venc. 26.05.2027.pdf');
    expect(certidaoTrabalhistaDoTexto('Emissão de certidão de débito trabalhista')).toBeNull();
  });
});
