import { describe, expect, it } from 'vitest';
import { calendarioDoDp, feriasDoFuncionario, historicoDaFolha } from './dp';

const trab = (cpf: string, base: number) => ({ cpf, nome: 'X', matricula: '', base, valor: 0 }) as never;

describe('o histórico da folha (13/11/2026)', () => {
  it('soma a base e o FGTS por mês, conta os funcionários e não repete a mesma guia', () => {
    const g = (numero: string, competencia: string, total: number, ts: unknown[]) => ({ numero, competencia, vencimento: '', emissao: '', total, trabalhadores: ts }) as never;
    const r = historicoDaFolha([
      g('1', '2026-09', 160, [trab('111.111.111-11', 1000), trab('222.222.222-22', 1000)]),
      g('1', '2026-09', 160, [trab('111.111.111-11', 1000), trab('222.222.222-22', 1000)]),
      g('2', '2026-10', 200, [trab('111.111.111-11', 1500), trab('222.222.222-22', 1000)]),
    ]);
    expect(r).toEqual([{ competencia: '2026-09', base: 2000, fgts: 160, funcionarios: 2 }, { competencia: '2026-10', base: 2500, fgts: 200, funcionarios: 2 }]);
  });
});

describe('as férias pelo tempo no registro, pelo período mais recente (13/11/2026)', () => {
  const hoje = new Date(2026, 10, 13); // nov/2026
  it('menos de um ano: as primeiras a partir de quando', () => {
    expect(feriasDoFuncionario('2026-05', hoje)).toMatchObject({ situacao: 'a-adquirir', aPartirDe: '2027-05' });
  });
  it('o último período completo e sem recibo: pode tirar até 11 meses depois de ele completar', () => {
    expect(feriasDoFuncionario('2025-06', hoje)).toMatchObject({ situacao: 'tem', limite: '2027-05' });
    expect(feriasDoFuncionario('2021-06', hoje)).toMatchObject({ situacao: 'tem', limite: '2027-05' });
  });
  it('perto de vencer (até 3 meses)', () => {
    expect(feriasDoFuncionario('2025-01', hoje)).toMatchObject({ situacao: 'vence-logo', limite: '2026-12' });
  });
  it('com um recibo de férias depois de o período completar: em dia', () => {
    expect(feriasDoFuncionario('2025-01', hoje, ['2026-07'])).toMatchObject({ situacao: 'a-adquirir', aPartirDe: '2027-01' });
    // o recibo de antes de o período completar não conta
    expect(feriasDoFuncionario('2025-01', hoje, ['2025-11'])).toMatchObject({ situacao: 'vence-logo' });
  });
});

describe('o calendário do DP (13/11/2026)', () => {
  it('o salário no 5º dia útil, o FGTS e o INSS no dia 20 (antecipado), o eSocial no 15 e o 13º em novembro', () => {
    const r = calendarioDoDp('2026-11', [{ nome: 'Ana', desde: '2021-11', ativo: true }, { nome: 'Rui', desde: '2026-01', ativo: false }]);
    expect(r.filter(d => d.dia != null).map(d => [d.dia, d.tipo])).toEqual([[6, 'salario'], [15, 'esocial'], [20, 'fgts'], [20, 'inss'], [30, 'decimo']]);
    expect(r.find(d => d.tipo === 'aniversario')?.titulo).toBe('Ana faz 5 anos de empresa');
  });
  it('dia 20 no domingo vira a sexta; sem funcionário ativo, nada', () => {
    expect(calendarioDoDp('2026-09', [{ nome: 'A', desde: '2025-01', ativo: true }]).find(d => d.tipo === 'fgts')?.dia).toBe(18);
    expect(calendarioDoDp('2026-09', [{ nome: 'A', desde: '2025-01', ativo: false }])).toEqual([]);
  });
});
