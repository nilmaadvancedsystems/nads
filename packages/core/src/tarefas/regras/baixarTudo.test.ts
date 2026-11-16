import { describe, expect, it } from 'vitest';
import { nomeDoZipDosDocumentos, nomesSemRepetir, recebeOsDocumentos } from './delegadas';

const quem = (uid: string) => ({ uid, nome: uid });
describe('baixar tudo em .zip (16/11/2026: "os documentos enviados para pessoa, dê a opção de quem recebeu")', () => {
  it('quem recebe: no envio, a pessoa para quem foram; no pedido, quem pediu; na tarefa comum, ninguém', () => {
    const t = { responsavel: quem('vitor'), criadaPor: quem('adi') };
    expect(recebeOsDocumentos({ ...t, tipo: 'envio' }, 'vitor')).toBe(true);
    expect(recebeOsDocumentos({ ...t, tipo: 'envio' }, 'adi')).toBe(false);
    expect(recebeOsDocumentos({ ...t, tipo: 'documentos' }, 'adi')).toBe(true);
    expect(recebeOsDocumentos({ ...t, tipo: 'documentos' }, 'vitor')).toBe(false);
    expect(recebeOsDocumentos({ ...t }, 'vitor')).toBe(false);
    expect(recebeOsDocumentos({ ...t, tipo: 'envio' }, '')).toBe(false);
  });
  it('o nome do .zip vem do cliente', () => {
    expect(nomeDoZipDosDocumentos({ titulo: 'Envio de documentos', clientes: [{ codigo: 389, nome: 'EMPRESA EXEMPLO LTDA' }] })).toBe('Documentos - 389 EMPRESA EXEMPLO LTDA.zip');
    expect(nomeDoZipDosDocumentos({ titulo: 'Envio de documentos', clientes: [{ codigo: null, nome: 'A/B: avulso' }] })).toBe('Documentos - A B avulso.zip');
    expect(nomeDoZipDosDocumentos({ titulo: 'Envio de documentos', clientes: [] })).toBe('Envio de documentos.zip');
  });
  it('os nomes repetidos ganham um número', () => {
    expect(nomesSemRepetir(['extrato.pdf', 'Extrato.pdf', 'extrato.pdf', 'contrato', 'pasta/x.pdf'])).toEqual(['extrato.pdf', 'Extrato (2).pdf', 'extrato (3).pdf', 'contrato', 'pasta-x.pdf']);
  });
});
