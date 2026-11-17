import type { areaCliente as ac } from '@nads/core';
import { describe, expect, it } from 'vitest';
import type { ItemDaBiblioteca } from './biblioteca';
import { documentosRecentes, guiasDoInicio } from './inicioSimples';

const hoje = new Date(2026, 10, 17, 10, 0);
const guia = (id: string, vencimento: string): ac.GuiaDoCliente =>
  ({ id, tipo: 'FGTS', competencia: '2026-10', vencimento, valor: 100, situacao: 'a vencer', temPdf: true });

describe('guiasDoInicio (17/11/2026: a tela inicial simples)', () => {
  it('a vencida primeiro, depois a de hoje, depois as outras pela data; os meses passados ficam de fora', () => {
    const r = guiasDoInicio([guia('dez', '20/12/2026'), guia('nov', '20/11/2026'), guia('hoje', '17/11/2026'), guia('venc', '12/11/2026'), guia('out', '20/10/2026')], hoje);
    expect(r.itens.map(i => [i.guia.id, i.quando, i.tom])).toEqual([
      ['venc', 'Venceu 12/11', 'vencida'], ['hoje', 'Vence hoje', 'hoje'], ['nov', 'Vence 20/11', ''], ['dez', 'Vence 20/12', ''],
    ]);
    expect(r.quantas).toBe(4);
    // o número grande, estilo saldo de banco: todas as do momento, a vencida também
    expect(r.total).toBe(400);
    expect(r.vencidas).toBe(1);
  });
  it('até o limite, com quantas há ao todo', () => {
    const r = guiasDoInicio([guia('a', '20/11/2026'), guia('b', '21/11/2026'), guia('c', '22/11/2026')], hoje, 2);
    expect(r.itens.map(i => i.guia.id)).toEqual(['a', 'b']);
    expect(r.quantas).toBe(3);
    expect(r.total).toBe(300);
  });
  it('sem guia: lista vazia', () => {
    expect(guiasDoInicio([], hoje)).toEqual({ itens: [], quantas: 0, total: 0, vencidas: 0 });
  });
});

const doc = (chave: string, tipo: ItemDaBiblioteca['origem']['tipo'], data: string, novo = false, abre = true): ItemDaBiblioteca =>
  ({ chave, pasta: 'dp', nome: chave, detalhe: '', mes: data.slice(0, 7), data, formato: 'PDF', novo, abre, origem: { tipo, id: chave } });

describe('documentosRecentes', () => {
  it('sem guias e sem o que o cliente enviou; o novo primeiro, depois o mais recente', () => {
    const r = documentosRecentes([
      doc('guia', 'guia', '2026-11-10'), doc('enviado', 'envio', '2026-11-16', false, false),
      doc('folha', 'dp', '2026-11-05'), doc('danfe', 'danfe', '2026-11-12'), doc('contrato', 'escritorio', '2026-10-01', true),
    ]);
    expect(r.itens.map(i => i.chave)).toEqual(['contrato', 'danfe', 'folha']);
    expect(r.novos).toBe(1);
  });
  it('até o limite', () => {
    const r = documentosRecentes([doc('a', 'dp', '2026-11-01'), doc('b', 'dp', '2026-11-02'), doc('c', 'dp', '2026-11-03')], 2);
    expect(r.itens.map(i => i.chave)).toEqual(['c', 'b']);
  });
});
