import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { conta, empresa, linha, nota } from '../__legado__/fixtures';
import { conferirConta } from './verificarConta';
import { nomePlanilhaVerificacao, planilhaVerificacao } from './verificarContaPlanilha';

describe('a planilha do Verificar por conta (22/10/2026)', () => {
  const COMPRA = 'Compra para comercialização';
  const e = empresa({
    contas: [conta('66005', 'Compras de Mercadorias')],
    entradas: [nota('1102', '6', 500, '100'), nota('1102', '6', 300, '101'), nota('1102', '6', 400, '200')],
    naturezaConta: { [COMPRA]: ['66005'] },
  });
  // a 101 falta; a 200 lançada duas vezes; uma linha sem nota a mais
  const r = conferirConta({ empresa: e, contas: [e.contas[0]], razaoPorConta: { 66005: [linha('100', 500), linha('200', 400), linha('200', 400), { txt: 'AJUSTE SEM NOTA', data: '20/07/2026', valor: 75, sinal: 1, contra: '' }] }, cfopGrupo: COMPRA, servTipo: null });
  const wb = XLSX.read(planilhaVerificacao(r, { empresa: 'EMPRESA DE TESTE LTDA', periodo: '01/07/2026 a 31/07/2026' }));
  const aba = (n: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: '' });

  it('uma aba por assunto (só as que têm o que mostrar)', () => {
    expect(wb.SheetNames).toEqual(['Resumo', 'Faltando', 'Duplicadas', 'A mais']);
  });
  it('o resumo: a conta, o período, os totais e o que explica a diferença', () => {
    const res = aba('Resumo');
    const de = (rot: string) => res.find(l => l[0] === rot);
    expect(de('Conta contábil')?.[1]).toBe('66005 — Compras de Mercadorias');
    expect(de('Período')?.[1]).toBe('01/07/2026 a 31/07/2026');
    expect([de('Relatório da conta')?.[1], de('Notas fiscais')?.[1]]).toEqual([1375, 1200]);
    expect([de('Faltando na conta')?.slice(1), de('Duplicadas na conta')?.slice(1), de('A mais na conta')?.slice(1)]).toEqual([[300, 1], [400, 1], [75, 1]]);
  });
  it('faltando com a nota inteira; duplicadas com quantas vezes e o histórico; o total de cada aba', () => {
    const f = aba('Faltando');
    expect(f[0]).toEqual(['Data', 'Nota', 'Participante', 'Operação', 'CFOP', 'Exportado', 'Valor']);
    expect(f[1]).toEqual(['05/07/2026', '101', 'FORNECEDOR X LTDA', 'Entrada', '1102', '', 300]);
    expect(f[f.length - 1]).toEqual(['Total', '', '', '', '', '', 300]);
    const d = aba('Duplicadas');
    expect(d[1].slice(0, 2)).toEqual(['200', 2]);
    expect(String(d[1][6])).toContain('200');
    expect(d[1][7]).toBe(400);
    expect(nomePlanilhaVerificacao('EMPRESA DE TESTE LTDA', '66005')).toMatch(/^verificar-conta-.*-66005\.xlsx$/);
  });
});
