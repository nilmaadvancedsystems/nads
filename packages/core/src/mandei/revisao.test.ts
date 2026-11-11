// O Mandei de 11/11/2026: o rascunho, o que falta, a revisão por resposta (aceitar e pedir de novo), o histórico, os
// tickets na Área do Cliente e os modelos do ticket avulso.
import { describe, expect, it } from 'vitest';
import {
  aceitar, avulsoDoModelo, chavesParaRefazer, chavesParaRevisar, comArquivo, comNota, comSegundoLink, dadosDoAvulso, emailDoLink, erroDoAvulso,
  faltaNoTicket, linkAberto, linkAtual, linkEnviado, linkValido, MODELOS_DE_TICKET, novoTicket, OPCOES_DE_DOCUMENTO, pedeComprovante, pedeExplicacao,
  pedirDeNovo, resolver, responder, salvarRascunho, situacaoDoTicket, ticketsDaArea, vistaDoCliente, type DadosDoTicket,
} from './index';

const DADOS: DadosDoTicket = {
  empresa: { nome: 'EMPRESA TESTE LTDA', codigo: 9999 }, para: { nome: '', email: 'cliente@exemplo.com' },
  assunto: 'Saldos em aberto — 08/2026', mensagem: 'O que aconteceu?', criadoPor: { nome: 'Vitor' }, origem: { titulo: 'Clientes · 08/2026', rota: '' },
  itens: [
    { id: 'a', titulo: 'MERCADO', opcoes: ['Já foi pago (envio o comprovante)', 'Foi pago em dinheiro', 'Outro (explico abaixo)'],
      linhas: [{ data: '01/08/2026', nf: '1', descricao: 'Venda', valor: 'R$ 10,00' }, { data: '02/08/2026', nf: '2', descricao: 'Venda', valor: 'R$ 20,00' }] },
    { id: 'b', titulo: 'PADARIA', opcoes: ['Foi pago em dinheiro', 'Outro (explico abaixo)'] },
  ],
};
// quarta-feira, 07/10/2026, 10h
const AGORA = new Date(2026, 9, 7, 10, 0, 0);
const DEPOIS = new Date(2026, 9, 8, 15, 0, 0);
const t = novoTicket(DADOS, 't1', 7, 'COD1', AGORA);

describe('o rascunho (o cliente volta pelo link e continua)', () => {
  it('guarda sem dar como enviado; apagar a resposta tira a chave; chave de fora não entra', () => {
    const r = salvarRascunho(t, { 'a/0': { opcao: 'Foi pago em dinheiro' }, 'b': { opcao: 'Outro (explico abaixo)', texto: ' depois ' }, 'z/9': { opcao: 'x' } }, AGORA);
    expect(r.respostas).toEqual({ 'a/0': { opcao: 'Foi pago em dinheiro' }, b: { opcao: 'Outro (explico abaixo)', texto: 'depois' } });
    expect(r.rascunhoEm).toBe(AGORA.toISOString());
    expect(r.respondidoEm).toBeUndefined();
    expect(situacaoDoTicket(r, AGORA)).toBe('aguardando');
    const apagou = salvarRascunho(r, { 'a/0': {} }, DEPOIS);
    expect(Object.keys(apagou.respostas)).toEqual(['b']);
  });
});

describe('o que falta', () => {
  it('a resposta, a explicação do "Outro" e o comprovante do "Já foi pago"', () => {
    const r = salvarRascunho(t, { 'a/0': { opcao: 'Já foi pago (envio o comprovante)' }, 'a/1': { opcao: 'Outro (explico abaixo)' } }, AGORA);
    expect(faltaNoTicket(r)).toEqual([{ chave: 'a/0', falta: 'comprovante' }, { chave: 'a/1', falta: 'explicacao' }, { chave: 'b', falta: 'resposta' }]);
    const com = comArquivo(r, { id: 'f1', nome: 'pix.pdf', tamanho: 10, itemId: 'a/0', enviadoEm: AGORA.toISOString(), status: 'na-fila' });
    expect(faltaNoTicket(com).map(f => f.chave)).toEqual(['a/1', 'b']);
  });
  it('o comprovante pedido e não mandado segura o "respondido" (sem arquivo nenhum, vence e sai o 2º link)', () => {
    const r = responder(t, { 'a/0': { opcao: 'Já foi pago (envio o comprovante)' }, 'a/1': { opcao: 'Foi pago em dinheiro' }, b: { opcao: 'Foi pago em dinheiro' } }, AGORA);
    expect(situacaoDoTicket(r, AGORA)).toBe('aguardando');
    expect(situacaoDoTicket(r, new Date(2026, 9, 14))).toBe('segundo-link');
  });
  it('as respostas novas dos modelos: "Envio o arquivo" pede o arquivo, "Respondo abaixo" pede o texto', () => {
    expect(pedeComprovante('Envio o arquivo')).toBe(true);
    expect(pedeComprovante('Não tenho este mês')).toBe(false);
    expect(pedeExplicacao('Respondo abaixo')).toBe(true);
    expect(pedeExplicacao('Não tenho este mês')).toBe(false);
  });
});

describe('a revisão do escritório', () => {
  const respondido = responder(t, { 'a/0': { opcao: 'Foi pago em dinheiro' }, 'a/1': { opcao: 'Outro (explico abaixo)', texto: 'devolveram' }, b: { opcao: 'Foi pago em dinheiro' } }, AGORA);

  it('as respostas a revisar; aceitar tira da lista', () => {
    expect(situacaoDoTicket(respondido, AGORA)).toBe('respondido');
    expect(chavesParaRevisar(respondido)).toEqual(['a/0', 'a/1', 'b']);
    const a = aceitar(respondido, ['a/0', 'b', 'nada'], 'Clara', DEPOIS);
    expect(chavesParaRevisar(a)).toEqual(['a/1']);
    expect(a.revisao?.['a/0']).toEqual({ estado: 'aceita', por: 'Clara', em: DEPOIS.toISOString() });
    expect(a.revisao?.nada).toBeUndefined();
  });

  it('pedir de novo: a resposta volta ao cliente com o motivo, num link novo de 3 dias úteis', () => {
    const p = pedirDeNovo(aceitar(respondido, ['b'], 'Clara', DEPOIS), [{ chave: 'a/1', motivo: '  Qual a data da devolução?  ' }, { chave: 'a/0', motivo: '   ' }], 'Clara', 'COD9', DEPOIS);
    expect(chavesParaRefazer(p)).toEqual(['a/1']);
    expect(p.respostas['a/1']).toBeUndefined();
    expect(p.respostas['a/0']).toEqual({ opcao: 'Foi pago em dinheiro' });
    expect(p.respondidoEm).toBeUndefined();
    expect(situacaoDoTicket(p, DEPOIS)).toBe('aguardando');
    const l = linkAtual(p);
    expect([l.codigo, l.numero, l.refazer]).toEqual(['COD9', 1, true]);
    // qui 08 → sex 09, (sáb, dom, seg 12 feriado) ter 13, qua 14
    expect(new Date(l.validoAte).getDate()).toBe(14);
    expect(linkValido(p, 'COD1', DEPOIS)).toBe(false);
    expect(linkValido(p, 'COD9', DEPOIS)).toBe(true);
    expect(vistaDoCliente(p).refazer).toEqual({ 'a/1': 'Qual a data da devolução?' });
    const e = emailDoLink(p, l, 'https://x/COD9');
    expect(e.assunto).toBe('Falta pouco: Saldos em aberto — 08/2026 — #0007');
    expect(e.corpo).toContain('1 delas');
  });

  it('com o pedido de novo, o arquivo antigo não conta como respondido; o cliente responde e volta para a revisão', () => {
    const comArq = comArquivo(respondido, { id: 'f1', nome: 'x.pdf', tamanho: 1, itemId: 'a/0', enviadoEm: AGORA.toISOString(), status: 'na-fila' });
    const p = pedirDeNovo(comArq, [{ chave: 'a/1', motivo: 'Qual a data?' }], 'Clara', 'COD9', DEPOIS);
    expect(situacaoDoTicket(p, DEPOIS)).toBe('aguardando');
    // o link da volta vence sem resposta: sai o 2º link
    expect(situacaoDoTicket(p, new Date(2026, 9, 15))).toBe('segundo-link');
    expect(linkAtual(comSegundoLink(p, 'COD10', new Date(2026, 9, 15))).numero).toBe(2);
    const de = responder(p, { 'a/1': { opcao: 'Outro (explico abaixo)', texto: 'foi em 03/08' } }, DEPOIS);
    expect(chavesParaRefazer(de)).toEqual([]);
    expect(de.revisao).toBeUndefined();
    expect(situacaoDoTicket(de, DEPOIS)).toBe('respondido');
    expect(chavesParaRevisar(de)).toEqual(['a/0', 'a/1', 'b']);
  });

  it('sem motivo, ou resolvido, não pede nada', () => {
    expect(pedirDeNovo(respondido, [{ chave: 'b', motivo: '' }], 'Clara', 'COD9', DEPOIS)).toBe(respondido);
    const r = resolver(respondido, 'Clara', DEPOIS);
    expect(pedirDeNovo(r, [{ chave: 'b', motivo: 'x' }], 'Clara', 'COD9', DEPOIS)).toBe(r);
  });

  it('a nota interna e o histórico do caminho do ticket', () => {
    const n = comNota(respondido, '  liguei, vai mandar amanhã  ', 'Clara', DEPOIS);
    expect(n.notas).toEqual([{ texto: 'liguei, vai mandar amanhã', por: 'Clara', em: DEPOIS.toISOString() }]);
    expect(comNota(n, '   ', 'Clara', DEPOIS)).toBe(n);
    const caminho = resolver(aceitar(responder(linkAberto(linkAberto(linkEnviado(t, 'COD1', AGORA), 'COD1', AGORA), 'COD1', DEPOIS), { b: { opcao: 'Foi pago em dinheiro' } }, DEPOIS), ['b'], 'Clara', DEPOIS), 'Clara', DEPOIS);
    expect(caminho.historico?.map(e => e.tipo)).toEqual(['criado', 'enviado', 'aberto', 'respondido', 'aceita', 'resolvido']);
  });
});

describe('os tickets na Área do Cliente', () => {
  it('só os das empresas do link, esperando o cliente, com o que falta; o que vence antes primeiro', () => {
    const outro = novoTicket({ ...DADOS, empresa: { nome: 'OUTRA', codigo: 1 } }, 't2', 8, 'COD2', AGORA);
    const antes = novoTicket({ ...DADOS, assunto: 'Antes' }, 't3', 9, 'COD3', new Date(2026, 9, 5, 10));
    const rasc = salvarRascunho(t, { b: { opcao: 'Foi pago em dinheiro' } }, AGORA);
    const pronto = responder(t, { 'a/0': { opcao: 'Foi pago em dinheiro' }, 'a/1': { opcao: 'Foi pago em dinheiro' }, b: { opcao: 'Foi pago em dinheiro' } }, AGORA);
    const lista = ticketsDaArea([rasc, outro, antes, { ...pronto, id: 'p' }], [9999], AGORA);
    expect(lista.map(x => [x.numero, x.total, x.faltam])).toEqual([['#0009', 3, 3], ['#0007', 3, 2]]);
    expect(ticketsDaArea([t], [9999], new Date(2026, 9, 20))).toEqual([]);
  });
});

describe('os modelos do ticket avulso', () => {
  const base = { empresa: { nome: 'EMPRESA TESTE LTDA', codigo: 9999 }, para: { nome: '', email: 'cliente@exemplo.com' }, criadoPor: { nome: 'Clara' }, competencia: '2026-10' };
  it('o modelo mensal leva o mês no assunto e na mensagem; os itens viram perguntas com as respostas do tipo', () => {
    const extratos = MODELOS_DE_TICKET.find(m => m.id === 'extratos')!;
    const a = avulsoDoModelo(extratos, base);
    expect(a.assunto).toBe('Extratos de 10/2026');
    expect(a.mensagem).toContain('fecharmos 10/2026');
    expect(erroDoAvulso(a)).toBe('');
    const d = dadosDoAvulso({ ...a, itens: [...a.itens, { titulo: '   ', tipo: 'documento' }] });
    expect(d.itens.map(i => i.id)).toEqual(['i1', 'i2', 'i3']);
    expect(d.itens[0].opcoes).toEqual(OPCOES_DE_DOCUMENTO);
    expect(d.origem).toEqual({ titulo: 'Extratos do mês · 10/2026', rota: '', competencia: '2026-10' });
  });
  it('o que impede de mandar', () => {
    const pergunta = avulsoDoModelo(MODELOS_DE_TICKET.find(m => m.id === 'pergunta')!, base);
    expect(erroDoAvulso(pergunta)).toBe('Escreva ao menos um item.');
    expect(erroDoAvulso({ ...pergunta, itens: [{ titulo: 'Qual o faturamento?', tipo: 'pergunta' }], para: { nome: '', email: '' } })).toBe('A empresa não tem e-mail nem WhatsApp no Cadastro.');
    expect(erroDoAvulso({ ...pergunta, itens: [{ titulo: 'Qual o faturamento?', tipo: 'pergunta' }], para: { nome: '', email: 'sem-arroba' } })).toBe('O e-mail não parece certo.');
    const mensal = avulsoDoModelo(MODELOS_DE_TICKET[0], { ...base, competencia: '' });
    expect(erroDoAvulso(mensal)).toBe('Escolha o mês.');
  });
});
