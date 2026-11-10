import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { BalanceteDinamico } from './extratudo/clientes';
import type { RazaoDaConta } from './tarefas/regras/razao';
import { lerDinamico, lerRazao, relerLeituras, type ComFonte } from './releitura';

const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
const LINHAS = [
  CAB,
  ['VERDADEIRO', 'Não conciliado', 46027, '', '10503', 'Banco Exemplo', -15.5, '', 'TARIFA', -104952.55, ''],
  ['VERDADEIRO', 'Não conciliado', 46029, '', '10503', 'Banco Exemplo', -5647.5, '', 'PIX', -110600.05, ''],
];
function xls(linhas: unknown[][], aba = '10101'): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), aba);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
describe('a leitura guardada com a planilha (10/11/2026)', () => {
  it('a leitura de agora volta igual: o mesmo objeto, sem reler', () => {
    const r = lerRazao(xls(LINHAS), '10101.xls');
    const guardado = JSON.parse(JSON.stringify({ razoes: { '10101': { arquivo: 'x.xls', razao: r } } }));
    expect(relerLeituras(guardado)).toBe(guardado);
    expect(r.conta).toBe('10101');
  });

  it('lida pelo leitor velho: relida com o de agora, a conta fica', () => {
    const r = lerRazao(xls(LINHAS), '10101.xls') as ComFonte<RazaoDaConta>;
    // o leitor velho deu outra leitura das mesmas linhas: a assinatura guardada é a dele
    const linhasVelhas = LINHAS.slice(0, 2);
    const doVelho = lerRazao(xls(linhasVelhas), '10101.xls') as ComFonte<RazaoDaConta>;
    const guardado = { razao: { ...doVelho, conta: '10101', fonte: { ...doVelho.fonte, linhas: r.fonte.linhas } } };
    const relido = relerLeituras(JSON.parse(JSON.stringify(guardado)));
    expect(relido.razao.lancamentos).toHaveLength(2);
    expect(relido.razao.saldoFinal).toBe(r.saldoFinal);
    expect(relido.razao.conta).toBe('10101');
  });

  it('a leitura mexida depois de lida (não bate com a assinatura): fica como está', () => {
    const r = lerRazao(xls(LINHAS), '10101.xls');
    const mexido = { ...r, lancamentos: r.lancamentos.slice(0, 1) };
    expect(relerLeituras(mexido)).toBe(mexido);
  });

  it('a planilha grande demais não vai junto', () => {
    const grande = [['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '01/2026'], ...Array.from({ length: 300 }, (_, i) => [String(i + 1), '1.' + (i + 1), 'CONTA '.repeat(1000), 0, 1])];
    expect('fonte' in lerDinamico(grande)).toBe(false);
    expect('fonte' in lerDinamico(grande.slice(0, 3))).toBe(true);
  });

  it('o dinâmico também, e a fonte estragada não derruba nada', () => {
    const linhas = [['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '01/2026'], ['1', '1', 'ATIVO', 10, 20], ['2', '1.1', 'CAIXA', 10, 20]];
    const d = lerDinamico(linhas) as ComFonte<BalanceteDinamico>;
    const velho = lerDinamico(linhas.slice(0, 2)) as ComFonte<BalanceteDinamico>;
    const guardado = { nome: 'd.xls', d: { ...velho, fonte: { ...velho.fonte, linhas: d.fonte.linhas } } };
    expect(relerLeituras(JSON.parse(JSON.stringify(guardado))).d.linhas).toHaveLength(d.linhas.length);
    const estragado = { d: { ...velho, fonte: { ...velho.fonte, linhas: [['nada']] } } };
    expect(relerLeituras(estragado)).toBe(estragado);
  });
});
