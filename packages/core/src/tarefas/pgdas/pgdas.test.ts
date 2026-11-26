// O extrato do PGDAS-D, o resumo por empresa e a janela do e-CAC (25/11/2026). Todos os dados aqui são inventados.
import { describe, expect, it } from 'vitest';
import { consultadoEmTexto, dentroDaJanelaDoEcac, esperaAteAJanela, extratoDaEmpresa, extratoDoPgdas, juntarExtrato, lerPgdasDaEmpresa, MESES_GUARDADOS, type ExtratoDoPgdas } from './index';

// um extrato fictício como o textoDoPdf devolve: a página de cima para baixo, os pedaços separados por espaço
const EXTRATO = [
  'Extrato do Simples Nacional',
  'Período de Apuração (PA): 10/2026',
  'Número da Declaração: 99888777202610002',
  'Data/hora da transmissão: 18/11/2026 14:05:31',
  '1) Identificação do Contribuinte - Situação Cadastral Vigente',
  'CNPJ Matriz: 99.888.777/0001-66 Nome empresarial: PADARIA FICTICIA DO TESTE LTDA Data de abertura no CNPJ: 02/03/2015',
  'Optante pelo Simples Nacional: Sim Regime de Apuração: Competência',
  '2) Discriminativo de Receitas',
  'Valores em reais (R$) Mercado Interno Mercado Externo Total',
  'Receita Bruta do PA (RPA) - Competência 45.678,90 1.000,00 46.678,90',
  'Receita bruta acumulada nos doze meses anteriores ao PA (RBT12) 512.345,67 0,00 512.345,67',
  'Receita bruta acumulada nos doze meses anteriores ao PA proporcionalizada (RBT12p) 0,00 0,00 0,00',
  'Receita bruta acumulada no ano-calendário corrente (RBA) 400.000,00 0,00 400.000,00',
  'Receita bruta acumulada no ano-calendário anterior (RBAA) 498.000,00 0,00 498.000,00',
  '2.2) Receitas Brutas Anteriores (R$)',
  '2.2.1) Mercado Interno',
  '10/2025 11/2025 12/2025 01/2026 02/2026 03/2026',
  '40.000,00 41.000,00 52.300,10 38.000,00 39.500,00 42.000,00',
  '04/2026 05/2026 06/2026 07/2026 08/2026 09/2026',
  '43.000,00 44.000,00 45.000,00 46.000,00 47.000,00 34.045,57',
  '2.2.2) Mercado Externo',
  '10/2025 11/2025 12/2025 01/2026 02/2026 03/2026',
  '0,00 0,00 0,00 0,00 0,00 0,00',
  '04/2026 05/2026 06/2026 07/2026 08/2026 09/2026',
  '0,00 0,00 0,00 0,00 0,00 500,00',
  '2.3) Folha de Salários Anteriores (R$)',
  '10/2025 11/2025 5.000,00 5.000,00',
  '3) Resumo da Declaração Receita Bruta Informada: R$ 46.678,90',
].join(' ');

const EMPRESA = { codigo: 9001, cnpj: '99888777000166', nome: 'PADARIA FICTICIA' };

describe('extratoDoPgdas', () => {
  it('lê o PA, a declaração, a receita do mês, a RBT12 e os 12 meses anteriores', () => {
    const e = extratoDoPgdas(EXTRATO) as ExtratoDoPgdas;
    expect(e.competencia).toBe('2026-10');
    expect(e.declaracao).toBe('99888777202610002');
    expect(e.retificadora).toBe(true);
    expect(e.transmitidaEm).toBe('2026-11-18T14:05:31');
    expect(e.cnpj).toBe('99888777000166');
    expect(e.nome).toBe('PADARIA FICTICIA DO TESTE LTDA');
    expect(e.receita).toEqual({ interno: 45678.9, externo: 1000, total: 46678.9 });
    expect(e.rbt12).toBe(512345.67);
    expect(e.rba).toBe(400000);
    expect(e.rbaa).toBe(498000);
    expect(e.anteriores).toHaveLength(12);
    expect(e.anteriores[0]).toEqual({ competencia: '2025-10', interno: 40000, externo: 0, total: 40000 });
    expect(e.anteriores[11]).toEqual({ competencia: '2026-09', interno: 34045.57, externo: 500, total: 34545.57 });
    // a folha (2.3) não entra nos anteriores
    expect(e.anteriores.every(m => m.total !== 5000)).toBe(true);
    // ela vai para as folhas (26/11/2026, a Projeção do Fator R)
    expect(e.folhas).toEqual([{ competencia: '2025-10', valor: 5000 }, { competencia: '2025-11', valor: 5000 }]);
  });

  it('a folha do 2.3 aos pares, como no extrato real; "Nenhuma" ou um número que não fecha deixa sem a folha', () => {
    const comFolha = (folha: string) => extratoDoPgdas(EXTRATO.replace('10/2025 11/2025 5.000,00 5.000,00', folha)) as ExtratoDoPgdas;
    expect(comFolha('10/2025 18.619,61 11/2025 18.147,27 12/2025 0,00 Página 2').folhas)
      .toEqual([{ competencia: '2025-10', valor: 18619.61 }, { competencia: '2025-11', valor: 18147.27 }, { competencia: '2025-12', valor: 0 }]);
    expect(comFolha('Nenhuma').folhas).toEqual([]);
    expect(comFolha('10/2025 11/2025 5.000,00').folhas).toEqual([]);
    // o 2.4 depois da folha não entra
    expect(comFolha('10/2025 1.000,00 2.4) Fator r 0,28').folhas).toEqual([{ competencia: '2025-10', valor: 1000 }]);
  });

  it('o formato real do PGDAS-D 2018 (conferido em 25/11/2026): número sem rótulo, "Apurado em", rótulo depois dos valores, meses aos pares, o DAS pago e as atividades', () => {
    // inventado, no desenho do extrato real (o PDF verdadeiro não vai para o repositório)
    const real = [
      'Extrato do Simples Nacional  Gerado   em   25/11/2026 16:22:51 Apurado   em   13/11/2026 08:31:39 Apuração Original PGDAS-D   2018   Versão 2.2.31',
      '1) Informações   do   Contribuinte  CNPJ Básico: 99.888.777   Nome   Empresarial:   PADARIA   FICTICIA   LTDA Data de Abertura: 23/06/1999',
      'Regime   de   Apuração:   Competência   Optante   pelo   Simples   Nacional: Sim  2) Informações   da   Apuração   99888777202610001',
      'Período de   Apuração   (PA):   10/2026  2.1 Discriminativo   de   Receitas Mercado   Interno   Mercado   Externo   Total  Total de   Receitas   Brutas   (R$)',
      'Receita Bruta do PA (RPA)   -   Competência   3.000,00   0,00   3.000,00 Receita bruta acumulada   nos   doze   meses   anteriores   ao   PA 6.000,00   0,00   6.000,00 (RBT12)',
      'Receita bruta acumulada   nos   doze   meses   anteriores   ao   PA proporcionalizada (RBT12p) Receita bruta acumulada   no   ano-calendário   corrente   (RBA)   5.000,00   0,00   5.000,00',
      'Receita bruta acumulada   no   ano-calendário   anterior 4.000,00   0,00   4.000,00 (RBAA)   Limite de receita bruta   proporcionalizado   4.800.000,00   4.800.000,00  . .',
      '2.2) Receitas   Brutas   Anteriores   (R$)  2.2.1) Mercado Interno  11/2025   1.000,00   12/2025   3.000,00   01/2026   2.000,00',
      '2.2.2) Mercado Externo  11/2025   0,00   12/2025   0,00   01/2026   0,00  . .  2.3) Folha   de   Salários   Anteriores   (R$)  Nenhuma',
      'Página 1 3) Informações   dos   Estabelecimentos CNPJ Estabelecimento:   99.888.777/0001-66  Município:   TAIOBEIRAS   UF: MG',
      'Valor   do   Débito   por Tributo para a Atividade (R$): Revenda de   mercadorias,   exceto   para   o   exterior - Sem substituição tributária Receita Bruta   Informada:   R$   2.000,00  IRPJ CSLL Total 10,00 5,00 15,00',
      'Valor   do   Débito   por Tributo para a Atividade (R$): Revenda de   mercadorias,   exceto   para   o   exterior - Com substituição tributária Receita Bruta   Informada:   R$   1.000,00  IRPJ CSLL Total 5,00 2,00 7,00',
      '6) Informações   sobre   DAS   Gerado   na   apuração: 99888777202610001 Data   de   Vencimento:  Número: 07202600000000001   Data   limite   para   acolhimento:   20/11/2026 20/11/2026',
      'Principal   180,00   Multa   0,00   Juros   0,00   Total   180,00 6.1) Discriminação dos   Valores',
      '6.2) Informações da Arrecadação   do   DAS   gerado   nesta   apuração Data de Pagamento   Banco/Agência   de   Arrecadação   Valor   Pago  19/11/2026   001/2001   180,00  Página 3',
    ].join(' ');
    const e = extratoDoPgdas(real) as ExtratoDoPgdas;
    expect(e).toMatchObject({ competencia: '2026-10', declaracao: '99888777202610001', retificadora: false, transmitidaEm: '2026-11-13T08:31:39', cnpj: '99888777000166',
      nome: 'PADARIA FICTICIA LTDA', rbt12: 6000, rba: 5000, rbaa: 4000 });
    expect(e.receita).toEqual({ interno: 3000, externo: 0, total: 3000 });
    expect(e.anteriores.map(m => [m.competencia, m.total])).toEqual([['2025-11', 1000], ['2025-12', 3000], ['2026-01', 2000]]);
    expect(e.das).toEqual({ numero: '07202600000000001', vencimento: '2026-11-20', valor: 180, pagamento: { data: '2026-11-19', valor: 180 } });
    expect(e.atividades.map(a => a.receita)).toEqual([2000, 1000]);
    expect(e.folhas).toEqual([]);
    expect(e.atividades[0].descricao).toMatch(/^Revenda de mercadorias, exceto para o exterior - Sem substituição/);
    // sem o pagamento, o DAS fica sem pagamento; a apuração retificadora
    const semPagar = extratoDoPgdas(real.replace(/6\.2\) Informações da Arrecadação[\s\S]*$/, '').replace('Apuração Original', 'Apuração Retificadora')) as ExtratoDoPgdas;
    expect([semPagar.das?.pagamento, semPagar.retificadora]).toEqual([null, true]);
    // o resumo guarda o DAS e as atividades no mês do extrato
    const r = juntarExtrato(null, e, EMPRESA, new Date('2026-11-26T02:00:00Z'));
    expect(r.meses['2026-10'].das?.pagamento).toEqual({ data: '2026-11-19', valor: 180 });
    expect(lerPgdasDaEmpresa(JSON.parse(JSON.stringify(r)))?.meses['2026-10']).toMatchObject({ das: { numero: '07202600000000001', valor: 180 }, atividades: [{ receita: 2000 }, { receita: 1000 }] });
  });

  it('a declaração (sem os anteriores, com um valor só) também serve', () => {
    const e = extratoDoPgdas('Programa Gerador do Documento de Arrecadação do Simples Nacional – Declaratório PGDAS-D Declaração Nº da Declaração: 11222333202302001 CNPJ Básico: 11.222.333 Nome Empresarial: COMERCIO FICTICIO Período de Apuração (PA): 02/2023 Receita Bruta do PA (RPA) - Competência 10.000,00');
    expect(e?.competencia).toBe('2023-02');
    expect(e?.receita).toEqual({ interno: 10000, externo: 0, total: 10000 });
    expect(e?.retificadora).toBe(false);
    expect(e?.cnpj).toBe('11222333');
    expect(e?.anteriores).toEqual([]);
    expect(e?.rbt12).toBeNull();
  });

  it('sem PA ou sem a receita do PA, não é extrato', () => {
    expect(extratoDoPgdas('Documento de Arrecadação do Simples Nacional Pagar este documento até 20/11/2026')).toBeNull();
    expect(extratoDoPgdas('Extrato do Simples Nacional Período de Apuração (PA): 10/2026')).toBeNull();
    expect(extratoDoPgdas('')).toBeNull();
  });

  it('meses anteriores que não fecham (períodos e valores em número diferente) ficam todos de fora: nada sai com 0 inventado', () => {
    const semUmInterno = extratoDoPgdas(EXTRATO.replace('40.000,00 41.000,00', '40.000,00'));
    expect(semUmInterno?.anteriores).toEqual([]);
    expect(semUmInterno?.receita.total).toBe(46678.9);
    const semUmExterno = extratoDoPgdas(EXTRATO.replace('0,00 0,00 0,00 0,00 0,00 500,00', '0,00 0,00 0,00 0,00 500,00'));
    expect(semUmExterno?.anteriores).toEqual([]);
  });

  it('confere o CNPJ pelo básico', () => {
    const e = extratoDoPgdas(EXTRATO) as ExtratoDoPgdas;
    expect(extratoDaEmpresa(e, '99.888.777/0002-47')).toBe(true);
    expect(extratoDaEmpresa(e, '11222333000181')).toBe(false);
    expect(extratoDaEmpresa({ ...e, cnpj: null }, '99888777000166')).toBe(false);
  });
});

describe('juntarExtrato', () => {
  const agora = new Date('2026-11-26T02:00:00Z');
  const e = extratoDoPgdas(EXTRATO) as ExtratoDoPgdas;

  it('um extrato enche o mês e os 12 anteriores', () => {
    const r = juntarExtrato(null, e, EMPRESA, agora);
    expect(Object.keys(r.meses)).toHaveLength(13);
    expect(r.meses['2026-10']).toMatchObject({ receita: 46678.9, rbt12: 512345.67, origem: 'extrato', declaracao: '99888777202610002' });
    expect(r.meses['2025-10']).toMatchObject({ receita: 40000, rbt12: null, origem: 'anteriores' });
    expect(r).toMatchObject({ codigo: 9001, cnpj: '99888777000166', fonte: 'Receita (PGDAS-D)', consultadoEm: agora.toISOString() });
  });

  it('o extrato do próprio mês vale mais que os anteriores de outro; a retificação vale mais que a original', () => {
    const doMes9 = { ...e, competencia: '2026-09', receita: { interno: 34000, externo: 500, total: 34500 }, transmitidaEm: '2026-10-15T10:00:00', anteriores: [] };
    let r = juntarExtrato(null, doMes9, EMPRESA, agora);
    r = juntarExtrato(r, e, EMPRESA, new Date('2026-11-27T02:00:00Z'));
    // o 09 do extrato de 10 (anteriores) não passa por cima do extrato do 09
    expect(r.meses['2026-09']).toMatchObject({ receita: 34500, origem: 'extrato' });
    const retificado = { ...doMes9, receita: { interno: 35000, externo: 0, total: 35000 }, transmitidaEm: '2026-11-20T09:00:00' };
    r = juntarExtrato(r, retificado, EMPRESA, new Date('2026-11-28T02:00:00Z'));
    expect(r.meses['2026-09'].receita).toBe(35000);
    // a declaração mais antiga, consultada depois, não volta
    r = juntarExtrato(r, doMes9, EMPRESA, new Date('2026-11-29T02:00:00Z'));
    expect(r.meses['2026-09'].receita).toBe(35000);
  });

  it('guarda a folha do 2.3 por mês; a declaração transmitida depois vale mais', () => {
    let r = juntarExtrato(null, e, EMPRESA, agora);
    expect(r.folhas).toEqual({
      '2025-10': { competencia: '2025-10', valor: 5000, doPa: '2026-10', transmitidaEm: '2026-11-18T14:05:31', consultadoEm: agora.toISOString() },
      '2025-11': { competencia: '2025-11', valor: 5000, doPa: '2026-10', transmitidaEm: '2026-11-18T14:05:31', consultadoEm: agora.toISOString() },
    });
    // o extrato de 11/2026 traz a folha de 11/2025 de novo, corrigida, e a de 10/2026
    const doMes11 = { ...e, competencia: '2026-11', transmitidaEm: '2026-12-15T10:00:00', anteriores: [], folhas: [{ competencia: '2025-11', valor: 5100 }, { competencia: '2026-10', valor: 6000 }] };
    r = juntarExtrato(r, doMes11, EMPRESA, agora);
    expect(Object.fromEntries(Object.entries(r.folhas || {}).map(([c, f]) => [c, f.valor]))).toEqual({ '2025-10': 5000, '2025-11': 5100, '2026-10': 6000 });
    // a mais antiga, consultada depois, não volta
    r = juntarExtrato(r, e, EMPRESA, new Date('2026-12-30T02:00:00Z'));
    expect(r.folhas?.['2025-11'].valor).toBe(5100);
    // e o banco devolve igual
    expect(lerPgdasDaEmpresa(JSON.parse(JSON.stringify(r)))?.folhas).toEqual(r.folhas);
    // sem folha no extrato, o documento não ganha o campo
    expect(juntarExtrato(null, { ...e, folhas: [] }, EMPRESA, agora).folhas).toBeUndefined();
  });

  it('recusa o extrato de outro CNPJ', () => {
    expect(() => juntarExtrato(null, e, { ...EMPRESA, cnpj: '11222333000181' }, agora)).toThrow(/outro CNPJ/);
  });

  it('guarda só os meses mais novos', () => {
    let r = juntarExtrato(null, e, EMPRESA, agora);
    for (let i = 0; i < 40; i++) {
      const c = String(2020 + Math.floor(i / 12)) + '-' + String((i % 12) + 1).padStart(2, '0');
      r = juntarExtrato(r, { ...e, competencia: c, anteriores: [] }, EMPRESA, agora);
    }
    expect(Object.keys(r.meses)).toHaveLength(MESES_GUARDADOS);
    expect(Object.keys(r.meses).sort().at(-1)).toBe('2026-10');
  });
});

describe('lerPgdasDaEmpresa', () => {
  it('lê o documento do banco e deixa de fora o que não fecha', () => {
    const r = lerPgdasDaEmpresa({ codigo: 9001, cnpj: '99888777000166', nome: 'X', consultadoEm: '2026-11-26T02:00:00.000Z',
      meses: { '2026-10': { receita: 100, rbt12: 1200, origem: 'extrato' }, 'ruim': { receita: 1 }, '2026-09': { receita: 'x' } } });
    expect(Object.keys(r?.meses || {})).toEqual(['2026-10']);
    expect(r?.meses['2026-10']).toMatchObject({ receita: 100, interno: 100, externo: 0, rbt12: 1200, origem: 'extrato' });
    expect(lerPgdasDaEmpresa(null)).toBeNull();
    expect(lerPgdasDaEmpresa({ codigo: 1, meses: {} })).toBeNull();
  });

  it('a data da consulta no fuso do escritório', () => {
    expect(consultadoEmTexto('2026-11-26T02:00:00.000Z')).toBe('consultado em 25/11/2026');
    expect(consultadoEmTexto('')).toBe('');
  });
});

describe('janela do e-CAC (23h às 8h, Brasília)', () => {
  // Brasília = UTC-3
  const as = (h: string) => Date.parse('2026-11-25T' + h + ':00-03:00');
  it('só das 23h às 8h', () => {
    expect(dentroDaJanelaDoEcac(as('22:59'))).toBe(false);
    expect(dentroDaJanelaDoEcac(as('23:00'))).toBe(true);
    expect(dentroDaJanelaDoEcac(as('03:30'))).toBe(true);
    expect(dentroDaJanelaDoEcac(as('07:59'))).toBe(true);
    expect(dentroDaJanelaDoEcac(as('08:00'))).toBe(false);
    expect(dentroDaJanelaDoEcac(as('14:00'))).toBe(false);
  });
  it('a espera até abrir', () => {
    expect(esperaAteAJanela(as('22:00'))).toBe(60 * 60_000);
    expect(esperaAteAJanela(as('08:00'))).toBe(15 * 60 * 60_000);
    expect(esperaAteAJanela(as('23:30'))).toBe(0);
  });
});
