import { describe, expect, it } from 'vitest';
import { htmlDoPedido } from './email';
import { empresaNova } from './importacao';
import {
  assuntoDoPedido, competenciaDoPedido, competenciasPorExtenso, dataPorExtenso, documentosDoPedido, linkDoWhatsApp, prazoPadrao, registrarPedido,
  telefoneParaWhatsApp, textoDoPedido, textoDoWhatsApp, type PedidoDeExtratos,
} from './pedido';

const docs = documentosDoPedido([{ id: 'sicoob', nome: 'Sicoob', conta: 'Ag. 3069 · C/C 1234-5' }]);
const pedido: PedidoDeExtratos = { cliente: 'FITO INDUSTRIA', documentos: [docs[0], docs[1]], competencias: ['2026-08', '2026-07'] };

describe('pedir documentos', () => {
  it('os documentos: o extrato de cada banco (com o logo) e os de sempre', () => {
    expect(docs[0]).toMatchObject({ id: 'extrato:sicoob', nome: 'Extrato bancário · Sicoob (Ag. 3069 · C/C 1234-5)', banco: 'sicoob' });
    expect(docs.map(d => d.id)).toEqual(['extrato:sicoob', 'comprovantes', 'cartao', 'cred', 'aplicacao']);
  });

  it('competências, datas e prazo', () => {
    expect(competenciasPorExtenso(['2026-08'])).toBe('agosto/2026');
    expect(competenciasPorExtenso(['2026-08', '2026-07'])).toBe('julho e agosto/2026');
    expect(competenciasPorExtenso(['2026-01', '2025-12'])).toBe('dezembro/2025 e janeiro/2026');
    expect(dataPorExtenso(new Date(2026, 8, 30))).toBe('30 de setembro de 2026');
    expect(prazoPadrao(new Date(2026, 8, 30))).toBe('07/10/2026');
  });

  it('o e-mail: assunto, texto com uma linha "- " por documento, a competência mais nova', () => {
    expect(assuntoDoPedido(pedido)).toBe('Documentos de julho e agosto/2026 - FITO INDUSTRIA');
    const t = textoDoPedido(pedido, '10/10/2026');
    expect(t.split('\n').filter(l => l.startsWith('- '))).toEqual(['- Extrato bancário · Sicoob (Ag. 3069 · C/C 1234-5)', '- Comprovantes bancários']);
    expect(t).toContain('Prazo: até 10/10/2026.');
    expect(competenciaDoPedido(pedido)).toBe('2026-08');
  });

  it('o HTML: a manchete, os cartões com o logo do banco e o prazo', () => {
    const h = htmlDoPedido({ pedido, prazo: '10/10/2026', enviadoEm: new Date(2026, 8, 30), logo: 'https://x/logo.png', logoDoBanco: m => 'https://x/' + m + '.png' });
    expect(h).toContain('Hora de fechar julho e agosto.');
    expect(h).toContain('30 de setembro de 2026');
    expect(h).toContain('https://x/sicoob.png');
    expect(h).toContain('até&nbsp;10/10');
    expect(h).toContain('Julho e agosto/2026');
  });

  it('o WhatsApp: texto com "•"; o telefone do cadastro para o wa.me', () => {
    expect(textoDoWhatsApp(pedido, '')).toContain('• Comprovantes bancários');
    expect(telefoneParaWhatsApp('(38) 99999-1234')).toBe('5538999991234');
    expect(telefoneParaWhatsApp('38 3333-1234')).toBe('553833331234');
    expect(telefoneParaWhatsApp('1234')).toBe('');
    expect(linkDoWhatsApp('(38) 99999-1234', 'Olá & tchau')).toBe('https://wa.me/5538999991234?text=Ol%C3%A1%20%26%20tchau');
  });

  it('o histórico: o pedido entra primeiro e vai para a auditoria', () => {
    const e = registrarPedido(empresaNova('FITO'), {
      id: 'p1', em: '2026-09-30T12:00:00.000Z', por: 'Vitor', competencias: ['2026-08'], documentos: ['Comprovantes bancários'], prazo: '',
      email: { para: ['a@b.com'], assunto: 'x', solicitacoes: ['s1'] },
    });
    expect(e.pedidos?.[0].id).toBe('p1');
    expect(e.auditoria[0]).toMatchObject({ acao: 'Pediu documentos', detalhe: '1 documento(s) de agosto/2026 por e-mail' });
  });
});
