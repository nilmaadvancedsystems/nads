// A certidão municipal de Taiobeiras e o lote do dia (27/11/2026). Dados inventados, no desenho da certidão real.
import { describe, expect, it } from 'vitest';
import { certidaoMunicipalDoTexto, certidoesParaPedir, nomeDoPdfDaCertidao, somarDias, type CertidoesDaEmpresa } from './index';

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
