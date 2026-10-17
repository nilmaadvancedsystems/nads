import { describe, expect, it } from 'vitest';
import type { DocumentoDoCliente } from './areaCliente';
import {
  avisos, chaveDoMes, erroDaAdmissao, erroDaDemissao, erroDasFerias, filtrarDocumentos, juntarPedacosDoPdf, linkDoWhatsapp, situacaoDoCertificado, textoDaAdmissao,
} from './regras';

const hoje = new Date(2026, 9, 16, 9, 0);

describe('situacaoDoCertificado', () => {
  it('em ordem, perto de vencer e vencido', () => {
    expect(situacaoDoCertificado({ tipo: 'A1', titular: 'X', validoAte: '2027-03-14' }, hoje)).toMatchObject({ tom: 'ok', texto: 'válido até 14/03/2027.' });
    expect(situacaoDoCertificado({ tipo: 'A1', titular: 'X', validoAte: '2026-10-30' }, hoje)).toMatchObject({ tom: 'warn', dias: 14, texto: 'vence em 30/10/2026, daqui a 14 dias.' });
    expect(situacaoDoCertificado({ tipo: 'A1', titular: 'X', validoAte: '2026-10-16' }, hoje).texto).toBe('vence hoje.');
    expect(situacaoDoCertificado({ tipo: 'A1', titular: 'X', validoAte: '2026-10-15' }, hoje).tom).toBe('bad');
  });
});

describe('documentos', () => {
  const d = (id: string, nome: string, enviadoEm: string, novo = false): DocumentoDoCliente => ({ id, nome, descricao: '', area: 'contabil', competencia: '', enviadoEm, novo, formato: 'PDF' });
  const docs = [d('1', 'Balancete', '2026-09-28'), d('2', 'Folha de pagamento', '2026-10-03', true), d('3', 'Certidão negativa', '2026-09-15')];
  it('busca sem acento, os mais novos primeiro', () => {
    expect(filtrarDocumentos(docs, '').map(x => x.id)).toEqual(['2', '1', '3']);
    expect(filtrarDocumentos(docs, 'certidao').map(x => x.id)).toEqual(['3']);
  });
  it('os avisos da Visão geral: documentos novos, resposta do escritório e o certificado perto de vencer', () => {
    const a = avisos({
      documentos: docs,
      chamados: [{ id: 'c1', tipo: 'duvida', titulo: 'Férias do João', situacao: 'respondido', mensagens: [] }, { id: 'c2', tipo: 'duvida', titulo: 'Outro', situacao: 'aberto', mensagens: [] }],
      certificado: { tipo: 'A1', titular: 'X', validoAte: '2026-11-01' },
    }, hoje);
    expect(a.map(x => x.texto)).toEqual(['Um documento novo do escritório.', 'O escritório respondeu: Férias do João.', 'Certificado digital: vence em 01/11/2026, daqui a 16 dias.']);
    expect(avisos({ documentos: [], chamados: [], certificado: null }, hoje)).toEqual([]);
  });
});

describe('pedidos do pessoal', () => {
  it('admissão: confere e monta o texto do chamado só com o que foi preenchido', () => {
    const p = { nome: 'Maria Souza', cpf: '', cargo: 'Auxiliar', salario: 'R$ 2.000,00', inicio: '01/11/2026', contrato: 'Experiência', observacoes: '' };
    expect(erroDaAdmissao({ ...p, inicio: '1/11' })).toContain('data de início');
    expect(erroDaAdmissao(p)).toBe('');
    const t = textoDaAdmissao(p);
    expect(t.split('\n')[0]).toBe('Admissão: Maria Souza (Auxiliar)');
    expect(t).toContain('Salário: R$ 2.000,00');
    expect(t).not.toContain('CPF');
  });
  it('férias e demissão pedem o funcionário e a data', () => {
    expect(erroDasFerias({ empregado: '', inicio: '', dias: '30', adiantar13: false, observacoes: '' })).toContain('funcionário');
    expect(erroDaDemissao({ empregado: 'João', ultimoDia: '31/10/2026', motivo: '', aviso: '', observacoes: '' })).toContain('motivo');
  });
});

describe('chaveDoMes e linkDoWhatsapp', () => {
  it('aaaa-mm com o mês em dois dígitos', () => {
    expect(chaveDoMes(new Date(2026, 9, 16))).toBe('2026-10');
    expect(chaveDoMes(new Date(2026, 0, 31))).toBe('2026-01');
  });
  it('o WhatsApp só com os dígitos e o 55 na frente', () => {
    expect(linkDoWhatsapp('(31) 99999-0000')).toBe('https://wa.me/5531999990000');
    expect(linkDoWhatsapp('+55 31 99999-0000')).toBe('https://wa.me/5531999990000');
    expect(linkDoWhatsapp('')).toBe('');
    expect(linkDoWhatsapp('3333')).toBe('');
  });
});

describe('juntarPedacosDoPdf', () => {
  const b64 = (t: string) => btoa(t);
  it('junta de 0 a total-1 na ordem, mesmo vindo fora de ordem', async () => {
    const pdf = juntarPedacosDoPdf([{ base64: b64('meio-'), n: 1, total: 3 }, { base64: b64('%PDF-'), n: 0, total: 3 }, { base64: b64('fim'), n: 2, total: 3 }]);
    expect(pdf?.type).toBe('application/pdf');
    expect(await pdf!.text()).toBe('%PDF-meio-fim');
  });
  it('recusa quando falta pedaço, começa em 1 ou o total não bate', () => {
    expect(juntarPedacosDoPdf([])).toBeNull();
    expect(juntarPedacosDoPdf([{ base64: b64('a'), n: 0, total: 2 }])).toBeNull();
    expect(juntarPedacosDoPdf([{ base64: b64('a'), n: 1, total: 2 }, { base64: b64('b'), n: 2, total: 2 }])).toBeNull();
    expect(juntarPedacosDoPdf([{ base64: b64('a'), n: 0, total: 2 }, { base64: b64('b'), n: 1, total: 3 }])).toBeNull();
  });
});
