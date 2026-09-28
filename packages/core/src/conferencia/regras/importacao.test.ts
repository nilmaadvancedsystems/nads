import { describe, expect, it } from 'vitest';
import { conta, empresa, nota, servico } from '../__legado__/fixtures';
import { assinaturaBalancete, mesclarNotas, mesclarServicos, separarPorTipo, verificarBalancete } from './importacao';

describe('mesclarNotas', () => {
  const antigas = [nota('1102', '6', 100, '1', { data: '10/07/2026' }), nota('1102', '6', 200, '2', { data: '11/07/2026' })];
  it('"novas": acrescenta as que faltam e corrige lançamento/nome/descrição das que já existem', () => {
    const novas = [
      nota('1102', '182', 100, '1', { data: '10/07/2026' }), // mesma chave, lançamento corrigido
      nota('1102', '6', 200, '2', { data: '11/07/2026' }), // igual
      nota('1102', '6', 300, '3', { data: '01/07/2026' }), // nova
    ];
    const r = mesclarNotas(antigas, novas, 'novas');
    expect([r.adicionadas, r.atualizadas, r.semMudanca]).toEqual([1, 1, 1]);
    expect(r.notas.map(n => n.numero)).toEqual(['3', '1', '2']); // por data
    expect(r.notas.find(n => n.numero === '1')?.lanc).toBe('182');
    expect(antigas[0].lanc).toBe('6'); // não muda a lista de entrada
  });
  it('"novas": documento e exportado mudam sem contar como atualizada', () => {
    const r = mesclarNotas(antigas, [{ ...antigas[0], doc: '99', exportado: 'Sim' }], 'novas');
    expect(r.atualizadas).toBe(0);
    expect(r.notas[0]).toMatchObject({ doc: '99', exportado: 'Sim' });
  });
  it('"sobrepor": fica só o arquivo, sem repetidas', () => {
    const r = mesclarNotas(antigas, [nota('1102', '6', 5, '9'), nota('1102', '7', 5, '9')], 'sobrepor');
    expect(r.notas.length).toBe(1);
    expect(r.adicionadas).toBe(1);
    expect(r.notas[0].lanc).toBe('6');
  });
});

describe('separarPorTipo', () => {
  it('tira as notas do outro tipo', () => {
    const r = separarPorTipo([nota('1102', '6', 1, '1'), nota('5102', '1', 1, '2')], 'entradas');
    expect(r.validas.map(n => n.cfop)).toEqual(['1102']);
    expect(r.foraDoTipo.map(n => n.cfop)).toEqual(['5102']);
    expect(r.todasForaDoTipo).toBe(false);
  });
  it('arquivo inteiro do outro tipo', () => {
    expect(separarPorTipo([nota('5102', '1', 1, '2')], 'entradas').todasForaDoTipo).toBe(true);
    expect(separarPorTipo([], 'entradas').todasForaDoTipo).toBe(false);
  });
});

describe('verificarBalancete', () => {
  const plano = [conta('66005', 'Compras'), conta('66015', 'Fretes'), conta('31105', 'Energia Elétrica'), conta('11101', 'Caixa'), conta('11201', 'Banco')];
  it('conta vinculada que não existe no arquivo é problema', () => {
    const e = empresa({ naturezaConta: { 'Compra para comercialização': ['66005'] } });
    const r = verificarBalancete(e, plano.filter(c => c.codigo !== '66005'));
    expect(r.problemas.length).toBe(1);
    expect(r.problemas[0]).toContain('66005 não existe neste arquivo');
    expect(r.similaridade).toBeNull();
  });
  it('lançamento automático travado também conta como vínculo', () => {
    const e = empresa({ dp: [{ lanc: '14', conta: '66099', nome: 'x', dc: 'D', travado: true }] });
    expect(verificarBalancete(e, plano).problemas[0]).toContain('66099 não existe');
  });
  it('nome diferente do último balancete é problema', () => {
    const e = empresa({ naturezaConta: { F: ['66015'] }, balanceteAssinatura: assinaturaBalancete(plano) });
    const r = verificarBalancete(e, plano.map(c => (c.codigo === '66015' ? { ...c, nome: 'Aluguel' } : c)));
    expect(r.problemas[0]).toContain('66015 era &quot;fretes&quot; e aqui é &quot;Aluguel&quot;');
    expect(r.similaridade).toBe(80);
  });
  it('semelhança abaixo de 60% é problema', () => {
    const e = empresa({ balanceteAssinatura: assinaturaBalancete(plano) });
    const r = verificarBalancete(e, [conta('66005', 'Compras'), conta('90001', 'Outra'), conta('90002', 'Outra 2')]);
    expect(r.similaridade).toBe(14); // 1 igual em 7 códigos
    expect(r.problemas.some(p => p.indexOf('Só <b>14%</b>') === 0)).toBe(true);
  });
  it('mesmo plano: sem problema e 100%', () => {
    const e = empresa({ naturezaConta: { X: ['31105'] }, balanceteAssinatura: assinaturaBalancete(plano) });
    expect(verificarBalancete(e, plano)).toEqual({ problemas: [], similaridade: 100 });
  });
});

describe('mesclarServicos', () => {
  it('"novas" corrige lançamento; "sobrepor" tira repetidas', () => {
    const a = [servico('1', 'TELEFONIA', 10, '38')];
    const r = mesclarServicos(a, [servico('1', 'TELEFONIA', 10, '527'), servico('2', 'TELEFONIA', 10, '38')], 'novas');
    expect([r.adicionadas, r.atualizadas, r.semMudanca]).toEqual([1, 1, 0]);
    expect(r.notas[0].lanc).toBe('527');
    expect(mesclarServicos(a, [servico('2', 'X', 1, '1'), servico('2', 'X', 1, '2')], 'sobrepor').notas.length).toBe(1);
  });
});
