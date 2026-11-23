// O ShadersCI (23/11/2026): os planos padrão do SCI, a conferência do lançamento, o copiar e colar e a planilha do gerador.
// Dados fictícios (o CNPJ é de teste).
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  buscarNoPlano, contaDoPlano, dataDoTexto, invertido, LANCAMENTO_VAZIO, lancamentoLimpo, lancamentosDoShaderParaOSci, lancamentosDoTexto,
  planilhaDoSci, planoDoSci, problemasDoLancamento, resumoDosLancamentos, textoDosLancamentos, valorDoTexto, valorParaTexto, type CamposDoLancamento,
} from './index';

const CNPJ = '11222333000181';
const p113 = planoDoSci('90113');
const p011 = planoDoSci('90011');

const base: CamposDoLancamento = { ...LANCAMENTO_VAZIO, data: '2026-11-05', debito: '5', credito: '7', valor: 15000, historico: '1', complemento: 'Depósito' };

describe('os planos', () => {
  it('lê os dois planos e marca as analíticas (sem filhas)', () => {
    expect(p113.contas.length).toBe(714);
    expect(p011.contas.length).toBe(573);
    expect(contaDoPlano(p113, '16')).toMatchObject({ classificacao: '01.1.2.01.001', nome: 'Clientes nacionais', analitica: true });
    expect(contaDoPlano(p011, '159')).toMatchObject({ nome: 'Clientes nacionais', analitica: true });
    expect(contaDoPlano(p113, '15')?.analitica).toBe(false);
    // o 90011 tem uma conta de 6 níveis: a de 5 níveis acima dela é sintética
    expect(p011.contas.filter(c => c.classificacao === '04.2.1.99.100').map(c => c.analitica)).toEqual([false]);
  });

  it('acha a conta pelo apelido e marca as de participante', () => {
    expect(contaDoPlano(p113, 'cx')?.codigo).toBe('5');
    expect(contaDoPlano(p113, '16')?.participante).toBe('cliente');
    expect(contaDoPlano(p113, '148')?.participante).toBe('fornecedor');
    expect(contaDoPlano(p011, '100005')?.participante).toBe('fornecedor');
    // o adiantamento a fornecedores fica no ativo, fora do grupo dos fornecedores
    expect(contaDoPlano(p113, '37')?.participante).toBeNull();
    expect(contaDoPlano(p113, '5')?.participante).toBeNull();
  });

  it('busca pelo código, pela classificação e pelo nome, só nas analíticas', () => {
    expect(buscarNoPlano(p113, '16')[0].codigo).toBe('16');
    expect(buscarNoPlano(p113, '01.1.1.02').map(c => c.nome)).toContain('Banco do Brasil S/A');
    expect(buscarNoPlano(p113, 'fornecedores').every(c => c.analitica)).toBe(true);
    expect(buscarNoPlano(p113, 'economica')[0].nome).toBe('Caixa Econômica Federal S/A');
  });
});

describe('o lançamento', () => {
  it('pronto quando tem tudo', () => {
    expect(problemasDoLancamento(base, p113)).toEqual([]);
  });

  it('aponta o que falta', () => {
    expect(problemasDoLancamento(LANCAMENTO_VAZIO, p113)).toEqual(['sem data', 'sem conta de débito', 'sem conta de crédito', 'sem valor', 'sem histórico']);
    expect(problemasDoLancamento({ ...base, debito: '15' }, p113)).toContain('a conta 15 é sintética (só a analítica recebe lançamento)');
    expect(problemasDoLancamento({ ...base, debito: '99999' }, p113)).toContain('a conta 99999 não está no plano');
    expect(problemasDoLancamento({ ...base, credito: '5' }, p113)).toContain('débito e crédito na mesma conta');
    expect(problemasDoLancamento({ ...base, historico: 'Depósito' }, p113)).toContain('o histórico é só o número do histórico padrão');
  });

  it('pede o participante nas contas de clientes e fornecedores, e só nelas', () => {
    const venda = { ...base, debito: '16', credito: '5' };
    expect(problemasDoLancamento(venda, p113)).toEqual(['falta o cliente (participante) no débito']);
    expect(problemasDoLancamento({ ...venda, participanteD: '120' }, p113)).toEqual([]);
    expect(problemasDoLancamento({ ...base, participanteC: '7' }, p113)).toContain('a conta 7 não leva participante');
  });

  it('o apelido vira o código e o inverter troca as contas e os participantes', () => {
    expect(lancamentoLimpo({ ...base, debito: 'cx', credito: ' fd ' }, p113)).toMatchObject({ debito: '5', credito: '148' });
    expect(invertido({ ...base, participanteD: 'A', participanteC: 'B' })).toMatchObject({ debito: '7', credito: '5', participanteD: 'B', participanteC: 'A' });
  });

  it('o resumo soma os prontos à parte', () => {
    expect(resumoDosLancamentos([base, { ...base, valor: 500, data: '' }], p113)).toEqual({ quantos: 2, prontos: 1, comProblema: 1, total: 15500, totalPronto: 15000 });
  });
});

describe('o que se digita', () => {
  it('o valor', () => {
    expect(valorDoTexto('1.234,56')).toBe(123456);
    expect(valorDoTexto('1234.5')).toBe(123450);
    expect(valorDoTexto('1.234')).toBe(123400);
    expect(valorDoTexto('R$ 10')).toBe(1000);
    expect(valorDoTexto('abc')).toBeNaN();
    expect(valorParaTexto(123456)).toBe('1.234,56');
  });

  it('a data, com o ano da referência quando falta', () => {
    expect(dataDoTexto('05/11/2026', 2025)).toBe('2026-11-05');
    expect(dataDoTexto('5/11', 2026)).toBe('2026-11-05');
    expect(dataDoTexto('5/11/26', 2025)).toBe('2026-11-05');
    expect(dataDoTexto('05112026', 2025)).toBe('2026-11-05');
    expect(dataDoTexto('31/02/2026', 2026)).toBe('');
  });
});

describe('copiar e colar', () => {
  it('o texto copiado volta igual ao colar', () => {
    const ls = [base, { ...base, debito: '16', participanteD: '120', valor: 123456, complemento: 'NF 10\tparcela 1' }];
    const texto = textoDosLancamentos(ls);
    expect(texto.split('\r\n')[0]).toBe('Data\tDébito\tCrédito\tValor\tHistórico\tComplemento\tDocumento\tParticipante D\tParticipante C');
    expect(lancamentosDoTexto(texto, 2026)).toEqual([base, { ...ls[1], complemento: 'NF 10 parcela 1' }]);
  });

  it('cola do Excel sem os títulos, ou separado por ponto e vírgula', () => {
    expect(lancamentosDoTexto('05/11/2026\t5\t7\t150,00\t1\tDepósito\n\n', 2026)).toEqual([base]);
    expect(lancamentosDoTexto('5/11;5;7;150;1;Depósito', 2026)).toEqual([base]);
  });
});

describe('a planilha do SCI', () => {
  it('os prontos em Importar (sem lote), os outros em Conferir, com o CNPJ e o nome das contas', () => {
    const lsci = lancamentosDoShaderParaOSci([base, { ...base, debito: '16', credito: '5', participanteD: '120' }, { ...base, valor: 0 }], p113, CNPJ);
    expect(lsci.map(l => l.problemas)).toEqual([[], [], ['sem valor']]);
    expect(lsci[1]).toMatchObject({ lote: '', cnpjEmpresa: '11.222.333/0001-81', participanteD: '120', nomeD: 'Clientes nacionais', origem: 'ShadersCI' });
    const wb = XLSX.read(planilhaDoSci(lsci), { type: 'array' });
    expect(wb.SheetNames).toEqual(['Importar', 'Conferir']);
    const importar = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Importar, { header: 1, raw: true, defval: '' });
    // títulos, 2 lançamentos e a linha do total (o gerador lê da linha 2 e descarta 1 no fim)
    expect(importar.length).toBe(4);
    expect(importar[2].slice(1, 11)).toEqual([16, 5, 150, 1, 'Depósito', '', '', '11.222.333/0001-81', '120', '']);
  });

  it('sem CNPJ válido, nada fica pronto', () => {
    expect(lancamentosDoShaderParaOSci([base], p113, '123')[0].problemas).toEqual(['CNPJ da empresa inválido']);
  });
});
