// A Projeção do Fator R (26/11/2026). Todos os números são inventados; as contas são as das fórmulas da planilha
// "PROJEÇÃO FATOR R 6.0" (aba FOLHA: N5 = SOMA da folha de 12 linhas, R5 = SOMA do faturamento; aba PROJEÇÃO: J15 = N5/R5,
// J29 = folha do mês / receita do mês, J31 = FS12/RBT12 da janela da projeção).
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { extratoDoPgdas } from '../pgdas/extrato';
import {
  anoPadraoDaProjecao, anosDaProjecao, comOExtrato, competenciasDaProjecao, competenciasEntre, comValorDoMes, fatorRDoPa, fatorRVazio,
  htmlDoFatorR, idDoFatorR, lerFatorRDoAno, linhasDoFatorR, mesesDaEmpresa, planilhaDoFatorR, relatorioDoFatorR, somarMeses,
  type FatorRDoAno, type MesDoFatorR,
} from './index';

const dig = (valor: number) => ({ valor, fonte: 'digitado' as const });

// a aba FOLHA de uma empresa fictícia: de 11/2025 a 10/2026 os meses fechados; depois, a projeção de 2027
const FECHADOS = competenciasEntre('2025-11', '2026-10');
function planilhaFicticia(): Record<string, MesDoFatorR> {
  const meses: Record<string, MesDoFatorR> = {};
  FECHADOS.forEach((c, i) => { meses[c] = { receita: dig(40000 + 1000 * i), folha: dig(11000 + 100 * i) }; });
  // 11/2026 e 12/2026 em branco, como na planilha; a projeção de 2027 com a receita e a folha digitadas
  competenciasEntre('2027-01', '2027-12').forEach((c, i) => { meses[c] = { receita: dig(50000), folha: dig(14000 + 500 * i) }; });
  return meses;
}
/** a fórmula da planilha: SOMA de 12 linhas da aba FOLHA a partir de uma competência */
const somaDaPlanilha = (meses: Record<string, MesDoFatorR>, de: string, k: 'receita' | 'folha') =>
  competenciasEntre(de, somarMeses(de, 11)).reduce((s, c) => s + (meses[c]?.[k]?.valor ?? 0), 0);

describe('fatorRDoPa', () => {
  const meses = planilhaFicticia();

  it('o "banco de dados" da planilha: 11/2025 a 10/2026 é o Fator R do PA 11/2026', () => {
    const r = fatorRDoPa(meses, '2026-11');
    expect([r.de, r.ate]).toEqual(['2025-11', '2026-10']);
    // 12 × 40.000 + 1.000 × (0 + … + 11) e 12 × 11.000 + 100 × 66
    expect(r.rbt12).toBe(546000);
    expect(r.fs12).toBe(138600);
    expect(r.rbt12).toBe(somaDaPlanilha(meses, '2025-11', 'receita'));
    expect(r.fs12).toBe(somaDaPlanilha(meses, '2025-11', 'folha'));
    // 138.600 / 546.000 = 25,3846…% → 25,38%
    expect(r.fator).toBe(25.38);
    expect(r.anexo).toBe('V');
    // 28% de 546.000 = 152.880; faltam 14.280
    expect(r.folhaQueFalta).toBe(14280);
    expect([r.mesesComReceita, r.mesesComFolha]).toEqual([12, 12]);
  });

  it('as 12 projeções da planilha: cada janela é a SOMA de 12 linhas da aba FOLHA', () => {
    // "Projeção 1" (jan/27 na planilha) soma 12/2025 a 11/2026: o PA de 12/2026; "Projeção 12" soma 11/2026 a 10/2027
    for (let k = 0; k < 12; k++) {
      const pa = somarMeses('2026-12', k);
      const r = fatorRDoPa(meses, pa);
      const de = somarMeses('2025-12', k);
      expect(r.de).toBe(de);
      expect(r.rbt12).toBeCloseTo(somaDaPlanilha(meses, de, 'receita'), 2);
      expect(r.fs12).toBeCloseTo(somaDaPlanilha(meses, de, 'folha'), 2);
      const ratio = somaDaPlanilha(meses, de, 'folha') / somaDaPlanilha(meses, de, 'receita');
      expect(r.fator).toBe(Math.trunc(ratio * 10000) / 100);
    }
  });

  it('sem receita na janela, sem Fator R (o SEERRO da planilha)', () => {
    const r = fatorRDoPa({}, '2026-01');
    expect(r).toMatchObject({ rbt12: 0, fs12: 0, fator: null, anexo: null, folhaQueFalta: null, mesesComReceita: 0 });
  });

  it('27,996% fica no Anexo V; com a folha que falta, chega aos 28% e vai para o III', () => {
    const meses: Record<string, MesDoFatorR> = { '2026-01': { receita: dig(100000), folha: dig(27996) } };
    const r = fatorRDoPa(meses, '2026-02');
    expect([r.fator, r.anexo, r.folhaQueFalta]).toEqual([27.99, 'V', 4]);
    meses['2026-01'] = { receita: dig(100000), folha: dig(27996 + 4) };
    expect(fatorRDoPa(meses, '2026-02')).toMatchObject({ fator: 28, anexo: 'III', folhaQueFalta: 0 });
    // receita quebrada: a folha que falta arredonda para cima, e chega
    meses['2026-01'] = { receita: dig(33333.33), folha: dig(0) };
    const q = fatorRDoPa(meses, '2026-02');
    meses['2026-01'] = { receita: dig(33333.33), folha: dig(q.folhaQueFalta as number) };
    expect(fatorRDoPa(meses, '2026-02').anexo).toBe('III');
  });
});

describe('linhasDoFatorR', () => {
  it('a linha do mês: a receita, a folha, o fator do mês (folha ÷ receita, a linha "Fator R:" da planilha) e o do PA', () => {
    const ls = linhasDoFatorR(planilhaFicticia(), '2027-01', '2027-12');
    expect(ls).toHaveLength(12);
    expect(ls[0]).toMatchObject({ competencia: '2027-01', receita: dig(50000), folha: dig(14000), fatorDoMes: 28, pa: '2027-01', de: '2026-01', ate: '2026-12' });
    // 11/2026 e 12/2026 em branco: a janela de 01/2027 tem 10 meses com número
    expect(ls[0].mesesComReceita).toBe(10);
    // o mês sem receita não tem fator do mês
    expect(linhasDoFatorR(planilhaFicticia(), '2026-11', '2026-11')[0].fatorDoMes).toBeNull();
  });
});

describe('o documento por empresa e ano', () => {
  it('o ano que a tela abre e os anos que ela lê', () => {
    expect(anoPadraoDaProjecao(new Date(2026, 10, 26))).toBe(2027);
    expect(anoPadraoDaProjecao(new Date(2026, 3, 1))).toBe(2026);
    expect(anosDaProjecao(2027)).toEqual([2025, 2026, 2027]);
    expect(competenciasDaProjecao(2027)).toHaveLength(24);
    expect(competenciasDaProjecao(2027)[0]).toBe('2026-01');
    expect(idDoFatorR(2027, 481)).toBe('2027_481');
  });

  it('troca e tira o valor do mês; recusa o negativo e o mês de outro ano', () => {
    let d = fatorRVazio(2027, 9001);
    d = comValorDoMes(d, '2027-03', 'receita', 1234.567);
    expect(d.receita).toEqual({ '03': 1234.57 });
    d = comValorDoMes(d, '2027-03', 'folha', 500, 'pdf');
    expect(d.doPdf).toEqual(['f03']);
    // digitar por cima tira a marca do PDF
    d = comValorDoMes(d, '2027-03', 'folha', 600);
    expect([d.folha, d.doPdf]).toEqual([{ '03': 600 }, []]);
    expect(comValorDoMes(d, '2027-03', 'receita', -1)).toBe(d);
    expect(comValorDoMes(d, '2026-03', 'receita', 1)).toBe(d);
    d = comValorDoMes(d, '2027-03', 'receita', null);
    expect(d.receita).toEqual({});
  });

  it('lê o documento do banco e deixa de fora o que não fecha', () => {
    const d = lerFatorRDoAno({ ano: 2027, codigo: 9001, receita: { '01': 10, '13': 5, '02': -1, '03': 'x' }, folha: { '01': 2 }, doPdf: ['r01', 'zz', 'r01'], atualizadoPor: 'Fulana' });
    expect(d).toEqual({ ano: 2027, codigo: 9001, receita: { '01': 10 }, folha: { '01': 2 }, doPdf: ['r01'], atualizadoEm: '', atualizadoPor: 'Fulana' });
    expect(lerFatorRDoAno({ ano: 2027, codigo: 0 })).toBeNull();
    expect(lerFatorRDoAno(null)).toBeNull();
  });

  it('o PGDAS-D do robô vale mais que o digitado (a receita e a folha do 2.3)', () => {
    const docs: FatorRDoAno[] = [
      { ...fatorRVazio(2026, 9001), receita: { '09': 1000, '10': 2000 }, folha: { '09': 300, '10': 400 }, doPdf: ['r10'] },
    ];
    const m = mesesDaEmpresa(docs, { meses: { '2026-10': { receita: 2500 } }, folhas: { '2026-09': { valor: 350 } } });
    expect(m['2026-09']).toEqual({ receita: { valor: 1000, fonte: 'digitado' }, folha: { valor: 350, fonte: 'pgdas' } });
    expect(m['2026-10']).toEqual({ receita: { valor: 2500, fonte: 'pgdas' }, folha: { valor: 400, fonte: 'digitado' } });
    expect(mesesDaEmpresa(docs, null)['2026-10'].receita).toEqual({ valor: 2000, fonte: 'pdf' });
  });
});

describe('o PDF do extrato do PGDAS-D subido na tela', () => {
  const TEXTO = [
    'Extrato do Simples Nacional Período de Apuração (PA): 10/2026 Número da Declaração: 99888777202610001',
    'CNPJ Matriz: 99.888.777/0001-66 Nome empresarial: CLINICA FICTICIA LTDA Data de abertura no CNPJ: 02/03/2015',
    'Receita Bruta do PA (RPA) - Competência 30.000,00 0,00 30.000,00',
    '2.2) Receitas Brutas Anteriores (R$) 2.2.1) Mercado Interno 11/2025 10.000,00 12/2025 20.000,00',
    '2.2.2) Mercado Externo 11/2025 0,00 12/2025 0,00',
    '2.3) Folha de Salários Anteriores (R$) 11/2025 3.000,00 12/2025 4.000,00',
    '3) Resumo da Declaração',
  ].join(' ');
  const empresa = { codigo: 9001, cnpj: '99888777000166' };

  it('enche a receita e a folha dos anos da tela, marcados como do PDF', () => {
    const atuais = new Map([[2026, { ...fatorRVazio(2026, 9001), folha: { '01': 1 } }]]);
    const r = comOExtrato(atuais, extratoDoPgdas(TEXTO), empresa, [2025, 2026, 2027]);
    if ('erro' in r) throw new Error(r.erro);
    expect([r.receitas, r.folhas, r.pa]).toEqual([3, 2, '2026-10']);
    const porAno = new Map(r.docs.map(d => [d.ano, d]));
    expect(porAno.get(2025)).toMatchObject({ receita: { '11': 10000, '12': 20000 }, folha: { '11': 3000, '12': 4000 }, doPdf: ['f11', 'f12', 'r11', 'r12'] });
    expect(porAno.get(2026)).toMatchObject({ receita: { '10': 30000 }, folha: { '01': 1 }, doPdf: ['r10'] });
    // só os anos da tela
    const so2026 = comOExtrato(new Map(), extratoDoPgdas(TEXTO), empresa, [2026]);
    expect('erro' in so2026 ? 0 : so2026.receitas).toBe(1);
  });

  it('recusa o PDF que não é extrato, o de outro CNPJ e o fora dos anos', () => {
    expect(comOExtrato(new Map(), extratoDoPgdas('um boleto qualquer'), empresa, [2026])).toEqual({ erro: 'Este PDF não é um extrato do PGDAS-D.' });
    expect(comOExtrato(new Map(), extratoDoPgdas(TEXTO), { codigo: 1, cnpj: '11222333000181' }, [2026])).toMatchObject({ erro: expect.stringMatching(/outro CNPJ/) });
    expect(comOExtrato(new Map(), extratoDoPgdas(TEXTO), empresa, [2030])).toMatchObject({ erro: expect.stringMatching(/nenhum mês/) });
  });
});

describe('Exportar Excel e Imprimir', () => {
  const linhas = linhasDoFatorR(planilhaFicticia(), '2026-11', '2027-01');
  const rel = relatorioDoFatorR({ empresa: { codigo: 9001, nome: 'CLINICA FICTICIA', cnpj: '99.888.777/0001-66' }, ano: 2027, linhas, hoje: fatorRDoPa(planilhaFicticia(), '2026-11') });

  it('a tabela: uma linha por mês, com a origem de cada número', () => {
    expect(rel.nome).toBe('Projeção Fator R 2027 9001');
    expect(rel.cabecalho).toContainEqual(['Fator R do PA 11/2026', '25,38% · Anexo V (11/2025 a 10/2026)']);
    expect(rel.linhas[0].slice(0, 3)).toEqual(['11/2026', '', '']);
    expect(rel.linhas[2].slice(0, 6)).toEqual(['01/2027', 50000, 'Digitado', 14000, 'Digitado', 28]);
  });

  it('a planilha abre com os números como número', () => {
    const wb = XLSX.read(planilhaDoFatorR(rel), { type: 'array' });
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Fator R'], { header: 1 });
    expect(aoa[0]).toEqual(['Projeção do Fator R 2027']);
    const jan = aoa.find(l => l[0] === '01/2027') as unknown[];
    expect(jan[1]).toBe(50000);
    expect(jan[9]).toBe('V');
  });

  it('a folha A4 colore o Anexo e escapa o texto', () => {
    const html = htmlDoFatorR({ ...rel, cabecalho: [['Empresa', '<b>X</b>']] });
    expect(html).toContain('class="t aV"');
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).toContain('size:A4 landscape');
  });
});
