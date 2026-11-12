// A Central de documentos como biblioteca (12/11/2026).
import { describe, expect, it } from 'vitest';
import type { areaCliente as ac } from '@nads/core';
import { bibliotecaDoCliente, contagemDasPastas, filtrarBiblioteca, formatoPeloNome, porMesDaBiblioteca } from './biblioteca';

const guia = (id: string, competencia: string, vencimento: string, temPdf = true): ac.GuiaDoCliente =>
  ({ id, tipo: 'FGTS', competencia, vencimento, valor: 917.42, situacao: 'a vencer', temPdf });
const dp = (id: string, competencia: string, nome: string, partes = 1): ac.DocumentoDoDp =>
  ({ tipo: 'dp', id, nome, categoria: 'folha', competencia, tamanho: 100, funcionario: '', partes });
const CHAVE = '31261011222333000181550010000018421123456789';

const itens = bibliotecaDoCliente({
  guias: [guia('g1', '2026-10', '15/11/2026'), guia('g2', '2026-10', '20/11/2026', false)],
  documentosDp: [dp('d1', '2026-10', 'Folha de pagamento 10-2026.pdf'), dp('d2', '2026-09', 'Ponto setembro.xlsx')],
  danfes: [{ id: 'danfe-' + CHAVE, nome: 'DANFE 1842.pdf', chave: CHAVE, atualizadoEm: '2026-11-12T10:00:00Z' }],
  documentos: [],
  envios: [{ id: 'e1', nome: 'extrato-sicoob.pdf', tipo: 'extrato', tamanho: 1000, recebidoEm: '2026-11-05T12:00:00Z' }],
});

describe('a biblioteca da Central de documentos', () => {
  it('junta as guias com PDF, o DP, as DANFEs e os enviados; do mês mais novo ao mais antigo', () => {
    expect(itens.map(i => [i.pasta, i.nome, i.mes])).toEqual([
      ['enviados', 'extrato-sicoob', '2026-11'],
      ['guias', 'Guia FGTS 10/2026', '2026-10'],
      ['notas', 'DANFE 1842', '2026-10'],
      ['dp', 'Folha de pagamento 10-2026', '2026-10'],
      ['dp', 'Ponto setembro', '2026-09'],
    ]);
    // o enviado pelo cliente não volta (não abre); o resto abre
    expect(itens.map(i => i.abre)).toEqual([false, true, true, true, true]);
    expect(itens.find(i => i.pasta === 'dp' && i.nome.startsWith('Ponto'))?.formato).toBe('XLSX');
  });

  it('as pastas contam; o filtro por pasta, mês e busca (sem acento)', () => {
    expect(contagemDasPastas(itens)).toEqual({ tudo: 5, guias: 1, dp: 2, notas: 1, escritorio: 0, enviados: 1 });
    expect(filtrarBiblioteca(itens, { pasta: 'dp', mes: '', busca: '' }).length).toBe(2);
    expect(filtrarBiblioteca(itens, { pasta: '', mes: '2026-10', busca: '' }).length).toBe(3);
    expect(filtrarBiblioteca(itens, { pasta: '', mes: '', busca: 'FOLHA' }).map(i => i.nome)).toEqual(['Folha de pagamento 10-2026', 'Ponto setembro']);
  });

  it('os grupos por mês e o formato pelo nome', () => {
    expect(porMesDaBiblioteca(itens).map(g => [g.mes, g.itens.length])).toEqual([['2026-11', 1], ['2026-10', 3], ['2026-09', 1]]);
    expect([formatoPeloNome('a.PDF'), formatoPeloNome('b.xls'), formatoPeloNome('c')]).toEqual(['PDF', 'XLSX', 'PDF']);
  });
});
