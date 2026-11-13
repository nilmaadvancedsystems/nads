// O painel do mês do Faturamento (12/11/2026): o resumo das notas do mês pelo siegNotas.
import { describe, expect, it } from 'vitest';
import type { NotaDoSieg, NotasSieg } from '../tarefas/sieg';
import { CONSUMIDOR_FINAL, descricaoDoCfop, listaDeNotasDoMes, notasDoMes, relatorioDoDia } from './notasDoMes';

const nota = (x: Partial<NotaDoSieg>): NotaDoSieg => ({
  tipo: 'NF-e', chave: '', numero: '1', serie: '1', data: '05/10/2026', emitente: { doc: '', nome: '' }, destinatario: { doc: '', nome: '' }, valor: 0, ...x,
});
const mes = (emitidas: NotaDoSieg[]): NotasSieg => ({ codigo: '292', competencia: '2026-10', em: '2026-11-01T06:00:00Z', pasta: '', arquivos: 0, novos: 0, emitidas, recebidas: [] });

describe('o resumo das notas do mês', () => {
  it('a venda por dia, sem as canceladas, as de entrada e as de outro mês', () => {
    const r = notasDoMes(mes([
      nota({ data: '01/10/2026', valor: 100, cfop: '5102' }),
      nota({ data: '01/10/2026', valor: 50.5, tipo: 'NFC-e', cfop: '5102' }),
      nota({ data: '31/10/2026', valor: 200, cfop: '5102' }),
      nota({ data: '02/10/2026', valor: 999, cancelada: true }),
      nota({ data: '03/10/2026', valor: 888, entrada: true }),
      nota({ data: '30/09/2026', valor: 7, cfop: '5102' }),
    ]));
    expect(r?.porDia.length).toBe(31);
    expect([r?.porDia[0], r?.porDia[1], r?.porDia[2], r?.porDia[30]]).toEqual([150.5, 0, 0, 200]);
    expect(r?.maiorVenda).toEqual({ valor: 200, dia: 31, cliente: CONSUMIDOR_FINAL });
  });

  it('os 5 maiores clientes e o resto junto; a venda sem nome nem CNPJ é o Consumidor final', () => {
    const r = notasDoMes(mes([
      ...['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => nota({ destinatario: { doc: '1111111100019' + i, nome: 'Loja ' + n }, valor: 100 * (i + 1) })),
      nota({ destinatario: { doc: '11111111000196', nome: 'Loja G' }, valor: 50 }),
      nota({ tipo: 'NFC-e', valor: 30 }),
      nota({ tipo: 'NFC-e', destinatario: { doc: '12345678901', nome: '' }, valor: 20 }),
    ]));
    expect(r?.clientes.map(c => [c.nome, c.valor, c.notas])).toEqual([
      ['Loja G', 750, 2], ['Loja F', 600, 1], ['Loja E', 500, 1], ['Loja D', 400, 1], ['Loja C', 300, 1],
    ]);
    // A, B e o Consumidor final (as duas NFC-e)
    expect([r?.totalClientes, r?.outrosClientes]).toEqual([8, { clientes: 3, valor: 350 }]);
  });

  it('as operações pelo CFOP (pelos itens, quando a nota tem), com o nome; passando de 6, as menores juntas', () => {
    const r = notasDoMes(mes([
      nota({ valor: 300, itens: [{ ncm: '', cfop: '5102', cst: '', cest: '', valor: 200 }, { ncm: '', cfop: '5405', cst: '', cest: '', valor: 100 }] }),
      nota({ valor: 80, cfop: '6102' }),
      ...['5910', '5949', '5915', '5152', '5929'].map((c, i) => nota({ valor: 10 - i, cfop: c })),
    ]));
    expect(r?.cfops.map(c => [c.cfop, c.descricao, c.valor])).toEqual([
      ['5102', 'Venda de mercadoria', 200],
      ['5405', 'Venda com ICMS já retido (ST)', 100],
      ['6102', 'Venda de mercadoria (outro estado)', 80],
      ['5910', 'Bonificação, doação ou brinde', 10],
      ['5949', 'Outra saída', 9],
      ['', 'Outras operações', 8 + 7 + 6],
    ]);
  });

  it('o serviço (NFS-e) à parte; sem venda nem serviço, null', () => {
    const r = notasDoMes(mes([nota({ tipo: 'NFS-e', valor: 1500 }), nota({ tipo: 'NFS-e', valor: 500, cancelada: true })]));
    expect([r?.servicos, r?.clientes, r?.porDia.every(v => v === 0)]).toEqual([{ notas: 1, valor: 1500 }, [], true]);
    expect(notasDoMes(mes([nota({ valor: 10, cancelada: true })]))).toBeNull();
    expect(notasDoMes(null)).toBeNull();
  });

  it('o nome do CFOP', () => {
    expect([descricaoDoCfop('5.102'), descricaoDoCfop('7101'), descricaoDoCfop('5999'), descricaoDoCfop('')])
      .toEqual(['Venda de mercadoria', 'Venda de produção própria (exterior)', 'Operação 5999', 'Operação sem CFOP']);
  });
});

describe('o relatório do dia', () => {
  const lista = listaDeNotasDoMes(mes([
    nota({ data: '05/10/2026', numero: '12', valor: 100, chave: '3126 1011', destinatario: { doc: '11222333000181', nome: 'LOJA X' }, cfop: '5102' }),
    nota({ data: '05/10/2026', numero: '3', tipo: 'NFC-e', valor: 30 }),
    nota({ data: '05/10/2026', numero: '11', valor: 999, cancelada: true }),
    nota({ data: '06/10/2026', numero: '13', valor: 50 }),
    nota({ data: '05/10/2026', numero: '1', tipo: 'NFS-e', valor: 400 }),
    nota({ data: '05/10/2026', numero: '14', valor: 70, entrada: true }),
  ]));

  it('a lista do mês: por dia e número, sem as de entrada, sem o documento de quem comprou', () => {
    expect(lista?.notas.map(x => [x.dia, x.tipo, x.numero])).toEqual([[5, 'NF-e', '11'], [5, 'NF-e', '12'], [5, 'NFC-e', '3'], [5, 'NFS-e', '1'], [6, 'NF-e', '13']]);
    expect(lista?.notas[1]).toEqual({ dia: 5, tipo: 'NF-e', numero: '12', serie: '1', cliente: 'LOJA X', cfop: '5102', valor: 100, chave: '31261011' });
    expect(JSON.stringify(lista)).not.toContain('11222333000181');
    expect(lista?.cortadas).toBe(0);
  });

  it('o dia: as notas, a venda e o serviço à parte, a cancelada fora da soma', () => {
    const r = relatorioDoDia(lista?.notas ?? [], 5);
    expect([r.notas.length, r.vendas, r.servicos, r.quantidade, r.canceladas]).toEqual([4, 130, 400, 3, 1]);
    expect(r.porTipo).toEqual([{ tipo: 'NF-e', notas: 1, valor: 100 }, { tipo: 'NFC-e', notas: 1, valor: 30 }, { tipo: 'NFS-e', notas: 1, valor: 400 }]);
    expect(relatorioDoDia(lista?.notas ?? [], 20).notas).toEqual([]);
  });
});
