import { describe, expect, it } from 'vitest';
import { linhasDoProtocolo } from './protocoloDeTributos';
import { adicionarRetificacao, alternarRetificacaoDaLinha, cabeRetificacao, guardarRetificacao, linhaRetificada, MAX_RETIFICACOES, quadroDeRetificacao, referenciaDaRetificacao, removerRetificacao, retificacaoEmBranco, situacaoDaRetificacao, colunaDaGuia, competenciaDaApuracao, grupoDoControle, htmlDoControle, linhaEmBranco, numeroDoControle, preencherComSugestao, situacaoDaLinha, somarMesesDaCompetencia, sugestoesDoEntregas, valorDoControle } from './controleDeTributos';

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

  it('a coluna de cada guia lida no lote do Fiscal, conforme o grupo (03/11/2026)', () => {
    expect(colunaDaGuia('sn', 'DAS', '')).toBe('das');
    expect(colunaDaGuia('lp', 'DAS', '')).toBe('');
    expect(['PIS', 'COFINS', 'IRPJ', 'CSLL'].map(t => colunaDaGuia('lp', 'DARF', t))).toEqual(['pis', 'cofins', 'irpj', 'csll']);
    expect(colunaDaGuia('lp', 'DARF', 'IRRF')).toBe('');
    expect(colunaDaGuia('sn', 'DARF', 'PIS')).toBe('');
    expect(colunaDaGuia('lp', 'DAE', 'ICMS')).toBe('icms');
    expect(colunaDaGuia('sn', 'DAE', 'ICMS')).toBe('');
    // no Simples, a coluna do ICMS pela receita do DAE
    expect(colunaDaGuia('sn', 'DAE', 'ICMS', false, '0327-7 ICMS REC.ANTECIPADO-INDUSTRIA')).toBe('icms-ant');
    expect(colunaDaGuia('sn', 'DAE', 'ICMS', false, '0317-8 ICMS DIFERENCA DE ALIQUOTA')).toBe('icms-dif');
    expect(colunaDaGuia('sn', 'DAE', 'ICMS', false, 'ICMS ST ENTRADA')).toBe('st-ent');
    expect(colunaDaGuia('sn', 'DAE', 'ICMS', true, '0327-7 ICMS REC.ANTECIPADO-INDUSTRIA')).toBe('');
    expect(colunaDaGuia('lp', 'DAE', 'ICMS', false, '0317-8 ICMS DIFERENCA DE ALIQUOTA')).toBe('icms');
    expect(colunaDaGuia('lp', 'DAM', 'ISS')).toBe('iss');
    expect(colunaDaGuia('lp', 'DAM', 'IPTU')).toBe('');
    expect(colunaDaGuia('sn', 'DAS', '', true)).toBe('');
    expect(colunaDaGuia('lp', 'FGTS', '')).toBe('');
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

  it('a retificação ligada: não conta como andamento e entra preenchida no quadro do protocolo', () => {
    const lp = grupoDoControle('lp');
    const branca = linhaEmBranco('2026-08', 12, 'lp');
    const ligada = alternarRetificacaoDaLinha(branca);
    expect(linhaRetificada(ligada)).toBe(true);
    expect(situacaoDaLinha(ligada)).toBe('branco');
    expect(linhaRetificada(alternarRetificacaoDaLinha(ligada))).toBe(false);
    const empresas = [{ codigo: 12, nome: 'RETIFICADA LTDA' }, { codigo: 13, nome: 'OUTRA LTDA' }];
    const quadro = (linhas: Map<number, typeof branca>) => htmlDoControle({ competencia: '2026-08', grupo: lp, empresas, linhas, logo, folha: { observacoes: [], retificacoes: [] } }).split('<h2>RETIFICAÇÃO</h2>')[1];
    const html = quadro(new Map([[12, ligada], [13, linhaEmBranco('2026-08', 13, 'lp')]]));
    expect(html).toContain('00012');
    expect(html).toContain('RETIFICADA LTDA');
    expect(html).toContain('>08/2026<');
    expect(html).not.toContain('OUTRA LTDA');
    expect(quadro(new Map())).not.toContain('RETIFICADA LTDA');
  });
});

describe('o quadro de retificação do Relatório (16/11/2026: o botão como o do 13º)', () => {
  const empresas = [{ codigo: 12, nome: 'DOZE LTDA' }, { codigo: 13, nome: 'TREZE LTDA' }, { codigo: 14, nome: 'QUATORZE LTDA' }];
  const ligada = (codigo: number) => alternarRetificacaoDaLinha(linhaEmBranco('2026-10', codigo, 'sn'));
  const vazia = { observacoes: [], retificacoes: [] };

  it('as empresas ligadas entram em branco com a referência do mês; as guardadas, como estão; em ordem de código', () => {
    const folha = { observacoes: [], retificacoes: [{ ...retificacaoEmBranco(14, '08/2026'), valores: { das: '10,00' } }] };
    const q = quadroDeRetificacao({ competencia: '2026-10', empresas, linhas: new Map([[12, ligada(12)], [13, linhaEmBranco('2026-10', 13, 'sn')]]), folha });
    expect(q.map(l => [l.retificacao.codigo, l.retificacao.referencia, l.indice, l.ligada])).toEqual([[12, '10/2026', null, true], [14, '08/2026', 0, false]]);
  });

  it('a empresa ligada que já tem uma guardada não aparece duas vezes (nem no protocolo)', () => {
    const folha = { observacoes: [], retificacoes: [{ ...retificacaoEmBranco(12, '09/2026'), valores: { das: '5,00' } }] };
    const linhas = new Map([[12, ligada(12)]]);
    const q = quadroDeRetificacao({ competencia: '2026-10', empresas, linhas, folha });
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ indice: 0, ligada: true });
    const html = htmlDoControle({ competencia: '2026-10', grupo: grupoDoControle('sn'), empresas, linhas, folha, logo }).split('<h2>RETIFICAÇÃO</h2>')[1];
    expect(html.split('DOZE LTDA')).toHaveLength(2);
    expect(html).toContain('09/2026');
  });

  it('a mesma empresa em dois meses fica junta, na ordem da referência', () => {
    const folha = { observacoes: [], retificacoes: [retificacaoEmBranco(13, '09/2026'), retificacaoEmBranco(12, '01/2026'), retificacaoEmBranco(13, '12/2025')] };
    const q = quadroDeRetificacao({ competencia: '2026-10', empresas, linhas: new Map(), folha });
    expect(q.map(l => l.retificacao.codigo + ' ' + l.retificacao.referencia)).toEqual(['12 01/2026', '13 12/2025', '13 09/2026']);
  });

  it('escrever na linha da empresa ligada a guarda na folha; na guardada, troca no lugar', () => {
    const q = quadroDeRetificacao({ competencia: '2026-10', empresas, linhas: new Map([[12, ligada(12)]]), folha: vazia });
    const f1 = guardarRetificacao(vazia, q[0], { ...q[0].retificacao, valores: { das: '1,00' } });
    expect(f1.retificacoes).toEqual([{ ...retificacaoEmBranco(12, '10/2026'), valores: { das: '1,00' } }]);
    const f2 = guardarRetificacao(f1, { indice: 0 }, { ...f1.retificacoes[0], entregue: 'zap' });
    expect(f2.retificacoes).toHaveLength(1);
    expect(f2.retificacoes[0].entregue).toBe('zap');
  });

  it('+ Retificação: entra uma vez por empresa e referência, até o limite da folha', () => {
    const f = adicionarRetificacao(vazia, 13, '07/2026');
    expect(f.retificacoes).toEqual([retificacaoEmBranco(13, '07/2026')]);
    expect(adicionarRetificacao(f, 13, '07/2026')).toBe(f);
    expect(adicionarRetificacao(f, 13, '08/2026').retificacoes).toHaveLength(2);
    const cheia = { observacoes: [], retificacoes: Array.from({ length: MAX_RETIFICACOES }, (_, i) => retificacaoEmBranco(i, '01/2026')) };
    expect(cabeRetificacao(cheia)).toBe(false);
    expect(adicionarRetificacao(cheia, 99, '01/2026')).toBe(cheia);
  });

  it('tirar a linha: a guardada sai; a empresa ligada se desliga quando não sobra outra dela', () => {
    const linhas = new Map([[12, ligada(12)], [13, ligada(13)]]);
    const folha = { observacoes: [], retificacoes: [retificacaoEmBranco(12, '09/2026'), retificacaoEmBranco(12, '08/2026')] };
    const q = quadroDeRetificacao({ competencia: '2026-10', empresas, linhas, folha });
    const treze = q.find(l => l.retificacao.codigo === 13)!;
    expect(removerRetificacao(folha, treze)).toEqual({ folha: null, desligar: 13 });
    const primeira = removerRetificacao(folha, q[0]);
    expect(primeira).toEqual({ folha: { observacoes: [], retificacoes: [retificacaoEmBranco(12, '09/2026')] }, desligar: null });
    const ultima = quadroDeRetificacao({ competencia: '2026-10', empresas, linhas, folha: primeira.folha! })[0];
    expect(removerRetificacao(primeira.folha!, ultima)).toEqual({ folha: vazia, desligar: 12 });
  });

  it('a referência como fica e a situação da retificação', () => {
    expect(referenciaDaRetificacao('9/2026')).toBe('09/2026');
    expect(referenciaDaRetificacao('092026')).toBe('09/2026');
    expect(referenciaDaRetificacao('2026-09')).toBe('09/2026');
    expect(referenciaDaRetificacao(' ')).toBe('');
    expect(referenciaDaRetificacao('13/2026')).toBeNull();
    expect(referenciaDaRetificacao('setembro')).toBeNull();
    const r = retificacaoEmBranco(12, '09/2026');
    expect(situacaoDaRetificacao(r)).toBe('branco');
    expect(situacaoDaRetificacao({ ...r, marcas: { s: 'ok' } })).toBe('comecada');
    expect(situacaoDaRetificacao({ ...r, entregue: 'email' })).toBe('entregue');
  });
});
