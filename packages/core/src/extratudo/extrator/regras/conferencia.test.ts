import { describe, expect, it } from 'vitest';
import type { Lado, LancamentoDoArquivo } from '../tipos';
import { conferir, csvConferencia, totais } from './conferencia';

let seq = 0;
function l(lado: Lado, dia: number, valor: number, historico: string): LancamentoDoArquivo {
  seq++;
  return { id: lado + seq, idArquivo: lado, lado, data: '2026-08-' + String(dia).padStart(2, '0'), valor, historico };
}
const B = (d: number, v: number, h: string) => l('banco', d, v, h);
const S = (d: number, v: number, h: string) => l('sistema', d, v, h);
const resumo = (r: ReturnType<typeof conferir>) => r.linhas.map(x => [x.situacao, x.extrato?.historico || '', x.sistema?.historico || '', x.motivo]);

describe('conferência extrato × sistema', () => {
  it('classifica cada caso', () => {
    const r = conferir([
      B(3, 450000, 'PIX RECEBIDO CLIENTE ALFA'), B(10, -73500, 'DARF SIMPLES'), B(10, -73500, 'DARF SIMPLES'),
      B(12, 89000, 'TED RECEBIDA BETA'), B(20, -55000, 'PIX ENVIADO FORNECEDOR DELTA'), B(21, -9900, 'TARIFA'),
      B(22, 125000, 'DEPOSITO DINHEIRO'),
    ], [
      S(3, 450000, 'Recebimento cliente Alfa'), S(3, 450000, 'Recebimento cliente Alfa'), S(10, -73500, 'Simples Nacional'),
      S(14, 89000, 'Recebimento Beta'), S(20, -50500, 'Pagamento fornecedor Delta'), S(22, -125000, 'Depósito dinheiro'),
      S(28, -60000, 'Honorários'),
    ], 3);
    expect(resumo(r)).toEqual([
      ['ok', 'PIX RECEBIDO CLIENTE ALFA', 'Recebimento cliente Alfa', ''],
      ['duplicado', '', 'Recebimento cliente Alfa', 'Lançado mais de uma vez no sistema'],
      ['ok', 'DARF SIMPLES', 'Simples Nacional', ''],
      ['duplicado', 'DARF SIMPLES', '', 'Aparece repetido no extrato e só uma vez no sistema'],
      ['diferente', 'TED RECEBIDA BETA', 'Recebimento Beta', 'Data diferente: 2 dias'],
      ['diferente', 'PIX ENVIADO FORNECEDOR DELTA', 'Pagamento fornecedor Delta', 'Valor diferente: diferença de 45,00'],
      ['faltando', 'TARIFA', '', 'Está no extrato e não no sistema'],
      ['diferente', 'DEPOSITO DINHEIRO', 'Depósito dinheiro', 'No extrato é entrada; no sistema está como saída'],
      ['amais', '', 'Honorários', 'Está no sistema e não no extrato'],
    ]);
    expect(r.contagem).toEqual({ ok: 2, faltando: 1, diferente: 3, amais: 1, duplicado: 2 });
    expect(r.sistemaInvertido).toBe(false);
  });

  it('sem tolerância, data diferente vira faltando + a mais', () => {
    const r = conferir([B(12, 100, 'X')], [S(14, 100, 'X')], 0);
    expect(r.linhas.map(x => x.situacao)).toEqual(['faltando', 'amais']);
  });

  it('entre dois candidatos iguais, fica o de histórico mais parecido', () => {
    const r = conferir([B(5, -1000, 'TARIFA PIX')], [S(5, -1000, 'Energia'), S(5, -1000, 'Tarifa pix')], 0);
    expect(r.linhas[0].sistema?.historico).toBe('Tarifa pix');
    expect(r.linhas[1].situacao).toBe('amais');
  });

  it('sistema com os sinais todos trocados é invertido para comparar', () => {
    const r = conferir(
      [B(1, 100, 'a'), B(2, -200, 'b'), B(3, 300, 'c'), B(4, -400, 'd')],
      [S(1, -100, 'a'), S(2, 200, 'b'), S(3, -300, 'c'), S(4, 400, 'd')], 3);
    expect(r.sistemaInvertido).toBe(true);
    expect(r.contagem.ok).toBe(4);
  });

  it('não mexe nos lançamentos de quem chamou', () => {
    const s = [S(1, -100, 'a'), S(2, 200, 'b'), S(3, -300, 'c')];
    conferir([B(1, 100, 'a'), B(2, -200, 'b'), B(3, 300, 'c')], s, 3);
    expect(s.map(x => x.valor)).toEqual([-100, 200, -300]);
  });

  it('totais', () => {
    expect(totais([{ valor: 100 }, { valor: -30 }, { valor: 5 }])).toEqual({ entradas: 105, saidas: -30, liquido: 75 });
  });

  it('CSV com ; e BOM', () => {
    const csv = csvConferencia(conferir([B(3, -1050, 'TARIFA; PIX')], [], 0));
    expect(csv.split('\n')).toEqual(['\ufeffSituação;Data extrato;Histórico extrato;Valor extrato;Data sistema;Histórico sistema;Valor sistema;O que houve', 'Faltando;03/08/2026;"TARIFA; PIX";-10,50;;;;Está no extrato e não no sistema']);
  });
});

describe('conferido pelo total do dia (cobrança em lote)', () => {
  it('o lote do extrato e os clientes do razão no mesmo dia, somando igual: tudo conferido', () => {
    const r = conferir([
      B(2, 585254, 'CRÉD.LIQ.COBRANÇA DOC.: 1820477'), B(2, 208347, 'CRÉD.LIQ.COBRANÇA DOC.: 1821307'),
    ], [
      S(2, 389879, 'CAMILA SIMOES CORDEIRO'), S(2, 200000, 'MEDEIROS E MOURA LTDA'), S(2, 203288, 'SUPERMERCADO SKINAO LTDA'),
      S(2, 5059, 'Juros Recebidos'), S(2, -4625, 'Descontos Concedidos'),
    ], 3);
    expect(r.contagem).toEqual({ ok: 7, faltando: 0, diferente: 0, amais: 0, duplicado: 0 });
    expect(r.linhas[0].motivo).toBe('Conferido pelo total do dia: 2 lançamentos no extrato, 5 no sistema, somando 7.936,01');
  });
  it('somando diferente, ou em dias diferentes: continua pendente', () => {
    const r = conferir([B(6, 1096891, 'CRÉD.LIQ.COBRANÇA DOC.: 1948278')], [S(6, 398190, 'SUPERMERCADO UNIAO'), S(6, 711797, 'CAMPOS COMERCIO')], 0);
    expect(r.contagem).toMatchObject({ ok: 0, faltando: 1, amais: 2 });
    const r2 = conferir([B(6, 300000, 'CRÉD.LIQ.COBRANÇA DOC.: 1')], [S(6, 100000, 'A'), S(7, 200000, 'B')], 0);
    expect(r2.contagem).toMatchObject({ ok: 0, faltando: 1, amais: 2 });
  });
});
