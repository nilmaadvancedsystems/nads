import { describe, expect, it } from 'vitest';
import {
  assuntoDoPedido, competenciaDoPedido, competenciasPorExtenso, linkDoWhatsApp, telefoneParaWhatsApp, textoDoPedido, type PedidoDeExtratos,
} from './pedido';

const pedido: PedidoDeExtratos = {
  cliente: 'FITO INDUSTRIA',
  bancos: [{ nome: 'Sicoob', conta: 'Ag. 3069 · C/C 1234-5' }, { nome: 'Itaú' }],
  competencias: ['2026-08', '2026-07'],
};

describe('pedir extratos', () => {
  it('competências por extenso', () => {
    expect(competenciasPorExtenso(['2026-08'])).toBe('agosto/2026');
    expect(competenciasPorExtenso(['2026-08', '2026-07'])).toBe('julho e agosto/2026');
    expect(competenciasPorExtenso(['2026-08', '2026-06', '2026-07'])).toBe('junho, julho e agosto/2026');
    expect(competenciasPorExtenso(['2026-01', '2025-12'])).toBe('dezembro/2025 e janeiro/2026');
  });

  it('o e-mail: assunto, uma linha "- Extrato bancário" por banco (vira cartão no robô) e a competência mais nova', () => {
    expect(assuntoDoPedido(pedido)).toBe('Extratos bancários de julho e agosto/2026 - FITO INDUSTRIA');
    const t = textoDoPedido(pedido, 'email');
    expect(t).toContain('- Extrato bancário Sicoob (Ag. 3069 · C/C 1234-5) - julho e agosto/2026');
    expect(t).toContain('- Extrato bancário Itaú - julho e agosto/2026');
    expect(t.split('\n').filter(l => l.startsWith('- '))).toHaveLength(2);
    expect(competenciaDoPedido(pedido)).toBe('2026-08');
  });

  it('o WhatsApp: texto com "•", sem as linhas do e-mail', () => {
    const t = textoDoPedido({ ...pedido, bancos: [pedido.bancos[0]], competencias: ['2026-08'] }, 'whatsapp');
    expect(t).toContain('do extrato bancário:');
    expect(t).toContain('• Sicoob (Ag. 3069 · C/C 1234-5)');
    expect(t).not.toContain('- Extrato');
  });

  it('telefone do cadastro para o wa.me', () => {
    expect(telefoneParaWhatsApp('(38) 99999-1234')).toBe('5538999991234');
    expect(telefoneParaWhatsApp('38 3333-1234')).toBe('553833331234');
    expect(telefoneParaWhatsApp('+55 38 99999-1234')).toBe('5538999991234');
    expect(telefoneParaWhatsApp('1234')).toBe('');
    expect(linkDoWhatsApp('(38) 99999-1234', 'Olá & tchau')).toBe('https://wa.me/5538999991234?text=Ol%C3%A1%20%26%20tchau');
  });
});
