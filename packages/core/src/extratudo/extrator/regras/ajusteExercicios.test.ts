import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento } from '../tipos';
import { conferenciaDoBanco, ehAjusteDeExerciciosAnteriores } from './situacaoDoBanco';
import { saldoDoPeriodo } from './saldoDoPeriodo';

const l = (data: string, valor: number, historico: string): Lancamento => ({ data, valor, historico });
const arq = (id: string, lado: 'banco' | 'sistema', lancamentos: Lancamento[], extra: Partial<ArquivoImportado> = {}): ArquivoImportado =>
  ({ id, lado, nome: id, importadoEm: '2026-10-26', modo: 'primeira', banco: 'stone', lancamentos, ...extra });
const MOV = [l('2026-01-02', 50000, 'Pix recebido'), l('2026-01-05', -12000, 'Tarifa'), l('2026-01-20', 3000, 'Rendimento')];
const empresa = (ajuste: number, abertura: number | null = 11906646): EmpresaExtrator => ({ nome: 'T', auditoria: [], arquivos: [
  arq('e', 'banco', MOV, abertura != null ? { saldoAnterior: abertura } : {}),
  arq('r', 'sistema', [l('2026-01-01', ajuste, 'Ajuste de exercicio anteriores'), ...MOV]),
] });

describe('o "Ajuste de exercicio anteriores" do razão (Vitor, 26/10/2026: "desde que o saldo bata, ignore")', () => {
  it('reconhece o histórico', () => {
    expect(ehAjusteDeExerciciosAnteriores('Ajuste de exercicio anteriores')).toBe(true);
    expect(ehAjusteDeExerciciosAnteriores('AJUSTES DE EXERCÍCIOS ANTERIORES')).toBe(true);
    expect(ehAjusteDeExerciciosAnteriores('Ajuste de saldo')).toBe(false);
  });
  it('com o valor do saldo do extrato naquele dia: fica de fora das pendências e do saldo do período', () => {
    const e = empresa(11906646);
    const c = conferenciaDoBanco(e, 'stone', 'stone', ['2026-01']);
    expect(c.pendencias).toEqual([]);
    expect(c.ajustes.size).toBe(1);
    expect(saldoDoPeriodo(e, 'stone', 'stone', ['2026-01']).bate).toBe(true);
  });
  it('com outro valor, ou sem o saldo de abertura do extrato: continua pendência', () => {
    expect(conferenciaDoBanco(empresa(11900000), 'stone', 'stone', ['2026-01']).pendencias.flatMap(p => p.linhas).map(x => x.sistema?.historico)).toEqual(['Ajuste de exercicio anteriores']);
    expect(conferenciaDoBanco(empresa(11906646, null), 'stone', 'stone', ['2026-01']).ajustes.size).toBe(0);
  });
});
