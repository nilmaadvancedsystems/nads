import { describe, expect, it } from 'vitest';
import { primeirosPassos, type Guardado } from './primeirosPassos';

const TODAS = ['inicio', 'documentos', 'guias', 'dp', 'chamados', 'faturamento', 'empresa', 'contato'];
const NADA: Guardado = { vistas: [], tour: false, oculto: false };

// 15/11/2026: "Pode fazer" (a lista de primeiros passos na Visão geral)
describe('os primeiros passos da Área do Cliente', () => {
  it('começa com os cinco itens, nenhum feito', () => {
    const r = primeirosPassos({ abas: TODAS, guardado: NADA, temEnvio: false, temPedido: false })!;
    expect(r.itens.map(i => i.id)).toEqual(['tour', 'guias', 'enviar', 'pedido', 'empresa']);
    expect(r.feitos).toBe(0);
  });
  it('marca pelo que já aconteceu: o tour, as telas abertas, o envio e o pedido', () => {
    const r = primeirosPassos({ abas: TODAS, guardado: { vistas: ['guias'], tour: true, oculto: false }, temEnvio: true, temPedido: false })!;
    expect(r.itens.filter(i => i.feito).map(i => i.id)).toEqual(['tour', 'guias', 'enviar']);
    expect(r.feitos).toBe(3);
  });
  it('sem as telas na área, os itens delas saem', () => {
    const r = primeirosPassos({ abas: ['inicio', 'documentos'], guardado: NADA, temEnvio: false, temPedido: false })!;
    expect(r.itens.map(i => i.id)).toEqual(['tour', 'enviar']);
  });
  it('some quando tudo está feito ou quando a pessoa oculta', () => {
    expect(primeirosPassos({ abas: TODAS, guardado: { vistas: ['guias', 'empresa'], tour: true, oculto: false }, temEnvio: true, temPedido: true })).toBeNull();
    expect(primeirosPassos({ abas: TODAS, guardado: { ...NADA, oculto: true }, temEnvio: false, temPedido: false })).toBeNull();
  });
});
