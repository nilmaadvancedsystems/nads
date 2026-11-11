// O Mandei no banco (11/11/2026): o documento do link, o que se lê dele e o ticket que a equipe vê com o que o cliente fez.
import { describe, expect, it } from 'vitest';
import {
  aceitar, aplicarRespostas, comSegundoLink, docDoLink, docValido, estadoDoEnvio, lerDocDoLink, linkAtual, novoTicket, pedirDeNovo, resolver, situacaoDoTicket,
  ticketComOsLinks, vistaDoDoc, type DadosDoTicket, type DocDoLink,
} from './index';

const DADOS: DadosDoTicket = {
  empresa: { nome: 'EMPRESA TESTE LTDA', codigo: 292 }, para: { nome: '', email: 'cliente@exemplo.com' },
  assunto: 'Saldos em aberto — 08/2026', mensagem: 'O que aconteceu?', criadoPor: { nome: 'Vitor' },
  origem: { titulo: 'Saldos em aberto · 08/2026', rota: '/tarefas/x', competencia: '2026-08' },
  itens: [
    { id: 'a', titulo: 'MERCADO', opcoes: ['Já foi pago (envio o comprovante)', 'Foi pago em dinheiro', 'Outro (explico abaixo)'],
      linhas: [{ data: '01/08/2026', nf: '1', descricao: 'Venda', valor: 'R$ 10,00' }] },
    { id: 'b', titulo: 'PADARIA', opcoes: ['Foi pago em dinheiro', 'Outro (explico abaixo)'] },
  ],
};
const AGORA = new Date(2026, 9, 7, 10, 0, 0);
const DEPOIS = new Date(2026, 9, 8, 15, 0, 0);
const t = novoTicket(DADOS, 't1', 3, 'COD1', AGORA);

describe('o documento do link', () => {
  it('só o que o cliente vê, os campos do envio do arquivo e o prazo', () => {
    const d = docDoLink(t, t.links[0], AGORA);
    expect(Object.keys(d).sort()).toEqual(['arquivos', 'empresa', 'envio', 'fechado', 'itens', 'mensagem', 'numero', 'refazer', 'respostas', 'ticket', 'validoAte']);
    expect(d.envio).toEqual({ cliente: 'EMPRESA TESTE LTDA', codigo: '292', competencia: '2026-08' });
    expect([d.numero, d.ticket, d.fechado, d.validoAte]).toEqual(['#0003', 't1', false, t.links[0].validoAte]);
    // sem o mês na origem: o mês de agora
    expect(docDoLink({ ...t, origem: { titulo: 'x', rota: '' } }, t.links[0], AGORA).envio.competencia).toBe('2026-10');
    expect(docDoLink(resolver(t, 'Clara', AGORA), t.links[0], AGORA).fechado).toBe(true);
  });
  it('a leitura não confia no que o cliente gravou: chave de fora, opção que não existe e tipo errado saem', () => {
    const bruto = { ...docDoLink(t, t.links[0], AGORA), respostas: { 'a/0': { opcao: 'Foi pago em dinheiro' }, b: { opcao: 'inventada', texto: ' ok ' }, z: { opcao: 'x' } },
      arquivos: [{ id: 'e1', nome: 'pix.pdf', tamanho: 10, itemId: 'a/0', enviadoEm: 'x' }, { nome: 'sem id' }], fechado: 'sim' } as unknown as Record<string, unknown>;
    const d = lerDocDoLink(bruto) as DocDoLink;
    expect(d.respostas).toEqual({ 'a/0': { opcao: 'Foi pago em dinheiro' }, b: { texto: 'ok' } });
    expect(d.arquivos.map(a => a.id)).toEqual(['e1']);
    expect(d.fechado).toBe(false);
    expect(lerDocDoLink({ ticket: 't1' })).toBeNull();
  });
  it('vale até o prazo e enquanto não fecha; a vista do formulário', () => {
    const d = docDoLink(t, t.links[0], AGORA);
    expect(docValido(d, AGORA)).toBe(true);
    expect(docValido(d, new Date(2026, 9, 20))).toBe(false);
    expect(docValido({ ...d, fechado: true }, AGORA)).toBe(false);
    expect(vistaDoDoc({ ...d, arquivos: [{ id: 'e1', nome: 'pix.pdf', tamanho: 1, itemId: 'a/0', enviadoEm: '' }] }).arquivos).toEqual([{ nome: 'pix.pdf', itemId: 'a/0' }]);
  });
  it('as respostas do formulário: as novas sobre as de antes, a vazia sai', () => {
    expect(aplicarRespostas(DADOS.itens, { b: { opcao: 'Foi pago em dinheiro' } }, { 'a/0': { opcao: 'Outro (explico abaixo)', texto: ' devolveram ' }, b: {} }))
      .toEqual({ 'a/0': { opcao: 'Outro (explico abaixo)', texto: 'devolveram' } });
  });
});

describe('o ticket com o que o cliente fez no link', () => {
  const doc = (d: Partial<DocDoLink>): DocDoLink => ({ ...docDoLink(t, t.links[0], AGORA), ...d });

  it('quando abriu, as respostas, quando mandou e os arquivos com o andamento; o histórico sem repetir', () => {
    const d = doc({ abertoEm: AGORA.toISOString(), respondidoEm: DEPOIS.toISOString(), respostas: { 'a/0': { opcao: 'Foi pago em dinheiro' }, b: { opcao: 'Foi pago em dinheiro' } },
      arquivos: [{ id: 'e1', nome: 'pix.pdf', tamanho: 10, itemId: 'a/0', enviadoEm: DEPOIS.toISOString() }] });
    const v = ticketComOsLinks(t, { COD1: d }, { e1: { status: 'no-drive', local: 'NOV/2026 › pix.pdf' } });
    expect(v.links[0].abertoEm).toBe(AGORA.toISOString());
    expect(v.respondidoEm).toBe(DEPOIS.toISOString());
    expect(v.arquivos.map(a => [a.id, a.status, a.local])).toEqual([['e1', 'no-drive', 'NOV/2026 › pix.pdf']]);
    expect(situacaoDoTicket(v, DEPOIS)).toBe('respondido');
    expect(v.historico?.map(e => e.tipo)).toEqual(['criado', 'aberto', 'respondido', 'arquivo']);
    // a equipe grava o ticket já com isso: ler de novo não repete o histórico
    expect(ticketComOsLinks(v, { COD1: d }).historico?.length).toBe(4);
  });

  it('sem o documento (ainda não chegou), o ticket como está', () => {
    expect(ticketComOsLinks(t, {})).toEqual(t);
  });

  it('o pedido de novo: o link da volta manda; respondeu, sai do refazer; o 2º link também vale', () => {
    const respondido = ticketComOsLinks(t, { COD1: doc({ respondidoEm: AGORA.toISOString(), respostas: { 'a/0': { opcao: 'Foi pago em dinheiro' }, b: { opcao: 'Foi pago em dinheiro' } } }) });
    const p = pedirDeNovo(aceitar(respondido, ['a/0'], 'Clara', DEPOIS), [{ chave: 'b', motivo: 'Qual o dia?' }], 'Clara', 'COD2', DEPOIS);
    const novo = docDoLink(p, linkAtual(p), DEPOIS);
    expect([novo.respostas, novo.refazer]).toEqual([{ 'a/0': { opcao: 'Foi pago em dinheiro' } }, { b: 'Qual o dia?' }]);
    expect(situacaoDoTicket(ticketComOsLinks(p, { COD2: novo }), DEPOIS)).toBe('aguardando');
    const voltou = ticketComOsLinks(p, { COD2: { ...novo, respondidoEm: DEPOIS.toISOString(), respostas: { ...novo.respostas, b: { opcao: 'Outro (explico abaixo)', texto: 'dia 3' } } } });
    expect(voltou.revisao).toEqual({ 'a/0': p.revisao?.['a/0'] });
    expect(situacaoDoTicket(voltou, DEPOIS)).toBe('respondido');
    // o 1º vence sem resposta: o 2º link sai com o documento dele
    const s = comSegundoLink(t, 'COD9', new Date(2026, 9, 14));
    expect(docDoLink(s, linkAtual(s), new Date(2026, 9, 14)).validoAte).toBe(linkAtual(s).validoAte);
  });
});

describe('o andamento do envio do arquivo', () => {
  it('pelo que o robô grava', () => {
    expect(estadoDoEnvio({ status: 'enviando' })).toEqual({ status: 'subindo' });
    expect(estadoDoEnvio({ status: 'pendente' })).toEqual({ status: 'na-fila' });
    expect(estadoDoEnvio({ status: 'gravando' })).toEqual({ status: 'na-fila' });
    expect(estadoDoEnvio({ status: 'pronto', pasta: 'Claudio Secretario/11-2026/EMPRESA', nomeFinal: 'Mandei #0003 - pix.pdf' })).toEqual({ status: 'no-drive', local: 'Claudio Secretario/11-2026/EMPRESA › Mandei #0003 - pix.pdf' });
    expect(estadoDoEnvio({ status: 'erro', erro: 'grande demais' })).toEqual({ status: 'erro', erro: 'grande demais' });
  });
});
