import { describe, expect, it } from 'vitest';
import {
  chavesDoItem, codigoDoLink, comArquivo, itemDaChave, operacaoDaLinha, comSegundoLink, emailDoLink, linkAberto, linkValido, novoTicket, responder, resolver, rotuloDoNumero,
  situacaoDoTicket, somarDias, somarDiasUteis, vistaDoCliente, type DadosDoTicket,
} from './index';

const DADOS: DadosDoTicket = {
  empresa: { nome: 'EMPRESA TESTE LTDA', codigo: 9999 }, para: { nome: 'Fulano', email: 'fulano@exemplo.com' },
  assunto: 'Clientes em aberto', mensagem: 'Pode nos dizer o que aconteceu?', criadoPor: { nome: 'Vitor' },
  origem: { titulo: 'Clientes · 08/2026', rota: '/tarefas/executar/9999/2026-08' },
  itens: [{ id: '12006', titulo: 'MERCEARIA P F LTDA', valor: 'R$ 2.353,98', detalhe: 'No meu sistema, está em aberto…', opcoes: ['Foi pago em dinheiro', 'Outro'] }],
};
// quarta-feira, 07/10/2026, 10h
const AGORA = new Date(2026, 9, 7, 10, 0, 0);

describe('os prazos', () => {
  it('3 dias úteis pulam o fim de semana e o feriado (12/10)', () => {
    // qui 08, sex 09, (sáb, dom, seg 12 feriado) ter 13
    const d = somarDiasUteis(AGORA, 3);
    expect([d.getDate(), d.getMonth() + 1, d.getHours()]).toEqual([13, 10, 23]);
  });
  it('5 dias corridos', () => {
    expect(somarDias(new Date(2026, 9, 13, 23, 0), 5).getDate()).toBe(18);
  });
});

describe('o ticket', () => {
  const t = novoTicket(DADOS, 't1', 1, 'COD1', AGORA);
  it('nasce com o 1º link e aguardando', () => {
    expect(rotuloDoNumero(t.numero)).toBe('#0001');
    expect(t.links.map(l => l.numero)).toEqual([1]);
    expect(situacaoDoTicket(t, AGORA)).toBe('aguardando');
  });
  it('o 1º link vence sem arquivo: o 2º link (5 dias corridos); vencido o 2º, ligar', () => {
    const depois = new Date(2026, 9, 14, 9);
    expect(situacaoDoTicket(t, depois)).toBe('segundo-link');
    const t2 = comSegundoLink(t, 'COD2', depois);
    expect(t2.links.map(l => [l.numero, l.codigo])).toEqual([[1, 'COD1'], [2, 'COD2']]);
    expect(situacaoDoTicket(t2, depois)).toBe('aguardando-2');
    expect(linkValido(t2, 'COD1', depois)).toBe(false);
    expect(linkValido(t2, 'COD2', depois)).toBe(true);
    expect(situacaoDoTicket(t2, new Date(2026, 9, 20, 9))).toBe('ligar');
  });
  it('responder sem arquivo não resolve; com arquivo, respondido; resolvido fecha o link', () => {
    const r = responder(linkAberto(t, 'COD1', AGORA), { '12006': { opcao: 'Foi pago em dinheiro', texto: '  no caixa  ' }, x: { texto: 'fora' } }, AGORA);
    expect(r.respostas).toEqual({ '12006': { opcao: 'Foi pago em dinheiro', texto: 'no caixa' } });
    expect(r.links[0].abertoEm).toBe(AGORA.toISOString());
    expect(situacaoDoTicket(r, AGORA)).toBe('aguardando');
    const a = comArquivo(r, { id: 'a1', nome: 'comprovante.pdf', tamanho: 1000, enviadoEm: AGORA.toISOString(), status: 'na-fila' });
    expect(situacaoDoTicket(a, new Date(2026, 9, 30))).toBe('respondido');
    const f = resolver(a, 'Vitor', AGORA);
    expect(situacaoDoTicket(f, AGORA)).toBe('resolvido');
    expect(linkValido(f, 'COD1', AGORA)).toBe(false);
  });
  it('com os lançamentos, o cliente responde cada linha (a chave <item>/<n>); o item sem linhas, inteiro', () => {
    const linhas = [{ data: '28/07/2026', nf: '9971', descricao: 'Venda a prazo', valor: 'R$ 839,33', tipo: 'nota' as const, operacao: 'Venda' }, { data: '25/08/2026', nf: '10111', descricao: 'Venda a prazo', valor: 'R$ 1.514,65', tipo: 'nota' as const }];
    const comLinhas = novoTicket({ ...DADOS, itens: [{ ...DADOS.itens[0], linhas }] }, 't2', 2, 'COD9', AGORA);
    expect(chavesDoItem(comLinhas.itens[0])).toEqual(['12006/0', '12006/1']);
    expect(chavesDoItem(t.itens[0])).toEqual(['12006']);
    expect(itemDaChave('12006/1')).toBe('12006');
    const r = responder(comLinhas, { '12006/0': { opcao: 'Foi pago em dinheiro' }, '12006/1': { opcao: 'Outro', texto: ' devolveram ' }, '12006/2': { opcao: 'Outro' }, '12006': { opcao: 'Outro' } }, AGORA);
    expect(r.respostas).toEqual({ '12006/0': { opcao: 'Foi pago em dinheiro' }, '12006/1': { opcao: 'Outro', texto: 'devolveram' } });
    // a operação: a da linha; nos tickets de antes, pela descrição
    expect(linhas.map(operacaoDaLinha)).toEqual(['Venda', 'Venda']);
    expect(operacaoDaLinha({ data: '', nf: '', descricao: 'Compra a prazo', valor: '' })).toBe('Compra');
  });
  it('o cliente vê só o formulário; o e-mail leva o link e o prazo', () => {
    const v = vistaDoCliente(t);
    expect(Object.keys(v).sort()).toEqual(['arquivos', 'empresa', 'itens', 'mensagem', 'numero', 'respostas', 'validoAte']);
    const e = emailDoLink(t, t.links[0], 'https://mandei-nilma.web.app/COD1');
    expect(e.assunto).toBe('Clientes em aberto — #0001');
    expect(e.corpo).toContain('vale até 13/10/2026');
    expect(e.corpo).toContain('https://mandei-nilma.web.app/COD1');
  });
  it('o código do link: 24 caracteres do alfabeto sem os parecidos', () => {
    const c = codigoDoLink(n => new Uint8Array(n).map((_, i) => i * 7));
    expect(c).toHaveLength(24);
    expect(/^[A-Za-z2-9]+$/.test(c) && !/[01IlO]/.test(c)).toBe(true);
  });
});
