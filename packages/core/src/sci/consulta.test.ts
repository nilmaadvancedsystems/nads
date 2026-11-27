// A consulta dos lançamentos do SCI, para ver no minimum (25/11/2026). Dados fictícios, no desenho da planilha que o SCI exporta:
// o título na primeira linha, uma coluna vazia entre os campos, o valor no jeito americano.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { dataDaConsulta, juntarConsultas, lancamentosDaConsulta, lerConsultaDoSci, nomesDosParticipantes, periodoDaCompetenciaDoSci, planoDaConsulta, valorDaConsulta, type LancamentoDaConsulta } from './index';

const TITULOS = [' ', '', 'Data', '', 'Débito', '', 'Crédito', '', 'Valor', '', 'Histórico', '', 'Complemento', '', 'Nº Doc.', '', 'Tipo de lançamento', '',
  'Participante a débito', '', 'Participante a crédito', '', 'Data lançamento', '', 'Data última alteração'];
const linha = (c: Record<number, string | number>) => Array.from({ length: TITULOS.length }, (_, i) => c[i] ?? '');
const PLANILHA = [
  TITULOS,
  linha({ 2: '31/10/2026', 4: '284', 6: '200', 8: '2,700.00', 12: 'Provisão de Impostos: 10/2026', 16: 'Lançamento on-line fiscal', 22: '17/11/2026', 24: '17/11/2026' }),
  linha({ 2: '29/10/2026', 4: '16', 6: '265', 8: 1234.5, 10: '29', 12: '101 - CLIENTE FICTICIO LTDA ', 14: '101', 16: 'Lançamento on-line fiscal', 18: '900', 22: '17/11/2026' }),
  linha({}),
  linha({ 2: '31/10/2026', 6: '169', 8: '1,400.00', 12: 'Líquido da folha 10/2026', 16: 'Lançamento on-line folha' }),
];

describe('a consulta dos lançamentos do SCI', () => {
  it('acha as colunas pelo título, pula a linha vazia e lê a data, o valor e o resto', () => {
    const ls = lancamentosDaConsulta(PLANILHA);
    expect(ls).toHaveLength(3);
    expect(ls?.[0]).toEqual({
      data: '2026-10-31', debito: '284', credito: '200', valor: 270000, historico: '', complemento: 'Provisão de Impostos: 10/2026', documento: '',
      tipo: 'Lançamento on-line fiscal', participanteD: '', participanteC: '', lancadoEm: '2026-11-17', alteradoEm: '2026-11-17',
    });
    expect(ls?.[1]).toMatchObject({ valor: 123450, historico: '29', complemento: '101 - CLIENTE FICTICIO LTDA', documento: '101', participanteD: '900' });
    // a partida da folha vem com um lado só
    expect(ls?.[2]).toMatchObject({ debito: '', credito: '169', valor: 140000, tipo: 'Lançamento on-line folha' });
  });

  it('sem os títulos não é a consulta', () => {
    expect(lancamentosDaConsulta([['a', 'b'], ['1', '2']])).toBeNull();
  });

  it('o valor no jeito americano, no brasileiro e em número; a data em texto e no número do Excel', () => {
    expect(valorDaConsulta('2,700.00')).toBe(270000);
    expect(valorDaConsulta('2.700,00')).toBe(270000);
    expect(valorDaConsulta('890.00')).toBe(89000);
    expect(valorDaConsulta('1.234')).toBe(123400);
    expect(valorDaConsulta(62.84)).toBe(6284);
    expect(valorDaConsulta('')).toBeNaN();
    expect(dataDaConsulta('5/1/2026')).toBe('2026-01-05');
    expect(dataDaConsulta(46326)).toBe('2026-10-31');
    expect(dataDaConsulta('ontem')).toBe('');
  });

  it('lê o CSV em UTF-8 e em Windows-1252, com os acentos dos títulos', () => {
    const csv = PLANILHA.map(r => r.map(c => '"' + String(c) + '"').join(',')).join('\n');
    expect(lerConsultaDoSci(new TextEncoder().encode(csv))).toHaveLength(3);
    // o mesmo texto em Windows-1252 (o "é" num byte só)
    const latin = Uint8Array.from([...csv].map(c => c.charCodeAt(0) & 0xff));
    expect(lerConsultaDoSci(latin)?.[0].debito).toBe('284');
  });

  it('acha o plano em que as contas existem; no empate, o da empresa', () => {
    const ls = lancamentosDaConsulta(PLANILHA) || [];
    const id = planoDaConsulta(ls, '90011');
    expect(planoDaConsulta(ls, id)).toBe(id);
    // sem conta nenhuma reconhecida, fica o da empresa
    expect(planoDaConsulta([], '90011')).toBe('90011');
    expect(planoDaConsulta([], '90113')).toBe('90113');
  });

  it('o nome do participante sai do complemento "nota - NOME" quando a nota é o documento', () => {
    const ls = lancamentosDaConsulta(PLANILHA) || [];
    const nomes = nomesDosParticipantes(ls);
    expect(nomes.get('900')).toBe('CLIENTE FICTICIO LTDA');
    expect(nomes.size).toBe(1);
    // o complemento que não começa pelo documento não dá nome
    expect(nomesDosParticipantes([{ ...ls[1], documento: '555' }]).size).toBe(0);
  });

  it('lê o arquivo .xls', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(PLANILHA), 'Planilha1');
    const bytes = XLSX.write(wb, { bookType: 'xls', type: 'array' }) as ArrayBuffer;
    expect(lerConsultaDoSci(bytes)?.map(l => l.valor)).toEqual([270000, 123450, 140000]);
  });
});

describe('juntar o que o robô puxa do SCI', () => {
  const l = (data: string, valor: number, complemento = ''): LancamentoDaConsulta => ({
    data, debito: '5', credito: '765', valor, historico: '', complemento, documento: '', tipo: 'Lançamento manual', participanteD: '', participanteC: '', lancadoEm: '', alteradoEm: '',
  });

  it('o período da competência do SCI: o mês, o ano todo (00) e tudo (00/0000)', () => {
    expect(periodoDaCompetenciaDoSci('02/2028')).toEqual({ de: '2028-02-01', ate: '2028-02-29' });
    expect(periodoDaCompetenciaDoSci('10/2026')).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(periodoDaCompetenciaDoSci('00/2026')).toEqual({ de: '2026-01-01', ate: '2026-12-31' });
    expect(periodoDaCompetenciaDoSci('00/0000')).toBeNull();
  });

  it('tudo: a primeira vez entra tudo; depois, só os novos (o repetido conta quantas vezes aparece), e o que só a tela tinha fica', () => {
    const primeira = juntarConsultas([], [l('2026-09-30', 100), l('2026-10-31', 200)], '00/0000');
    expect(primeira.novos).toBe(2);
    const velho = l('2026-08-01', 50, 'excluído no SCI');
    const depois = juntarConsultas([...primeira.lancamentos, velho], [l('2026-09-30', 100), l('2026-10-31', 200), l('2026-10-31', 200), l('2026-11-05', 300)], '00/0000');
    expect(depois.novos).toBe(2);
    expect(depois.lancamentos).toHaveLength(5);
    expect(depois.lancamentos[4]).toBe(velho);
  });

  it('um mês: troca só aquele mês pelo que veio dele; o resto da consulta fica igual', () => {
    const antes = [l('2026-09-30', 100), l('2026-10-10', 200), l('2026-10-20', 999, 'alterado depois')];
    const r = juntarConsultas(antes, [l('2026-09-30', 111), l('2026-10-10', 200), l('2026-10-20', 250), l('2026-11-01', 5)], '10/2026');
    expect(r.novos).toBe(2);
    expect(r.lancamentos.map(x => x.data + ':' + x.valor)).toEqual(['2026-10-10:200', '2026-10-20:250', '2026-09-30:100']);
  });
});
