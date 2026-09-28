import { describe, expect, it } from 'vitest';
import type { Transacao, Venda } from '../tipos';
import { conciliar, ordemDasBandeiras } from './conciliacao';
import { chaveDaData } from './formatos';
import { linhasDaBandeira, nomeBaseBandeira, saidasPorMes } from './linhas';
import { conferirTotais, totaisPorMes } from './totais';

/** Troca o espaço que não quebra (do R$) por espaço comum, para ler as mensagens no teste. */
const semNbsp = (xs: string[]) => xs.map(x => x.split(String.fromCharCode(0xa0)).join(' '));

function tx(dia: number, mes: number, bruto: number, taxa: number): Transacao {
  const data = new Date(2026, mes - 1, dia);
  return { data, chaveData: chaveDaData(data), bruto, taxa };
}
function venda(dia: number, mes: number, bruto: number, nf: string): Venda {
  const data = new Date(2026, mes - 1, dia);
  return { data, chaveData: chaveDaData(data), bruto, nf, historico: nf + '-0-CLIENTE ' + nf, contrapartida: '5' + nf, codigoHistorico: '300' };
}

describe('conciliação', () => {
  const transacoes = {
    cielo: [tx(6, 7, 50, 1), tx(5, 7, 100, 2), tx(1, 8, 80, 2)],
    rede: [tx(5, 7, 100, 3)],
  };
  const vendas = [venda(5, 7, 100, '1'), venda(6, 7, 50, '2'), venda(7, 7, 30, '3'), venda(5, 7, 100, '4'), venda(2, 9, 10, '5')];

  it('ordem pelo volume, empate mantém a seleção', () => {
    expect(ordemDasBandeiras(transacoes, ['rede', 'cielo'])).toEqual(['cielo', 'rede']);
    expect(ordemDasBandeiras({ rede: [tx(1, 7, 1, 0)], getnet: [tx(1, 7, 1, 0)] }, ['getnet', 'rede', 'stone'])).toEqual(['getnet', 'rede', 'stone']);
  });

  it('FIFO por data+valor num monte só; sobras na ordem da planilha', () => {
    const c = conciliar({ ordem: ['cielo', 'rede'], transacoes, vendas, mesesPermitidos: null });
    const cielo = c.porBandeira.cielo!;
    expect(cielo.aprovadas).toBe(3);
    expect(cielo.casadas).toBe(2);
    expect(cielo.semNota).toBe(1);
    expect(cielo.totalBruto).toBe(230);
    expect(cielo.totalTaxa).toBe(5);
    expect(cielo.meses).toEqual([{ mes: 7, ano: 2026, qtd: 2 }, { mes: 8, ano: 2026, qtd: 1 }]);
    // ordenado por data: 05/07 primeiro
    expect(cielo.linhas.map(l => [l.tipo, l.chaveData, l.valor, l.historico, l.nota])).toEqual([
      ['Bruto', '05/07/2026', 100, '15', '1'], ['Taxa', '05/07/2026', 2, '92060', '1'],
      ['Bruto', '06/07/2026', 50, '15', '2'], ['Taxa', '06/07/2026', 1, '92060', '2'],
      ['Bruto', '01/08/2026', 80, '181', ''], ['Taxa', '01/08/2026', 2, '92060', ''],
    ]);
    expect(cielo.linhas[0].complemento).toBe('1-0-CLIENTE 1');
    expect(cielo.linhas[4].complemento).toBe('');
    // a Rede fica com a segunda venda de 05/07 100,00
    expect(c.porBandeira.rede!.linhas[0].nota).toBe('4');
    expect(c.sobras.map(v => v.nf)).toEqual(['3', '5']);
    // não mexe nas vendas de quem chamou
    expect(vendas).toHaveLength(5);
  });

  it('valor comparado com 2 casas (toFixed)', () => {
    const c = conciliar({ ordem: ['cielo'], transacoes: { cielo: [tx(5, 7, 100.001, 0)] }, vendas: [venda(5, 7, 100, '9')], mesesPermitidos: null });
    expect(c.porBandeira.cielo!.casadas).toBe(1);
  });

  it('meses permitidos filtram só o cartão; conferência acusa o que ficou de fora', () => {
    const c = conciliar({ ordem: ['cielo', 'rede'], transacoes, vendas, mesesPermitidos: [{ mes: 7, ano: 2026 }] });
    expect(c.porBandeira.cielo!.aprovadas).toBe(2);
    expect(c.porBandeira.cielo!.totalBruto).toBe(150);
    const conf = conferirTotais(c, ['cielo', 'rede'], transacoes, vendas);
    expect(conf.ok).toBe(false);
    expect(semNbsp(conf.problemas)).toEqual([
      'Cielo: total de vendas brutas do arquivo final (R$ 150,00) não bate com o extrato original (R$ 230,00).',
      'Cielo: total de taxas do arquivo final (R$ 3,00) não bate com o extrato original (R$ 5,00).',
    ]);
    // lista vazia = sem filtro
    expect(conciliar({ ordem: ['cielo'], transacoes, vendas, mesesPermitidos: [] }).porBandeira.cielo!.aprovadas).toBe(3);
  });

  it('conferência ok e totais por mês', () => {
    const c = conciliar({ ordem: ['cielo', 'rede'], transacoes, vendas, mesesPermitidos: null });
    expect(conferirTotais(c, ['cielo', 'rede'], transacoes, vendas)).toEqual({ ok: true, problemas: [] });
    const t = totaisPorMes(c, ['cielo', 'rede']);
    expect(t.map(m => m.rotulo)).toEqual(['Julho/2026', 'Agosto/2026', 'Setembro/2026']);
    expect(t[0]).toEqual({
      mes: { mes: 7, ano: 2026 }, rotulo: 'Julho/2026', vendasComCartao: 250, vendasSemCartao: 30, totalVendas: 280,
      porBandeira: [{ id: 'cielo', bruto: 150, taxa: 3 }, { id: 'rede', bruto: 100, taxa: 3 }],
    });
    expect(t[1].vendasComCartao).toBe(0);
    expect(t[1].porBandeira[0]).toEqual({ id: 'cielo', bruto: 80, taxa: 2 });
    expect(t[2].vendasSemCartao).toBe(10);
  });

  it('conferência acusa venda sumida', () => {
    const c = conciliar({ ordem: ['cielo'], transacoes, vendas, mesesPermitidos: null });
    const conf = conferirTotais({ ...c, sobras: [] }, ['cielo'], transacoes, vendas);
    expect(semNbsp(conf.problemas)).toEqual(['Total da planilha de vendas (R$ 290,00) não bate com a soma das notas usadas nas bandeiras + saídas (R$ 150,00).']);
  });

  it('totais por mês ordenam a chave como texto (2026-10 antes de 2026-9)', () => {
    const c = conciliar({ ordem: ['cielo'], transacoes: { cielo: [tx(1, 9, 1, 0), tx(1, 10, 1, 0)] }, vendas: [], mesesPermitidos: null });
    expect(totaisPorMes(c, ['cielo']).map(m => m.rotulo)).toEqual(['Outubro/2026', 'Setembro/2026']);
  });
});

describe('linhas dos arquivos', () => {
  const transacoes = { cielo: [tx(5, 7, 100, 2), tx(6, 7, 50, 1)] };
  const c = conciliar({ ordem: ['cielo'], transacoes, vendas: [venda(5, 7, 100, '1'), venda(9, 8, 7, '8'), venda(1, 7, 3, '7')], mesesPermitidos: null });

  it('contas da bandeira: bruto casado vai para vendas, sem nota para o caixa', () => {
    const contas = { vendas: ' 30101 ', taxas: ' 40101', caixaPadrao: true, caixa: 'ignorado' };
    const l = linhasDaBandeira(c.porBandeira.cielo!, ' 21105 ', contas);
    expect(l.map(x => [x.devedora, x.credora, x.tipo, x.historico])).toEqual([
      ['21105', '30101', 'Bruto', '15'], ['40101', '21105', 'Taxa', '92060'],
      ['21105', '10101', 'Bruto', '181'], ['40101', '21105', 'Taxa', '92060'],
    ]);
    const outraCaixa = linhasDaBandeira(c.porBandeira.cielo!, '21105', { ...contas, caixaPadrao: false, caixa: ' 10105 ' });
    expect(outraCaixa[2].credora).toBe('10105');
    expect(nomeBaseBandeira('cielo', c.porBandeira.cielo!.meses)).toBe('conciliacao-cielo-2026-07');
  });

  it('saídas por mês', () => {
    const s = saidasPorMes(c.sobras, ' 30101 ');
    expect(s.map(m => [m.chave, m.rotulo, m.nomeBase])).toEqual([['2026-7', 'Julho/2026', 'saidas-vendas-2026-07'], ['2026-8', 'Agosto/2026', 'saidas-vendas-2026-08']]);
    expect(s[0].linhas).toEqual([{ devedora: '57', credora: '30101', data: '01/07/2026', valor: 3, historico: '300', complemento: '7-0-CLIENTE 7', nota: '7', tipo: 'Saida', casou: false }]);
    expect(saidasPorMes([], '1')).toEqual([]);
  });
});
