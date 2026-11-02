import { describe, expect, it } from 'vitest';
import { conferirInss, referenciaDoPagamento, type GuiaDoInss } from './inss';
import { lerRazao } from './razao';

const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
const L = (data: string, contra: string, valor: number, hist: string, saldo: number) => ['', '', data, '', contra, contra ? 'Salários a Pagar' : '', valor, '', hist, saldo, ''];
// o razão que zera todo mês: o pagamento (com várias contrapartidas: a coluna vem vazia) baixa o saldo, que é diferente da guia
const RAZAO = lerRazao([CAB,
  L('31/01/2026', '52001', 1000, 'Pelo valor de INSS descontado em folha a recolher <01/2026> FULANO', 1000),
  L('20/02/2026', '', -1000, 'Pagamento de INSS ref 01/2026 conforme DARF.', 0),
  L('28/02/2026', '52001', 1200, 'Pelo valor de INSS descontado em folha a recolher <02/2026> FULANO', 1200),
  L('18/03/2026', '', -1200, 'Pagamento de INSS conforme DARF.', 0),
]);
const guia = (competencia: string, principal: number, pagaEm: string): GuiaDoInss => ({ competencia, numero: '', vencimento: pagaEm, pagaEm, banco: '', itens: [], principal, total: principal });

describe('a baixa do INSS com outro valor (Vitor, 26/10/2026: na 289, "tá tudo zerando")', () => {
  it('lê o mês de referência do histórico', () => {
    expect(referenciaDoPagamento('Pagamento de INSS ref 01/2026 conforme DARF.')).toBe('2026-01');
    expect(referenciaDoPagamento('Pagamento de INSS conforme DARF.')).toBeNull();
  });
  it('acha a baixa pelo "ref MM/AAAA" ou pela data (até 5 dias), marcada com outro valor; sem nada perto, falta', () => {
    const c = conferirInss(RAZAO, [guia('2026-01', 800, '2026-02-20'), guia('2026-02', 1500, '2026-03-20')], ['2026-01', '2026-02', '2026-03']);
    expect(c.baixas.map(b => [b.guia.competencia, b.lancamento?.data ?? null, !!b.outroValor])).toEqual([['2026-01', '2026-02-20', true], ['2026-02', '2026-03-18', true]]);
    expect(c.sugestoes.filter(s => s.tipo === 'baixa')).toEqual([]);
    const longe = conferirInss(RAZAO, [guia('2026-02', 1500, '2026-03-30')], ['2026-01', '2026-02', '2026-03']);
    expect(longe.baixas[0].lancamento).toBeNull();
  });
});
