// O ShadersCI (23/11/2026): os planos padrão do SCI, a conferência do lançamento, o copiar e colar e a planilha do gerador.
// Dados fictícios (o CNPJ é de teste).
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  alterarEmLote, buscarHistoricos, buscarNoPlano, contaDoPlano, contaForaDoLado, dataDoTexto, diaSemLancamento, feriadoNacional, historicoDoSci, invertido, LANCAMENTO_VAZIO, lancamentoLimpo, lancamentosDoShaderParaOSci, lancamentosDoTexto,
  ladoDaPartida, participanteDoLado, pascoa, problemasDaPartida, problemasDosLancamentos, totaisDoMultiplo, planilhaDoSci, planoDoSci, problemasDoLancamento, resumoDosLancamentos, textoDosLancamentos, valorDoTexto, valorParaTexto, type CamposDoLancamento,
} from './index';
import { FERIADOS } from '../tarefas/regras/feriados';

const CNPJ = '11222333000181';
const p113 = planoDoSci('90113');
const p011 = planoDoSci('90011');

const base: CamposDoLancamento = { ...LANCAMENTO_VAZIO, data: '2026-11-05', debito: '5', credito: '7', valor: 15000, historico: '1', complemento: 'Depósito', documento: '10' };

describe('os planos', () => {
  it('lê os dois planos e marca as analíticas (sem filhas)', () => {
    // 25/11/2026: o 90113 ganhou o Nubank (765, sintética, e 766, analítica)
    expect(p113.contas.length).toBe(716);
    expect(contaDoPlano(p113, '766')).toMatchObject({ classificacao: '01.1.1.02.008.001', nome: 'Nubank S.A', analitica: true });
    expect(contaDoPlano(p113, '765')?.analitica).toBe(false);
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
    expect(problemasDoLancamento(LANCAMENTO_VAZIO, p113)).toEqual(['sem data', 'sem conta de débito', 'sem conta de crédito', 'sem valor', 'sem histórico', 'sem documento']);
    expect(problemasDoLancamento({ ...base, debito: '15' }, p113)).toContain('a conta 15 é sintética (só a analítica recebe lançamento)');
    expect(problemasDoLancamento({ ...base, debito: '99999' }, p113)).toContain('a conta 99999 não está no plano');
    expect(problemasDoLancamento({ ...base, credito: '5' }, p113)).toContain('débito e crédito na mesma conta');
    expect(problemasDoLancamento({ ...base, historico: 'Depósito' }, p113)).toContain('o histórico é só o número do histórico padrão');
    expect(problemasDoLancamento({ ...base, historico: '3' }, p113)).toContain('o histórico 3 não está no plano de históricos');
  });

  // 24/11/2026: "Campos obrigatorios para o lançamento do documento: Data, Valor, debito, crédito, numero do historico, complemento, documento";
  // no mesmo dia, "o complemento nao e obrigatorio"
  it('pede o documento; o complemento é opcional', () => {
    expect(problemasDoLancamento({ ...base, complemento: '', documento: '' }, p113)).toEqual(['sem documento']);
    expect(problemasDoLancamento({ ...base, complemento: '' }, p113)).toEqual([]);
    // o 159 (Débito tarifa bancária cfe. extrato) pula o complemento
    expect(problemasDoLancamento({ ...base, historico: '159', complemento: '' }, p113)).toEqual([]);
  });

  // 24/11/2026: "nao deixa lançar nos sábados e feriados nacionais"
  it('não lança no sábado nem no feriado nacional', () => {
    expect(problemasDoLancamento({ ...base, data: '2026-11-07' }, p113)).toEqual(['07/11/2026 é sábado: não se lança']);
    expect(problemasDoLancamento({ ...base, data: '2026-11-02' }, p113)).toEqual(['02/11/2026 é feriado nacional (Finados): não se lança']);
    // o domingo e o ponto facultativo entram
    expect(problemasDoLancamento({ ...base, data: '2026-11-08' }, p113)).toEqual([]);
    expect(problemasDoLancamento({ ...base, data: '2026-02-17' }, p113)).toEqual([]);
  });

  // 24/11/2026: "CD apenas em crédito e FD apenas em débito"; o participante só no crédito da CD e no débito da FD
  it('a CD só a crédito, com o cliente; a FD só a débito, com o fornecedor', () => {
    const recebimento = { ...base, debito: '7', credito: '16' };
    expect(problemasDoLancamento(recebimento, p113)).toEqual(['falta o cliente (participante) no crédito']);
    expect(problemasDoLancamento({ ...recebimento, participanteC: '120' }, p113)).toEqual([]);
    const pagamento = { ...base, debito: '148', credito: '7' };
    expect(problemasDoLancamento(pagamento, p113)).toEqual(['falta o fornecedor (participante) no débito']);
    expect(problemasDoLancamento({ ...pagamento, participanteD: '45' }, p113)).toEqual([]);
    expect(problemasDoLancamento({ ...base, debito: '16', credito: '7', participanteD: '120' }, p113)).toEqual(['a conta 16 (Clientes nacionais) só entra a crédito', 'a conta 16 não leva participante no débito']);
    expect(problemasDoLancamento({ ...base, debito: '159', credito: '100005' }, p011)).toContain('a conta 100005 (Fornecedores) só entra a débito');
    // os outros clientes (CDV) não levam participante
    expect(problemasDoLancamento({ ...base, credito: '18', participanteC: '120' }, p113)).toContain('a conta 18 não leva participante no crédito');
    expect(problemasDoLancamento({ ...base, participanteC: '7' }, p113)).toContain('a conta 7 não leva participante no crédito');
    expect(participanteDoLado(contaDoPlano(p011, 'CD'), 'credito')).toBe('cliente');
    expect(contaForaDoLado(contaDoPlano(p011, 'FD')!, 'credito')).toBe(true);
  });

  it('o apelido vira o código e o inverter troca as contas e os participantes', () => {
    expect(lancamentoLimpo({ ...base, debito: 'cx', credito: ' fd ' }, p113)).toMatchObject({ debito: '5', credito: '148' });
    expect(lancamentoLimpo({ ...base, historico: ' pgto ' }, p113).historico).toBe('1000');
    expect(invertido({ ...base, participanteD: 'A', participanteC: 'B' })).toMatchObject({ debito: '7', credito: '5', participanteD: 'B', participanteC: 'A' });
  });

  it('o resumo soma os prontos à parte', () => {
    expect(resumoDosLancamentos([base, { ...base, valor: 500, data: '' }], p113)).toEqual({ quantos: 2, prontos: 1, comProblema: 1, total: 15500, totalPronto: 15000 });
  });
});

// 24/11/2026: "uma funcao chamada lançamento multiplo, onde debito e credito tem que bater com partidas simples" (dados fictícios)
describe('o lançamento múltiplo', () => {
  const p = (lado: 'd' | 'c', conta: string, valor: number, extra: Partial<CamposDoLancamento> = {}): CamposDoLancamento =>
    ({ ...base, debito: lado === 'd' ? conta : '', credito: lado === 'c' ? conta : '', valor, multiplo: 'M1', ...extra });
  // o pagamento de duas guias pelo caixa: um crédito e dois débitos
  const multiplo = [p('c', '5', 15000), p('d', '15', 0), p('d', '148', 10000, { participanteD: '45' }), p('d', '7', 5000)].filter(l => l.valor);

  it('cada partida tem um lado só, com a conta e o participante daquele lado', () => {
    expect(ladoDaPartida(multiplo[0])).toBe('credito');
    expect(ladoDaPartida({ ...base })).toBeNull();
    expect(problemasDaPartida(multiplo[1], p113)).toEqual([]);
    expect(problemasDaPartida({ ...multiplo[1], participanteD: '' }, p113)).toEqual(['falta o fornecedor (participante) no débito']);
    expect(problemasDaPartida({ ...base, multiplo: 'M1' }, p113)).toContain('a partida tem débito e crédito (no múltiplo, cada partida tem um lado só)');
    expect(problemasDaPartida(p('d', '16', 100), p113)).toContain('a conta 16 (Clientes nacionais) só entra a crédito');
  });

  it('só fica pronto quando os débitos batem com os créditos', () => {
    expect(totaisDoMultiplo(multiplo)).toEqual({ debito: 15000, credito: 15000, diferenca: 0 });
    expect(problemasDosLancamentos([base, ...multiplo], p113)).toEqual([[], [], [], []]);
    const torto = [multiplo[0], multiplo[1], { ...multiplo[2], valor: 4000 }];
    expect(problemasDosLancamentos(torto, p113).every(x => x.includes('o múltiplo não bate: débitos 140,00 × créditos 150,00'))).toBe(true);
    expect(problemasDosLancamentos([multiplo[0]], p113)[0]).toContain('o múltiplo precisa de pelo menos um débito e um crédito');
    // uma partida com problema segura as outras
    const comFalha = [multiplo[0], { ...multiplo[1], historico: '' }, multiplo[2]];
    expect(problemasDosLancamentos(comFalha, p113)[0]).toEqual(['outra partida deste múltiplo tem problema']);
  });

  it('vai para a planilha do SCI com um lado em cada linha', () => {
    const lsci = lancamentosDoShaderParaOSci(multiplo, p113, CNPJ);
    expect(lsci.map(l => [l.debito, l.credito, l.valor, l.problemas.length])).toEqual([['', '5', 15000, 0], ['148', '', 10000, 0], ['7', '', 5000, 0]]);
    expect(resumoDosLancamentos(multiplo, p113)).toMatchObject({ quantos: 3, prontos: 3 });
  });
});

// 25/11/2026: "Coloca alguma funcao de alterar em lote: data, conta debito, conta credito, valor, numero do historico";
// "Lancamentos em lote nao muda multiplos, deixe isso como regra"
describe('alterar em lote', () => {
  const l = (id: string, extra: Partial<CamposDoLancamento> = {}) => ({ ...base, id, ...extra });
  const lista = [l('a'), l('b'), l('c', { debito: '', multiplo: 'M1' }), l('d')];

  it('muda só os marcados e os campos preenchidos', () => {
    const r = alterarEmLote(lista, new Set(['a', 'b']), { data: '2026-11-10', valor: 2500, historico: '159' }, p113);
    expect(r.mudados).toBe(2);
    expect(r.lancamentos[0]).toMatchObject({ data: '2026-11-10', valor: 2500, historico: '159', debito: '5', credito: '7', complemento: 'Depósito' });
    expect(r.lancamentos[3]).toBe(lista[3]);
  });

  it('não mexe nos múltiplos, e conta quantos ficaram de fora', () => {
    const r = alterarEmLote(lista, new Set(['a', 'c']), { debito: '7', credito: '5' }, p113);
    expect(r).toMatchObject({ mudados: 1, multiplos: 1 });
    expect(r.lancamentos[2]).toBe(lista[2]);
  });

  it('a conta que não pede participante apaga o daquele lado; a que pede mantém', () => {
    const comFornecedor = [l('x', { debito: '148', participanteD: '45' })];
    expect(alterarEmLote(comFornecedor, new Set(['x']), { debito: '7' }, p113).lancamentos[0].participanteD).toBe('');
    expect(alterarEmLote(comFornecedor, new Set(['x']), { data: '2026-11-06' }, p113).lancamentos[0].participanteD).toBe('45');
  });

  it('nada a mudar: a mesma lista e zero mudados', () => {
    const r = alterarEmLote(lista, new Set(['a']), { data: base.data }, p113);
    expect(r.mudados).toBe(0);
    expect(r.lancamentos[0]).toBe(lista[0]);
  });
});

describe('os históricos e os dias', () => {
  it('acha o histórico pelo número e pelo apelido, e busca pelo nome', () => {
    expect(historicoDoSci('1000')).toMatchObject({ apelido: 'PGTO', pulaComplemento: false });
    expect(historicoDoSci('receb')?.codigo).toBe('2000');
    expect(historicoDoSci('159')?.pulaComplemento).toBe(true);
    expect(historicoDoSci('3')).toBeNull();
    expect(buscarHistoricos('tarifa').map(h => h.codigo)).toContain('159');
  });

  it('os feriados nacionais batem com os do calendário do Início', () => {
    expect(pascoa(2026)).toBe('2026-04-05');
    for (const f of FERIADOS.filter(x => x.tipo === 'feriado')) {
      // os municipais (São Sebastião, Nossa Senhora de Fátima, São João Batista, a Emancipação) ficam de fora
      const municipal = /Sebasti|Fátima|João Batista|Emancipa/.test(f.nome);
      expect(feriadoNacional(f.data) !== null, f.nome).toBe(!municipal);
    }
    expect(feriadoNacional('2025-04-18')).toBe('Paixão de Cristo');
    expect(diaSemLancamento('2026-11-24')).toBeNull();
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
    expect(lancamentosDoTexto('05/11/2026\t5\t7\t150,00\t1\tDepósito\t10\n\n', 2026)).toEqual([base]);
    expect(lancamentosDoTexto('5/11;5;7;150;1;Depósito;10', 2026)).toEqual([base]);
  });
});

describe('a planilha do SCI', () => {
  it('os prontos em Importar (sem lote), os outros em Conferir, com o CNPJ e o nome das contas', () => {
    const lsci = lancamentosDoShaderParaOSci([base, { ...base, debito: '7', credito: '16', participanteC: '120' }, { ...base, valor: 0 }], p113, CNPJ);
    expect(lsci.map(l => l.problemas)).toEqual([[], [], ['sem valor']]);
    expect(lsci[1]).toMatchObject({ lote: '', cnpjEmpresa: '11.222.333/0001-81', participanteC: '120', nomeC: 'Clientes nacionais', origem: 'minimum' });
    const wb = XLSX.read(planilhaDoSci(lsci), { type: 'array' });
    expect(wb.SheetNames).toEqual(['Importar', 'Conferir']);
    const importar = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Importar, { header: 1, raw: true, defval: '' });
    // títulos e 2 lançamentos, sem a linha do total (o gerador lê da linha 2 e descarta 0 no fim)
    expect(importar.length).toBe(3);
    expect(importar[2].slice(1, 11)).toEqual([7, 16, 150, 1, 'Depósito', '10', '', '11.222.333/0001-81', '', '120']);
  });

  it('sem CNPJ válido, nada fica pronto', () => {
    expect(lancamentosDoShaderParaOSci([base], p113, '123')[0].problemas).toEqual(['CNPJ da empresa inválido']);
  });
});
