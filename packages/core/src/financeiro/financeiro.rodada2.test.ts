// 2ª rodada: as planilhas que saem do Financeiro (ida e volta do .xlsx), os totais em centavos e o extrato do banco. Dados
// fictícios; semente fixa.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { CABECALHO_DAS_CONTAS, linhasDasContas, planilhaDasContas, vencimentosDaRecorrencia, valorComJuros, type ContaAPagar } from './contasPagar';
import { CABECALHO_DO_DEMONSTRATIVO, linhasDoDemonstrativo, planilhaDoDemonstrativo } from './demonstrativo';
import { linhasDoExtrato, resumoDoExtrato, saldoFinalDoExtrato, separarJaImportadas } from './banco';
import { lerLinhaDigitavel, linhaFormatada, modulo10, modulo11DaArrecadacao, modulo11DoBanco, vencimentoDoFator } from './boleto';
import { valorReajustado } from './gestao';
import { competenciaAnterior, linhasDosHonorarios, planilhaDosHonorarios, type LinhaDeHonorario } from './honorarios';
import type { ContaDoPlano, LancamentoDeCaixa } from './index';
import { colunasDoAno, planilhaDoResultado, resultadoEmColunas, type LinhaDoResultado } from './resultado';

function gerador(semente: number) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const reler = (b: Uint8Array): unknown[][] => { const wb = XLSX.read(b, { type: 'array' }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }); };
const lanc = (id: number, data: string, tipo: 'E' | 'S', valor: number, o: Partial<LancamentoDeCaixa> = {}): LancamentoDeCaixa => ({ id: 'l' + id, data, tipo, valor, descricao: 'Lançamento ' + id, ...o } as unknown as LancamentoDeCaixa);
const conta = (id: string, codigo: string, descricao: string, pai: string | null): ContaDoPlano => ({ id, codigo, descricao, pai, tipo: 'R', nivel: codigo.split('.').length, ativo: true, movimentavel: true } as unknown as ContaDoPlano);

describe('o Demonstrativo de Caixa', () => {
  const e = (itens: LancamentoDeCaixa[], saldoInicial = 100.1) => ({ de: '2026-03-01', ate: '2026-03-31', saldoInicial, filtrado: false, itens: itens.map(lancamento => ({ lancamento })) });

  it('ida e volta do .xlsx: título, cabeçalho, valores na coluna certa, acento e fechamento', () => {
    const linhas = reler(planilhaDoDemonstrativo(e([lanc(1, '2026-03-02', 'E', 1000.1, { descricao: 'Honorário de março — ação' }), lanc(2, '2026-03-03', 'S', 0.3, { observacoes: 'Tarifa çã' })])));
    expect(linhas[0][0]).toBe('Demonstrativo de Caixa — 01/03/2026 a 31/03/2026');
    expect(linhas[3]).toEqual([...CABECALHO_DO_DEMONSTRATIVO]);
    expect(linhas[4]).toEqual(['02/03/2026', 'Honorário de março — ação', '', 1000.1, '', '']);
    expect(linhas[5]).toEqual(['03/03/2026', 'Lançamento 2', '', '', 0.3, 'Tarifa çã']);
    expect(linhas[6].slice(1, 5)).toEqual(['Totais', '', 1000.1, 0.3]);
    expect(linhas[7].slice(1, 4)).toEqual(['Saldo final', '', 1099.9]);
  });

  it('saldo final = inicial + entradas − saídas em centavos exatos (10.000 lançamentos sorteados)', () => {
    const r = gerador(1011);
    let ent = 0, sai = 0;
    const itens = Array.from({ length: 10000 }, (_, i) => { const c = Math.floor(r() * 300000) + 1; const t = r() < 0.5 ? 'E' : 'S'; if (t === 'E') ent += c; else sai += c; return lanc(i, '2026-03-02', t, c / 100); });
    const d = linhasDoDemonstrativo(e(itens, 0.07));
    expect(Math.round(d.entradas * 100)).toBe(ent);
    expect(Math.round(d.saidas * 100)).toBe(sai);
    expect(Math.round(d.saldoFinal * 100)).toBe(7 + ent - sai);
    expect(d.saldoFinal).toBe((7 + ent - sai) / 100);
  });

  it('sem lançamento: o saldo final é o inicial', () => {
    expect(linhasDoDemonstrativo(e([], 12.34))).toMatchObject({ entradas: 0, saidas: 0, saldoFinal: 12.34 });
  });
});

describe('o Resultado', () => {
  const plano = [conta('a', '1', 'Receitas', null), conta('a1', '1.1', 'Honorários', 'a'), conta('b', '2', 'Despesas', null), conta('b1', '2.1', 'Aluguel', 'b'), conta('b2', '2.2', 'Energia', 'b')];
  const colunas = colunasDoAno(2024);

  it('dezembro, janeiro e 29/02 de ano bissexto caem na coluna certa', () => {
    const r = resultadoEmColunas([lanc(1, '2024-01-01', 'E', 1, { conta: 'a1' }), lanc(2, '2024-02-29', 'E', 2, { conta: 'a1' }), lanc(3, '2024-12-31', 'E', 3, { conta: 'a1' }), lanc(4, '2025-01-01', 'E', 50, { conta: 'a1' }), lanc(5, '2023-12-31', 'E', 60, { conta: 'a1' })], plano, colunas);
    expect(r.totais.entradas[0]).toBe(1);
    expect(r.totais.entradas[1]).toBe(2);
    expect(r.totais.entradas[11]).toBe(3);
    expect(r.totais.entradas.reduce((s, x) => s + x, 0)).toBe(6);
  });

  it('o grupo soma os filhos, o total das colunas fecha e o resultado é entradas − saídas, em centavos', () => {
    const rnd = gerador(5150);
    const ls: LancamentoDeCaixa[] = [];
    const cent = { E: Array(12).fill(0), S: Array(12).fill(0) };
    for (let i = 0; i < 3000; i++) {
      const c = Math.floor(rnd() * 100000) + 1, m = Math.floor(rnd() * 12), t = rnd() < 0.5 ? 'E' : 'S';
      cent[t as 'E'][m] += c;
      ls.push(lanc(i, '2024-' + String(m + 1).padStart(2, '0') + '-15', t as 'E', c / 100, { conta: t === 'E' ? 'a1' : rnd() < 0.5 ? 'b1' : 'b2' }));
    }
    const r = resultadoEmColunas(ls, plano, colunas);
    for (let m = 0; m < 12; m++) {
      expect(Math.round(r.totais.entradas[m] * 100)).toBe(cent.E[m]);
      expect(Math.round(r.totais.saidas[m] * 100)).toBe(cent.S[m]);
      expect(Math.round(r.totais.resultado[m] * 100)).toBe(cent.E[m] - cent.S[m]);
      const g = r.saidas[0];
      expect(g.filhos.reduce((s: number, f: LinhaDoResultado) => s + Math.round(f.valores[m] * 100), 0)).toBe(Math.round(g.valores[m] * 100));
    }
  });

  it('o lançamento sem conta ou com conta apagada entra em "Sem conta" e nos totais', () => {
    const r = resultadoEmColunas([lanc(1, '2024-05-02', 'S', 7.77), lanc(2, '2024-05-03', 'S', 2.23, { conta: 'nao-existe' })], plano, colunas);
    expect(r.saidas).toMatchObject([{ conta: '', rotulo: 'Sem conta', total: 10 }]);
    expect(r.totais.saidas[4]).toBe(10);
  });

  it('o plano com ciclo (pai de um é filho do outro) não trava', () => {
    const ciclo = [conta('x', '9', 'X', 'y'), conta('y', '9.1', 'Y', 'x')];
    expect(() => resultadoEmColunas([lanc(1, '2024-05-02', 'E', 10, { conta: 'x' })], ciclo, colunas)).not.toThrow();
  });

  it('ida e volta da planilha: colunas, recuo da árvore, total e resultado', () => {
    const r = resultadoEmColunas([lanc(1, '2024-01-10', 'E', 100.1, { conta: 'a1' }), lanc(2, '2024-12-10', 'S', 0.2, { conta: 'b1' })], plano, colunas);
    const ls = reler(planilhaDoResultado(r, 'Resultado 2024', true));
    expect(ls[0][0]).toBe('Resultado 2024');
    expect(ls[2]).toHaveLength(14);
    expect(ls[2][13]).toBe('Total');
    const achar = (t: string) => ls.find(l => String(l[0]) === t)!;
    expect(achar('  1.1 Honorários')[1]).toBe(100.1);
    expect(achar('Total de saídas')[12]).toBe(0.2);
    expect(achar('Resultado (entradas − saídas)')[13]).toBe(99.9);
  });
});

describe('as Contas a pagar e os Honorários', () => {
  const c = (numero: number, o: Partial<ContaAPagar>): ContaAPagar => ({ id: 'c' + numero, numero, fornecedorId: 'f', documento: '00077', emissao: '2026-01-02', vencimento: '2026-01-31', valor: 10.1, ...o } as unknown as ContaAPagar);

  it('ida e volta: documento com zero à frente, ID texto, valores e totais', () => {
    const itens = [{ conta: c(1, {}), fornecedor: 'Papelaria São João' }, { conta: c(2, { vencimento: '2026-03-31', valor: 20.2, pagamento: { data: '2026-03-30', valorPago: 20.2 } as ContaAPagar['pagamento'] }), fornecedor: 'Água' }];
    const ls = reler(planilhaDasContas(itens, '2026-02-15', 'Filtro: todos'));
    expect(ls[3]).toEqual([...CABECALHO_DAS_CONTAS]);
    expect(ls[4].slice(0, 7)).toEqual(['1', 'Papelaria São João', '00077', '', '02/01/2026', '31/01/2026', 10.1]);
    expect(ls[5][8]).toBe('30/03/2026');
    expect(linhasDasContas(itens, '2026-02-15', '').at(-3)?.[6]).toBeCloseTo(30.3, 10);
  });

  it('juros e desconto em centavos', () => {
    expect(valorComJuros(0.1, 0.2, 0)).toBe(0.3);
    expect(valorComJuros(1000.1, 0.05, 0.15)).toBe(1000);
  });

  it('a recorrência no fim do mês não pula mês (31/01 → 28/02 → 31/03; bissexto 29/02; virada de ano)', () => {
    expect(vencimentosDaRecorrencia('2026-01-31', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(vencimentosDaRecorrencia('2024-01-31', 2)).toEqual(['2024-01-31', '2024-02-29']);
    expect(vencimentosDaRecorrencia('2026-11-30', 3)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
  });

  it('honorários: competência no título, valor combinado em aberto e o recebido quando pago', () => {
    const linhas: LinhaDeHonorario[] = [
      { contrato: { codigo: 12, nome: 'Açaí da Vila', valor: 300 } as unknown as LinhaDeHonorario['contrato'], recebimento: null },
      { contrato: { codigo: 13, nome: 'Beta', valor: 300 } as unknown as LinhaDeHonorario['contrato'], recebimento: { valor: 280.5, recebidoEm: '2026-02-01', forma: 'pix' } as LinhaDeHonorario['recebimento'] },
    ];
    expect(linhasDosHonorarios('2026-01', linhas)[0][0]).toBe('Honorários — 01/2026');
    const ls = reler(planilhaDosHonorarios('2026-01', linhas));
    expect(ls[3]).toEqual([12, 'Açaí da Vila', 300, 'Em aberto', '', '']);
    expect(ls[4].slice(0, 5)).toEqual([13, 'Beta', 280.5, 'Pago', '01/02/2026']);
  });

  it('a competência anterior vira o ano em janeiro', () => {
    expect(competenciaAnterior('2027-01-15')).toBe('2026-12');
    expect(competenciaAnterior('2026-03-31')).toBe('2026-02');
  });
});

describe('o reajuste, no meio centavo', () => {
  it('5.565,00 + 25,1% = 6.961,815 sobe para 6.961,82', () => expect(valorReajustado(5565, 25.1)).toBe(6961.82));
  it('bate com a conta em inteiros, em 20.000 sorteios', () => {
    const r = gerador(1515);
    for (let i = 0; i < 20000; i++) {
      const c = Math.floor(r() * 2_000_000) + 1, milesimos = Math.floor(r() * 300);
      // pct em décimos (4,5%): c × (1000 + d) / 1000, meio centavo para cima
      const certo = Math.floor((2 * c * (1000 + milesimos) + 1000) / 2000) / 100;
      expect(valorReajustado(c / 100, milesimos / 10), c + ' ' + milesimos).toBe(certo);
    }
  });
  it('arredondar no real e de 5 em 5 continua para cima', () => {
    expect(valorReajustado(300, 10, 'real')).toBe(330);
    expect(valorReajustado(301.01, 0, 'real')).toBe(302);
    expect(valorReajustado(301, 0, 'cinco')).toBe(305);
  });
});

describe('o extrato do banco', () => {
  it('importar de novo não duplica; a linha igual dentro do extrato não some', () => {
    const lidas = [{ data: '2026-03-02', valor: -1050, historico: 'Tarifa' }, { data: '2026-03-02', valor: -1050, historico: 'Tarifa' }, { data: '2026-03-03', valor: 30000, historico: 'Pix  recebido' }];
    const a = linhasDoExtrato(lidas, 'Sicoob', 'imp1', 'cc1'), b = linhasDoExtrato(lidas, 'Sicoob', 'imp2', 'cc1');
    expect(new Set(a.map(l => l.id)).size).toBe(3);
    expect(b.map(l => l.id)).toEqual(a.map(l => l.id));
    expect(separarJaImportadas(b, a)).toMatchObject({ novas: [] });
    expect(resumoDoExtrato(a)).toEqual({ de: '2026-03-02', ate: '2026-03-03', quantos: 3, entradas: 300, saidas: 21 });
  });
  it('o saldo pelo movimento fecha em centavos; o impresso do último dia manda', () => {
    const r = gerador(31);
    let s = 12345;
    const lidas = Array.from({ length: 2000 }, () => { const v = Math.floor(r() * 200000) - 100000; s += v; return { data: '2026-03-02', valor: v, historico: 'x' }; });
    expect(saldoFinalDoExtrato(lidas, 12345)).toBe(s / 100);
    expect(saldoFinalDoExtrato(lidas, 0, [{ data: '2026-03-03', saldo: 500 }, { data: '2026-03-01', saldo: 900 }])).toBe(5);
    expect(saldoFinalDoExtrato([])).toBeUndefined();
  });
});

describe('o boleto (ida e volta da linha digitável)', () => {
  /** monta uma linha digitável válida do banco a partir do fator e do valor */
  function linhaDoBanco(fator: number, centavos: number, livre: string): string {
    const fv = String(fator).padStart(4, '0') + String(centavos).padStart(10, '0');
    const sem = '001' + '9' + fv + livre;
    const dv = modulo11DoBanco(sem);
    const c1 = '0019' + livre.slice(0, 5), c2 = livre.slice(5, 15), c3 = livre.slice(15, 25);
    return c1 + modulo10(c1) + c2 + modulo10(c2) + c3 + modulo10(c3) + dv + fv;
  }
  it('fator, valor e dígitos sorteados voltam iguais, nos dois ciclos do fator', () => {
    const r = gerador(2025);
    for (let i = 0; i < 300; i++) {
      const fator = 1000 + Math.floor(r() * 9000), c = Math.floor(r() * 99999999) + 1;
      const livre = Array.from({ length: 25 }, () => Math.floor(r() * 10)).join('');
      const l = lerLinhaDigitavel(linhaFormatada(linhaDoBanco(fator, c, livre)), '2026-06-15');
      expect(l).toMatchObject({ tipo: 'bancario', valor: c / 100, vencimento: vencimentoDoFator(fator, '2026-06-15') });
    }
  });
  it('os limites do fator', () => {
    expect(vencimentoDoFator(9999, '2025-02-01')).toBe('2025-02-21');
    expect(vencimentoDoFator(1000, '2025-03-01')).toBe('2025-02-22');
    expect(vencimentoDoFator(1000, '2000-07-01')).toBe('2000-07-03');
    expect(vencimentoDoFator(999, '2026-01-01')).toBe('');
  });
  it('um dígito errado não passa', () => {
    const l = linhaDoBanco(1500, 12345, '1234567890123456789012345');
    expect(lerLinhaDigitavel(l, '2026-06-15')).not.toBeNull();
    const errada = l.slice(0, 40) + ((Number(l[40]) + 1) % 10) + l.slice(41);
    expect(lerLinhaDigitavel(errada, '2026-06-15')).toBeNull();
  });
  it('a arrecadação com módulo 11 lê o valor', () => {
    const corpo = '848' + '0' + '00000012345' + '12345678901234567890123456789';
    const sem = corpo.slice(0, 3) + corpo.slice(4);
    const cod = corpo.slice(0, 3) + modulo11DaArrecadacao(sem) + corpo.slice(4);
    const linha = [0, 1, 2, 3].map(i => { const b = cod.slice(i * 11, i * 11 + 11); return b + modulo11DaArrecadacao(b); }).join('');
    expect(lerLinhaDigitavel(linha, '2026-06-15')).toMatchObject({ tipo: 'arrecadacao', valor: 123.45, vencimento: null });
  });
});
