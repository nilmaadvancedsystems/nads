import { describe, expect, it } from 'vitest';
import { indiceDeContas, palavrasDoNome, rotuloDaSugestao, sugestaoDeConta } from './sugestaoDeConta';

// contas inventadas, no jeito do dinâmico (cada fornecedor uma conta; as filiais do mesmo fornecedor)
const IX = indiceDeContas([
  { codigo: '50101', descricao: 'Casa das Ferragens LTDA' },
  { codigo: '50201', descricao: 'PECAFORTE LTDA - FILIAL 01' },
  { codigo: '50202', descricao: 'PECAFORTE LTDA - FILIAL 02' },
  { codigo: '50301', descricao: 'METALURGICA ACORTE COMERCIO DE FERRO LTDA' },
  { codigo: '50401', descricao: 'Adiantamento Cassio' },
  { codigo: '24501', descricao: 'Seguros a Apropriar' },
]);

describe('a sugestão de conta do boleto no caixa (Vitor, 23/10/2026)', () => {
  it('o nome do histórico: sem o banco, a nota e a parcela', () => {
    expect(palavrasDoNome('14974551 DÉB.TIT.COMPE EFETIVADO Peçaforte NF 377579 1a3')).toEqual(['pecaforte']);
  });
  it('acha pelo nome, também abreviado; a que bate mais palavras ganha', () => {
    expect(rotuloDaSugestao(sugestaoDeConta('14974414 DÉB.TIT.COMPE EFETIVADO Casa Ferrags NF 509721 1a2', IX))).toBe('50101 — Casa das Ferragens LTDA');
    expect(sugestaoDeConta('DÉB.TIT.COMPE EFETIVADO Metalurgica Acort NF 655', IX).contas.map(c => c.codigo)).toEqual(['50301']);
  });
  it('as filiais do mesmo fornecedor: a primeira e quantas mais', () => {
    const s = sugestaoDeConta('DÉB.TIT.COMPE EFETIVADO Peçaforte NF 377579 1a3', IX);
    expect(s.total).toBe(2);
    expect(rotuloDaSugestao(s)).toBe('50201 — PECAFORTE LTDA - FILIAL 01 (+1)');
  });
  it('sem nome no histórico, ou a primeira palavra sem conta: nada', () => {
    expect(sugestaoDeConta('15509532 DÉB.CONV.ORGÃOS GOV.', IX).contas).toEqual([]);
    // "seguro" está na conta de seguros, mas quem recebeu (a primeira palavra) não tem conta
    expect(sugestaoDeConta('DÉB.TIT.COMPE EFETIVADO Transcorretora seguro carro 8a12', IX).contas).toEqual([]);
    expect(rotuloDaSugestao({ contas: [], total: 0 })).toBe('');
  });
});
