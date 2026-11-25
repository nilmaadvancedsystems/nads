import { describe, expect, it } from 'vitest';
import { lucratividade, tempoPorCliente } from './lucratividade';

// uma terça de expediente: 2026-11-24, das 9h às 10h em Brasília (12h–13h UTC)
const tarefa = (clientes: { codigo: number | null; nome: string }[], status = 'concluida') => ({
  status: status as 'concluida', criadaEm: '2026-11-24T11:00:00.000Z', clientes,
  historico: [{ por: 'A', em: '2026-11-24T12:00:00.000Z', texto: 'Iniciou a tarefa' }, { por: 'A', em: '2026-11-24T13:00:00.000Z', texto: 'Concluiu a tarefa' }],
});
const DIA = Date.parse('2026-11-24T00:00:00.000Z');
const FIM = Date.parse('2026-11-25T00:00:00.000Z');

describe('a lucratividade por cliente (E23)', () => {
  it('soma o tempo do cronômetro e divide a tarefa de dois clientes por igual', () => {
    const t = tempoPorCliente([tarefa([{ codigo: 101, nome: 'ALFA' }]), tarefa([{ codigo: 101, nome: 'ALFA' }, { codigo: 102, nome: 'BETA' }])], DIA, FIM, '2026-11-25T00:00:00.000Z');
    const por = Object.fromEntries(t.map(x => [x.codigo, x]));
    expect(por[101].minutos).toBeGreaterThan(por[102].minutos);
    expect(por[101].minutos).toBe(por[102].minutos * 3);
    expect(por[101].tarefas).toBe(2);
  });
  it('cancelada e sem cliente não contam', () => {
    expect(tempoPorCliente([tarefa([{ codigo: 101, nome: 'A' }], 'cancelada'), tarefa([{ codigo: null, nome: 'avulsa' }])], DIA, FIM, '2026-11-25T00:00:00.000Z')).toEqual([]);
  });
  it('o honorário × meses menos o custo; sem contrato aparece como sem honorário, no fim', () => {
    const l = lucratividade(
      [{ codigo: 101, nome: 'ALFA', minutos: 600, tarefas: 3 }, { codigo: 999, nome: 'SEM CONTRATO', minutos: 60, tarefas: 1 }],
      [{ codigo: '101', nome: 'ALFA LTDA', valor: 850, ativo: true }, { codigo: '102', nome: 'BETA', valor: 420, ativo: true }, { codigo: '103', nome: 'PARADA', valor: 900, ativo: false }],
      1.5, 1,
    );
    expect(l.map(x => [x.codigo, x.honorario, x.custo, x.sobra])).toEqual([[102, 420, 0, 420], [101, 850, 900, -50], [999, null, 90, null]].sort((a, b) => (a[3] == null ? 1 : 0) - (b[3] == null ? 1 : 0) || (a[3] as number) - (b[3] as number)));
    expect(l[0].codigo).toBe(101);
    expect(l.at(-1)!.honorario).toBeNull();
  });
});
