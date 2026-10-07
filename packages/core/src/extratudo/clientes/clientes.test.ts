import { describe, expect, it } from 'vitest';
import {
  clientesDoDinamico, comBalancete, conferidosQuePassam, credores, credoresNoPeriodo, dinamicoDeTeste, docDoDocumento, lerBalanceteDinamico, razaoComPendencia, situacaoDe, textoDaMensagem,
} from './index';

// o formato do balancete dinâmico do Alterdata (292, bdinamico.xls)
const ROWS = [
  ['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '07/2026', '08/2026'],
  ['1', '1', 'ATIVO', '1249894.75', '2622767.24', '2902895.66'],
  ['00120', '1.1.2.02', 'CLIENTES', '323140.06', '622741.24', '165611.29'],
  ['12006', '1.1.2.02.006', 'MERCEARIA P  F LTDA  EPP', '0.00', '839.33', '2353.98'],
  ['12013', '1.1.2.02.012', 'BRAZIL E AMORIM SUPERMERCADOS LTDA', '2001.28', '2786.35', '0.00'],
  ['12014', '1.1.2.02.013', 'AMORIM SUPERMERCADOS LTDA', '991.69', '519.87', '-150.00'],
  ['10101', '1.1.1.01.001', 'Caixa Geral', '104937.05', '1171815.62', '1904284.71'],
];

describe('clientes (a etapa Clientes da Tarefa)', () => {
  it('lê o dinâmico e acha as contas de cliente no mês (as analíticas debaixo de CLIENTES)', () => {
    const d = lerBalanceteDinamico(ROWS);
    expect(d.meses).toEqual(['2026-07', '2026-08']);
    const c = clientesDoDinamico(d, '2026-08');
    expect(c.map(x => [x.codigo, x.nome, x.saldo])).toEqual([['12006', 'MERCEARIA P F LTDA EPP', 2353.98], ['12013', 'BRAZIL E AMORIM SUPERMERCADOS LTDA', 0], ['12014', 'AMORIM SUPERMERCADOS LTDA', -150]]);
    expect(() => lerBalanceteDinamico([['a', 'b']])).toThrow(/cabeçalho/);
  });
  it('o credor no dinâmico ou no balancete atual é a prioridade', () => {
    const c = comBalancete(clientesDoDinamico(lerBalanceteDinamico(ROWS), '2026-08'), {
      12006: { codigo: '12006', nome: 'M', dc: 'C', grupo: 'Ativo', valor: 10 },
    });
    expect(credores(c).map(x => x.codigo)).toEqual(['12006', '12014']);
  });
  // um razão importado com um só item (Vitor, 07/10/2026: o Conferido é só do razão: nota em aberto ou pagamento solto)
  const razaoCom = (status: 'aberto' | 'pagamento' | 'devolucao', interno = false) => ({
    arquivo: 'x.xls', notas: [], saldo: 10, devolucoes: 0, duplicadas: [],
    itens: [{ data: '2026-08-05', nf: status === 'aberto' ? '1' : '', descricao: '', valor: 10, status, ...(interno ? { interno } : {}) }],
  });
  it('a situação: zerado é Ok, com saldo é Pendente; Conferido só pelo razão (nota em aberto ou pagamento solto)', () => {
    const [m, b] = clientesDoDinamico(lerBalanceteDinamico(ROWS), '2026-08');
    expect([situacaoDe(m), situacaoDe(b)]).toEqual(['pendente', 'ok']);
    // o conferido manual de antes (sem razão) não vale mais
    expect(situacaoDe(m, { nome: '', saldo: 0, situacao: 'conferido' })).toBe('pendente');
    expect(situacaoDe(m, { nome: '', saldo: 0, situacao: 'pendente', razao: razaoCom('aberto') })).toBe('conferido');
    expect(situacaoDe(m, { nome: '', saldo: 0, situacao: 'pendente', razao: razaoCom('pagamento') })).toBe('conferido');
    // só devolução, ou só a duplicidade (que é do escritório): não é o que perguntar ao cliente
    expect(situacaoDe(m, { nome: '', saldo: 0, situacao: 'pendente', razao: razaoCom('devolucao') })).toBe('pendente');
    expect(razaoComPendencia(razaoCom('pagamento', true))).toBe(false);
    // o Ok é do sistema: a conta zerada é Ok mesmo com razão; um Ok marcado antes não vale para quem tem saldo
    expect([situacaoDe(b, { nome: '', saldo: 0, situacao: 'conferido', razao: razaoCom('aberto') }), situacaoDe(m, { nome: '', saldo: 0, situacao: 'ok' })]).toEqual(['ok', 'pendente']);
  });
  it('os conferidos pelo razão passam para o mês seguinte; o conferido manual, não', () => {
    const ant = docDoDocumento({ contas: { 12006: { nome: 'M', saldo: 10, situacao: 'conferido', obs: 'NF 1', razao: razaoCom('aberto') }, 12014: { nome: 'C', saldo: 5, situacao: 'conferido' }, 12013: { nome: 'B', saldo: 0, situacao: 'ok' }, x: { situacao: 'outra' } } });
    expect(Object.keys(ant.contas)).toEqual(['12006', '12013', '12014']);
    expect(Object.keys(conferidosQuePassam(ant, { contas: {} }))).toEqual(['12006']);
    expect(conferidosQuePassam(ant, { contas: { 12006: { nome: 'M', saldo: 0, situacao: 'ok' } } })).toEqual({});
  });
  it('a mensagem com a lista dos conferidos', () => {
    const t = textoDaMensagem('{empresa} {mes}: {lista}', 'FITO', '08/2026', [{ codigo: '1', nome: 'M', saldo: 1234.5, obs: 'NF 9' }]);
    expect(t).toBe('FITO 08/2026: • M — R$ 1.234,50 — NF 9');
  });
});

describe('dinamicoDeTeste', () => {
  it('traz os clientes do mês, com ou sem credores', () => {
    const sem = clientesDoDinamico(dinamicoDeTeste('2026-01', false), '2026-01');
    expect(sem.length).toBe(8);
    expect(credores(sem)).toEqual([]);
    const com = dinamicoDeTeste('2026-01', true);
    expect(com.meses).toEqual(['2025-12', '2026-01']);
    expect(credores(clientesDoDinamico(com, '2026-01')).length).toBe(2);
  });
});

describe('credoresNoPeriodo', () => {
  it('os clientes credores em algum mês até o da etapa, com o saldo mês a mês', () => {
    const d = lerBalanceteDinamico(ROWS);
    expect(credoresNoPeriodo(d, '2026-08')).toEqual([
      { codigo: '12014', nome: 'AMORIM SUPERMERCADOS LTDA', saldos: [{ mes: '2026-07', saldo: 519.87 }, { mes: '2026-08', saldo: -150 }] },
    ]);
    expect(credoresNoPeriodo(d, '2026-07')).toEqual([]);
  });
});
