// O envio do mês pelo Mandei (11/11/2026): Clientes e Fornecedores num ticket só; o lado já mandado não se repete.
import { describe, expect, it } from 'vitest';
import { chaveDoItem, envioDoMes, perguntasDaQuestao, ticketDoMes, type DocClientes, type ItemDoRazao, type MarcaDoCliente } from './index';

const item = (nf: string, valor: number, status: ItemDoRazao['status'] = 'aberto'): ItemDoRazao => ({ data: '2026-08-10', nf, descricao: 'Venda a prazo', valor, status });
function marca(nome: string, itens: ItemDoRazao[], perguntar?: ItemDoRazao[]): MarcaDoCliente {
  return {
    nome, saldo: itens.reduce((t, i) => t + i.valor, 0), situacao: 'conferido',
    razao: { arquivo: 'razao.xls', notas: [], saldo: 0, devolucoes: 0, duplicadas: [], itens },
    ...(perguntar ? { perguntar: perguntar.map(chaveDoItem) } : {}),
  };
}
const n1 = item('100', 500), n2 = item('200', 300), f1 = item('77', 1200);
const clientes: DocClientes = { contas: { '1.1': marca('MERCADO', [n1, n2], [n1]), '1.2': marca('PADARIA', [n2]) } };
const fornecedores: DocClientes = { contas: { '2.1': marca('ATACADO', [f1], [f1]) } };

describe('o envio do mês', () => {
  it('as contas com linha no "+" dos dois lados; os dois faltam mandar', () => {
    const e = envioDoMes([{ lado: 'clientes', doc: clientes, anterior: null }, { lado: 'fornecedores', doc: fornecedores, anterior: null }]);
    expect(e.questoes.map(q => [q.lado, q.codigo])).toEqual([['clientes', '1.1'], ['fornecedores', '2.1']]);
    expect(e.faltam).toEqual(['clientes', 'fornecedores']);
    expect(perguntasDaQuestao(e.questoes[0])).toBe('NF 100');
    const t = ticketDoMes(e, '2026-08', '08/2026');
    expect(t.assunto).toBe('Saldos em aberto — 08/2026');
    expect(t.mensagem).toContain('clientes e fornecedores');
    expect(t.itens.map(i => [i.id, i.titulo])).toEqual([['clientes-1.1', 'Cliente: MERCADO'], ['fornecedores-2.1', 'Fornecedor: ATACADO']]);
    expect(t.itens[0].linhas?.map(l => [l.nf, l.operacao])).toEqual([['100', 'Venda']]);
    expect(t.itens[1].linhas?.map(l => l.operacao)).toEqual(['Compra']);
  });

  it('o lado já mandado não entra de novo; mudou o "+", falta de novo', () => {
    const antes = envioDoMes([{ lado: 'clientes', doc: clientes, anterior: null }, { lado: 'fornecedores', doc: fornecedores, anterior: null }]);
    const mandado = { ...clientes, enviado: antes.assinaturas.clientes };
    const e = envioDoMes([{ lado: 'clientes', doc: mandado, anterior: null }, { lado: 'fornecedores', doc: fornecedores, anterior: null }]);
    expect(e.faltam).toEqual(['fornecedores']);
    const t = ticketDoMes(e, '2026-08', '08/2026');
    expect(t.mensagem).toContain('saldos de fornecedores');
    expect(t.itens.map(i => i.titulo)).toEqual(['ATACADO']);
    const mudou = { ...mandado, contas: { ...mandado.contas, '1.2': marca('PADARIA', [n2], [n2]) } };
    expect(envioDoMes([{ lado: 'clientes', doc: mudou, anterior: null }]).faltam).toEqual(['clientes']);
  });

  it('o conferido do mês anterior que passa também vai; sem nada no "+", nada falta', () => {
    const anterior: DocClientes = { contas: { '1.9': marca('LOJA', [item('9', 50)], [item('9', 50)]) } };
    const e = envioDoMes([{ lado: 'clientes', doc: { contas: {} }, anterior }]);
    expect(e.questoes.map(q => q.codigo)).toEqual(['1.9']);
    expect(envioDoMes([{ lado: 'clientes', doc: { contas: { '1.2': marca('PADARIA', [n2]) } }, anterior: null }])).toEqual({ questoes: [], assinaturas: { clientes: '', fornecedores: '' }, faltam: [] });
  });
});
