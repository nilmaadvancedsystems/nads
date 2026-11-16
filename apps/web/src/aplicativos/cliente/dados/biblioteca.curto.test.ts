// A linha de baixo enxuta da Central de documentos (16/11/2026: "muita informação").
import { describe, expect, it } from 'vitest';
import type { areaCliente as ac } from '@nads/core';
import { bibliotecaDoCliente, detalheCurto } from './biblioteca';

const CHAVE = '31261011222333000181550010000018421123456789';
const guia: ac.GuiaDoCliente = { id: 'g1', tipo: 'DAE', competencia: '2026-10', vencimento: '24/11/2026', valor: 432.1, situacao: 'a vencer', temPdf: true };
const itens = bibliotecaDoCliente({
  guias: [guia],
  documentosDp: [
    { tipo: 'dp', id: 'd1', nome: 'Folha de pagamento 10-2026.pdf', categoria: 'folha', competencia: '2026-10', tamanho: 100, funcionario: '', partes: 1 },
    { tipo: 'dp', id: 'd2', nome: 'Recibo Ana.pdf', categoria: 'recibo', competencia: '2026-10', tamanho: 100, funcionario: 'f2', partes: 1 },
  ],
  danfes: [{ id: 'danfe-' + CHAVE, nome: 'DANFE 1842.pdf', chave: CHAVE, atualizadoEm: '2026-11-12T10:00:00Z' }],
  documentos: [],
  envios: [{ id: 'e1', nome: 'extrato-sicoob.pdf', tipo: 'extrato', tamanho: 1000, recebidoEm: '2026-11-05T12:00:00Z' }],
});
const curto = (nome: string) => detalheCurto(itens.find(i => i.nome === nome)!);

describe('a linha de baixo enxuta da Central', () => {
  it('a guia: só o valor (o vencimento já está na coluna da data; o tipo já está no nome)', () => {
    expect(curto('Guia DAE 10/2026')).toBe('R$\u00a0432,10');
  });

  it('o DP: só a categoria (sem o "referente a", sem o id interno do funcionário) e nada se ela repete o nome', () => {
    expect(curto('Folha de pagamento 10-2026')).toBe('');
    expect(curto('Recibo Ana')).toBe('Recibos de pagamento');
  });

  it('a nota: o modelo, sem o número (está no nome) e sem a série', () => {
    expect(curto('DANFE 1842')).toBe('NF-e');
  });

  it('o enviado: o tipo, sem o "recebido pelo escritório em" (o Recebido já está no fim)', () => {
    expect(curto('extrato-sicoob')).toBe('Extrato do banco');
  });

  it('o do escritório fica como está; o detalhe completo não muda (a busca usa ele)', () => {
    expect(detalheCurto({ pasta: 'escritorio', nome: 'Notas fiscais de saída', detalhe: 'Fiscal · Os XML das notas' })).toBe('Fiscal · Os XML das notas');
    expect(itens.find(i => i.pasta === 'guias')?.detalhe).toContain('vence em 24/11');
  });
});
