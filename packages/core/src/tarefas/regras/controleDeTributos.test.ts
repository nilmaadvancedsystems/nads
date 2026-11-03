import { describe, expect, it } from 'vitest';
import { linhasDoProtocolo } from './protocoloDeTributos';
import { competenciaDaApuracao, grupoDoControle, htmlDoControle, linhaEmBranco, numeroDoControle, preencherComSugestao, situacaoDaLinha, somarMesesDaCompetencia, sugestoesDoEntregas, valorDoControle } from './controleDeTributos';

const logo = { definicao: '<svg id="def"></svg>', uso: '<svg><use href="#x"/></svg>' };

describe('o controle de tributos do Fiscal (27/10/2026)', () => {
  it('o valor como fica na tela', () => {
    expect(valorDoControle('1234,5')).toBe('1.234,50');
    expect(valorDoControle('2.595,81')).toBe('2.595,81');
    expect(valorDoControle('49.63')).toBe('49,63');
    expect(valorDoControle('1234.56')).toBe('1.234,56');
    expect(valorDoControle('R$ 10')).toBe('10,00');
    expect(valorDoControle('-')).toBe('—');
    expect(valorDoControle('Ø')).toBe('0');
    expect(valorDoControle(' ver obs ')).toBe('ver obs');
    expect(valorDoControle('')).toBe('');
  });

  it('o Presumido tem as colunas do IBS e da CBS, ligadas às guias do Entregas (03/11/2026)', () => {
    const lp = grupoDoControle('lp');
    expect(lp.colunas.map(c => c.id)).toEqual(['pis', 'cofins', 'irpj', 'csll', 'icms', 'iss', 'ibs', 'cbs', 'parc']);
    const s = sugestoesDoEntregas(lp, [{ codigo: 9, nome: 'C' }], [
      { codigo: 9, itens: [{ tipo: 'IBS', valor: 12.3 }, { tipo: 'CBS', valor: 45.6 }], em: '2026-10-15T10:00:00Z', porEmail: false },
    ]);
    expect(s.get(9)?.valores).toMatchObject({ ibs: '12,30', cbs: '45,60' });
  });

  it('a apuração de uma guia entregue é a do mês anterior ao da entrega (03/11/2026)', () => {
    // gravada com o mês da entrega (o padrão do Entregas): a apuração é a do mês anterior
    expect(competenciaDaApuracao('2026-10', '2026-10-15T12:00:00Z')).toBe('2026-09');
    expect(competenciaDaApuracao('2026-01', '2026-01-10T12:00:00Z')).toBe('2025-12');
    // gravada com a competência do PDF (o mês anterior): vale a gravada
    expect(competenciaDaApuracao('2026-09', '2026-10-15T12:00:00Z')).toBe('2026-09');
    // o dia é o de Brasília: 01/11 às 01h UTC ainda é 31/10 lá
    expect(competenciaDaApuracao('2026-10', '2026-11-01T01:00:00Z')).toBe('2026-09');
    expect(competenciaDaApuracao('2026-10', undefined)).toBe('2026-10');
    expect(somarMesesDaCompetencia('2026-12', 1)).toBe('2027-01');
    expect(somarMesesDaCompetencia('2026-01', -1)).toBe('2025-12');
  });

  it('o número para os totais', () => {
    expect(numeroDoControle('1.234,50')).toBe(1234.5);
    expect(numeroDoControle('—')).toBe(0);
    expect(numeroDoControle('ver obs')).toBe(0);
  });

  it('as sugestões do Entregas vão só nos campos em branco', () => {
    const sn = grupoDoControle('sn');
    const s = sugestoesDoEntregas(sn, [{ codigo: 7, nome: 'A' }, { codigo: 8, nome: 'B' }], [
      { codigo: 7, itens: [{ tipo: 'DAS', valor: 100 }, { tipo: 'ICMS ST', valor: 20.5 }], em: '2026-09-15T10:00:00Z', porEmail: true },
    ]);
    expect(s.get(7)).toEqual({ valores: { das: '100,00', 'st-ent': '20,50' }, data: '2026-09-15', email: true });
    expect(s.has(8)).toBe(false);
    const escrita = { ...linhaEmBranco('2026-09', 7, 'sn'), valores: { das: '99,00' } };
    const junta = preencherComSugestao(escrita, s.get(7));
    expect(junta.valores).toEqual({ das: '99,00', 'st-ent': '20,50' });
    expect(junta.data).toBe('2026-09-15');
    expect(junta.entregue).toBe('email');
  });

  it('a data da entrega é o dia em Brasília (o confirmadoEm é UTC; 30/10/2026)', () => {
    const sn = grupoDoControle('sn');
    // 22h30 de 15/09 em Brasília = 01h30 de 16/09 em UTC
    const guias = [{ codigo: 7, itens: [{ tipo: 'DAS', valor: 100 }], em: '2026-09-16T01:30:00.000Z', porEmail: false }];
    expect(sugestoesDoEntregas(sn, [{ codigo: 7, nome: 'A' }], guias).get(7)?.data).toBe('2026-09-15');
    expect(linhasDoProtocolo(sn, [{ codigo: 7, nome: 'A' }], guias, true)[0].data).toBe('15/09');
  });

  it('a data sugerida é a da última guia do grupo, não a de outra guia do cliente (o FGTS do DP; 31/10/2026)', () => {
    const sn = grupoDoControle('sn');
    const guias = [
      { codigo: 7, itens: [{ tipo: 'DAS', valor: 100 }], em: '2026-09-15T13:00:00.000Z', porEmail: false },
      { codigo: 7, itens: [{ tipo: 'FGTS', valor: 300 }], em: '2026-09-20T13:00:00.000Z', porEmail: true },
    ];
    expect(sugestoesDoEntregas(sn, [{ codigo: 7, nome: 'A' }], guias).get(7)).toEqual({ valores: { das: '100,00' }, data: '2026-09-15', email: false });
  });

  it('a situação da linha', () => {
    const b = linhaEmBranco('2026-09', 1, 'lp');
    expect(situacaoDaLinha(undefined)).toBe('branco');
    expect(situacaoDaLinha(b)).toBe('branco');
    expect(situacaoDaLinha({ ...b, marcas: { dctf: 'ok' } })).toBe('comecada');
    expect(situacaoDaLinha({ ...b, entregue: 'zap' })).toBe('entregue');
  });

  it('a folha impressa: as colunas do grupo, as conferências, a observação e a retificação', () => {
    const lp = grupoDoControle('lp');
    const linha = { ...linhaEmBranco('2026-08', 12, 'lp'), valores: { pis: '10,00' }, data: '2026-09-02', marcas: { dctf: 'ok' as const, spc: 'na' as const }, entregue: 'zap' as const };
    const html = htmlDoControle({ competencia: '2026-08', grupo: lp, empresas: [{ codigo: 12, nome: 'X & Y LTDA' }], linhas: new Map([[12, linha]]), logo,
      folha: { observacoes: ['Cliente pediu boleto'], retificacoes: [{ codigo: 12, referencia: '07/2026', valores: { cofins: '5,00' }, marcas: {}, entregue: 'email' }] } });
    expect(html).toContain('LUCRO PRESUMIDO');
    expect(html).toContain('Ref: 08/2026');
    expect(html).toContain('X &amp; Y LTDA');
    expect(html).toContain('<th class="mk">DAPI</th>');
    expect(html).toContain('02/09/26');
    expect(html).toContain('>OK<');
    expect(html).toContain('>zap<');
    expect(html).toContain('Cliente pediu boleto');
    expect(html).toContain('07/2026');
  });
});
