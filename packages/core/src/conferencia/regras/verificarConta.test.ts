import { describe, expect, it } from 'vitest';
import { conta, empresa, linha, nota, servico } from '../__legado__/fixtures';
import { marcarNotaNaoContabil } from '../acoes';
import { chaveNota } from './cfop';
import { conferirConta, linhasForaDoContabil, podeNaoIrParaOContabil, ehLinhaIcms, naturezasDaConferencia, numerosDoHistorico, opcoesCfop, partesDoHistorico, linhasFaltando, semPendencias, soPendenciasQuePassam, totaisVerificacao, type LinhaRazao, type ResultadoVerificacao } from './verificarConta';

describe('numerosDoHistorico', () => {
  it('padrão fiscal: o número antes do CNPJ, ignorando o resto', () => {
    expect(numerosDoHistorico('conf NF-e ? - 29-54540585000161-NOME // NF 9009', false)).toEqual(['29']);
  });
  it('sem o padrão: números de 3+ dígitos (fiscal < 11 dígitos)', () => {
    expect(numerosDoHistorico('NF 12345 ref 9876543210123 e 777 12', false)).toEqual(['12345', '777']);
  });
  it('nota de 1 dígito com espaços em volta do traço (serviços tomados da 292)', () => {
    // o número no fim do nome ("NETO 006679") não é nota (Vitor, 08/10/2026)
    expect(numerosDoHistorico('Pelo valor de Serviços Tomados conf. NF nº - 6 - 27203457000150-RAIMUNDO PINHEIRO DOS SANTOS NETO 006679', true)).toEqual(['6']);
    expect(numerosDoHistorico('Pelo valor de Serviços Tomados conf. NF nº - 002600000000107 - 30295591000132-LEONEL RODRIGUES FREITAS', true)).toEqual(['002600000000107']);
  });
  it('o CNPJ com barra não vira nota: o "/0001-" não é a NF 1 (309, 08/10/2026)', () => {
    expect(numerosDoHistorico('Pelo valor de Serviços Tomados conf. NF nº - 002600000006032 - 08760011/0001-81-DIGITEC COPIADORA E IFORMATICA LTDA ME', true)).toEqual(['002600000006032']);
    expect(numerosDoHistorico('Pelo valor de Serviços Tomados conf. NF nº - 002600000003194 - 71400253/0001-09-ALEXSANDRO DE OLIVEIRA - CPF 96164395615', true)).toEqual(['002600000003194']);
    expect(numerosDoHistorico('conf NF 4521 - 08.760.011/0001-81 - DIGITEC', false)).toEqual(['4521']);
  });
  it('serviço: aceita até 15 dígitos, mas não 11 (CPF) nem 14 (CNPJ)', () => {
    expect(numerosDoHistorico('NFS 202600000012345 CNPJ 11222333000100 CPF 12345678901 nr 777', true)).toEqual(['202600000012345', '777']);
  });
});

describe('partesDoHistorico', () => {
  it('nota, documento, nome, contrapartida e lançamento', () => {
    expect(partesDoHistorico('Fornecedores 21101 pelo valor conf NF-e 00029 - 54540585000161 - EMPRESA X')).toEqual({
      nota: '29', doc: '54540585000161', nome: 'EMPRESA X', contra: 'Fornecedores', lanc: '21101',
    });
  });
  it('CNPJ sem o zero da frente ou com pontuação (razão de serviços da 292)', () => {
    const base = 'Internet a Pagar 00067 Pelo serviços de acesso a internet conf nota fiscal de serviços nº - ';
    expect(partesDoHistorico(base + '000041699 - 7314935000191-CONECTA FIBRA LTDA')).toMatchObject({ nota: '41699', doc: '07314935000191', nome: 'CONECTA FIBRA LTDA' });
    expect(partesDoHistorico(base + '16787-07314935/0001-91-CONECTA FIBRA LTDA')).toMatchObject({ nota: '16787', doc: '07314935000191', nome: 'CONECTA FIBRA LTDA' });
    expect(partesDoHistorico(base + '000000000207372 - 52622141000140-CONECTA DIGITAL LTDA')).toMatchObject({ nota: '207372', doc: '52622141000140', nome: 'CONECTA DIGITAL LTDA' });
    expect(partesDoHistorico('NF 55 - 123.456.789-01 - MARIA')).toMatchObject({ nota: '55', doc: '12345678901', nome: 'MARIA' });
  });
  it('texto sem padrão devolve tudo vazio', () => {
    expect(partesDoHistorico('qualquer coisa')).toEqual({ nota: '', doc: '', nome: '', contra: '', lanc: '' });
  });
});

describe('ehLinhaIcms', () => {
  it('palavra ICMS inteira', () => {
    expect(ehLinhaIcms({ txt: 'ICMS a Recuperar s/ devolução' })).toBe(true);
    expect(ehLinhaIcms({ txt: 'Pelo valor do ICMS-ST' })).toBe(true);
    expect(ehLinhaIcms({ txt: 'DICMS 55' })).toBe(false);
  });
});

describe('conferirConta', () => {
  const COMPRA = 'Compra para comercialização';
  const e = empresa({
    contas: [conta('66005', 'Compras de Mercadorias'), conta('31122', 'Uso e Consumo')],
    entradas: [
      nota('1102', '6', 500, '100'),
      nota('1102', '6', 300, '101'),
      nota('1102', '6', 400, '200'),
      nota('1556', '215', 50, '200'), // mesma NF, outro CFOP
    ],
    naturezaConta: { [COMPRA]: ['66005'], 'Uso e Consumo': ['31122'] },
  });
  const conferir = (linhas: LinhaRazao[]) => conferirConta({ empresa: e, contas: [e.contas[0]], razaoPorConta: { 66005: linhas }, cfopGrupo: COMPRA, servTipo: null });

  it('tudo lançado: sem pendências', () => {
    const r = conferir([linha('100', 500), linha('101', 300), linha('200', 400)]);
    expect(semPendencias(r)).toBe(true);
    expect(r.somaFiscal).toBe(1200);
    expect(r.fonte).toBe('CFOP 1102 — ' + COMPRA);
  });
  it('sem o número no histórico, mas com o mesmo valor perto da data: conferida pelo valor (o pagamento no banco)', () => {
    const banco = (valor: number, data: string): LinhaRazao => ({ txt: 'DB.TR.C.DIF.TIT.INT comissao DOC.: 16283133', data, valor, sinal: 1, contra: '' });
    const r = conferir([linha('100', 500), banco(300, '06/07/2026'), linha('200', 400)]);
    expect(r.faltando).toEqual([]);
    expect(r.aMais).toEqual([]);
    expect(r.peloValor.map(p => p.nota.numero)).toEqual(['101']);
    expect(semPendencias(r)).toBe(true);
    // longe da data (mais de 5 dias): continua faltando e a linha fica a mais
    const r2 = conferir([linha('100', 500), banco(300, '20/07/2026'), linha('200', 400)]);
    expect(r2.faltando.map(n => n.numero)).toEqual(['101']);
    expect(r2.aMais.length).toBe(1);
  });
  it('nota que não está no razão: faltando', () => {
    const r = conferir([linha('100', 500), linha('200', 400)]);
    expect(r.faltando.map(n => n.numero)).toEqual(['101']);
  });
  it('mesmo número duas vezes somando o valor da nota (itens): não é duplicada', () => {
    const r = conferir([linha('100', 200), linha('100', 300), linha('101', 300), linha('200', 400)]);
    expect(r.duplicada).toEqual([]);
    expect(semPendencias(r)).toBe(true);
  });
  it('mesmo número passando do valor: duplicada com o excesso e a linha que sobra', () => {
    const r = conferir([linha('100', 500), linha('100', 120), linha('101', 300), linha('200', 400)]);
    expect(r.duplicada.length).toBe(1);
    expect(r.duplicada[0]).toMatchObject({ numero: '100', vezes: 2 });
    expect(r.duplicada[0].valor).toBeCloseTo(120, 5);
    expect(r.duplicada[0].linhas.map(l => l.valor)).toEqual([120]);
  });
  it('linha com o valor do item de outro CFOP da mesma NF: vai pra "a mais" com a dica', () => {
    const r = conferir([linha('100', 500), linha('101', 300), linha('200', 400), linha('200', 50)]);
    expect(r.duplicada).toEqual([]);
    expect(r.aMais.length).toBe(1);
    expect(r.aMais[0].valor).toBe(50);
    expect(r.aMais[0].dica).toBe('é do CFOP 1556 (conta 31122)');
  });
  it('linha de ICMS sai da conferência e vai pra lista própria', () => {
    const r = conferir([linha('100', 500), linha('101', 300), linha('200', 400), { ...linha('100', 90), txt: 'ICMS a Recuperar s/ NF 100' }]);
    expect(r.icms.length).toBe(1);
    expect(r.duplicada).toEqual([]);
    expect(r.somaSemIcms).toBe(1200);
    expect(r.somaRazao).toBe(1290);
  });
  it('totais: diferença = faltando − duplicadas − a mais − ICMS + sem explicação', () => {
    const r = conferir([linha('100', 500), linha('100', 120), linha('200', 400), { ...linha('0', 90), txt: 'ICMS s/ compra' }, linha('999', 7)]);
    const t = totaisVerificacao(r);
    expect(t.faltando).toBe(300);
    expect(t.duplicadas).toBeCloseTo(120, 5);
    expect(t.aMais).toBe(7);
    expect(t.icms).toBe(90);
    expect(t.diferenca).toBeCloseTo(1200 - 1117, 5);
    expect(t.faltando - t.duplicadas - t.aMais - t.icms + t.semExplicacao).toBeCloseTo(t.diferenca, 5);
    expect(t.semExplicacao).toBeCloseTo(0, 5);
  });
  it('sem CFOP escolhido: erro', () => {
    expect(() => conferirConta({ empresa: e, contas: [e.contas[0]], razaoPorConta: {}, cfopGrupo: null, servTipo: null })).toThrow('Escolha o CFOP');
  });
  it('nota de valor zero não entra em "faltando"', () => {
    const e0 = empresa({ ...e, entradas: [...e.entradas, nota('1102', '6', 0, '300')] });
    const r = conferirConta({ empresa: e0, contas: [e0.contas[0]], razaoPorConta: { 66005: [linha('100', 500), linha('101', 300), linha('200', 400)] }, cfopGrupo: COMPRA, servTipo: null });
    expect(r.faltando).toEqual([]);
    expect(semPendencias(r)).toBe(true);
  });
});

describe('conta ligada a várias naturezas (ex.: 96501 = 5102 + 5405)', () => {
  const V5102 = 'Venda de mercadoria adquirida ou recebida de terceiros';
  const V5405 = 'Venda de mercadoria, adquirida ou recebida de terceiros, na condição de contribuinte-substituído';
  const e = empresa({
    contas: [conta('96501', 'Vendas de Mercadorias', 0, 'Receita', 'C')],
    saidas: [
      nota('5102', '182', 100, '9001'),
      nota('5405', '182', 250, '9002'),
      nota('5102', '182', 68.09, '9756'),
      nota('5405', '182', 269.37, '9756'), // mesma NF, os dois CFOPs na mesma conta
    ],
    naturezaConta: { [V5102]: ['96501'], [V5405]: ['96501'] },
  });
  const conta96501 = e.contas[0];

  it('o campo CFOP mostra as duas naturezas juntas', () => {
    const op = opcoesCfop(e, conta96501);
    expect(op.vinculada).toBe(V5102);
    expect(op.rotulos[V5102]).toBe('5102, 5405 (4 notas)');
    expect(naturezasDaConferencia(e, ['96501'], V5102)).toEqual([V5102, V5405]);
  });
  it('confere contra todas: a venda 5405 não vira "a mais"', () => {
    const r = conferirConta({ empresa: e, contas: [conta96501], razaoPorConta: { 96501: [linha('9001', 100), linha('9002', 250), linha('9756', 337.46)] }, cfopGrupo: V5102, servTipo: null });
    expect(semPendencias(r)).toBe(true);
    expect(r.somaFiscal).toBeCloseTo(687.46, 5);
    expect(r.fonte).toBe('CFOP 5102, 5405');
  });
  it('NF com os dois CFOPs lançada duas vezes: duplicada pelo valor da nota inteira', () => {
    const r = conferirConta({ empresa: e, contas: [conta96501], razaoPorConta: { 96501: [linha('9001', 100), linha('9002', 250), linha('9756', 337.46), linha('9756', 337.46)] }, cfopGrupo: V5102, servTipo: null });
    expect(r.aMais).toEqual([]);
    expect(r.duplicada.length).toBe(1);
    expect(r.duplicada[0].valor).toBeCloseTo(337.46, 5);
  });
  it('CFOP escolhido à mão, que não é ligado à conta: só ele', () => {
    expect(naturezasDaConferencia(e, ['99999'], V5405)).toEqual([V5405]);
  });
});

describe('a nota que não vai para o Contábil (CFOP 1949/2949; Vitor, 22/10/2026)', () => {
  const OUTRA = 'Outra entrada de mercadoria ou prestação de serviço não especificada';
  const agua = nota('1949', '6', 120, '5001'), locacao = nota('1949', '6', 9000, '77');
  const e = empresa({ contas: [conta('87501', 'Água e Esgoto')], entradas: [agua, locacao], naturezaConta: { [OUTRA]: ['87501'] } });
  const conferir = (x: typeof e) => conferirConta({ empresa: x, contas: [x.contas[0]], razaoPorConta: { 87501: [linha('5001', 120)] }, cfopGrupo: OUTRA, servTipo: null });
  it('só os CFOPs 1949 e 2949 têm a opção', () => {
    expect(['1949', '2949', '1102', '5949'].map(podeNaoIrParaOContabil)).toEqual([true, true, false, false]);
  });
  it('marcada, sai da conferência e da soma das notas; a lista dela mostra para desfazer', () => {
    expect(conferir(e).faltando.map(n => n.numero)).toEqual(['77']);
    const marcada = marcarNotaNaoContabil(e, chaveNota(locacao), true, 'NF 77 · não vai para o Contábil', new Date());
    const r = conferir(marcada);
    expect([r.faltando.length, r.somaFiscal, semPendencias(r)]).toEqual([0, 120, true]);
    expect(linhasForaDoContabil(r).map(l => [l.nota, l.chave])).toEqual([['77', chaveNota(locacao)]]);
    expect(marcada.confHistorico[marcada.confHistorico.length - 1].texto).toBe('NF 77 · não vai para o Contábil');
    // desfazer: volta a faltar
    expect(conferir(marcarNotaNaoContabil(marcada, chaveNota(locacao), false, 'NF 77 · volta', new Date())).faltando.map(n => n.numero)).toEqual(['77']);
  });
});

describe('soPendenciasQuePassam (bens do ativo e ICMS: "Conferir mais adiante...")', () => {
  const base = { faltando: [], duplicada: [], aMais: [], peloValor: [], icms: [] } as unknown as ResultadoVerificacao;
  const falta = (cfop: string) => ({ cfop, numero: '1', nome: 'X', valor: 100, data: '15/01/2026' }) as unknown as ResultadoVerificacao['faltando'][number];
  it('só nota de bem faltando (o ICMS não conta): passa', () => {
    expect(soPendenciasQuePassam({ ...base, faltando: [falta('1551')] })).toBe(true);
    expect(soPendenciasQuePassam({ ...base, faltando: [falta('2551'), falta('1406')], icms: [{} as never] })).toBe(true);
  });
  it('sem pendência, nota que não é de bem ou algo a mais: não', () => {
    expect(soPendenciasQuePassam(base)).toBe(false);
    expect(soPendenciasQuePassam({ ...base, faltando: [falta('1551'), falta('1102')] })).toBe(false);
    expect(soPendenciasQuePassam({ ...base, faltando: [falta('1551')], aMais: [{} as never] })).toBe(false);
  });
});

describe('Operação incorreta (Vitor, 14/10/2026: serviço prestado na conta de tomados)', () => {
  const COMPRA = 'Compra para comercialização';
  const e = empresa({
    contas: [conta('66005', 'Compras de Mercadorias')],
    entradas: [nota('1102', '6', 500, '100')],
    servPrestados: [servico('646', 'PEREIRA CAMPOS ENGENHARIA LTDA', 7000, '160'), servico('777', 'OUTRO CLIENTE LTDA', 90, '160')],
    naturezaConta: { [COMPRA]: ['66005'] },
  });
  const conferir = (linhas: LinhaRazao[]) => conferirConta({ empresa: e, contas: [e.contas[0]], razaoPorConta: { 66005: linhas }, cfopGrupo: COMPRA, servTipo: null });
  const prestada: LinhaRazao = { txt: 'conf NF 646 - 11.222.333/0001-00 - PEREIRA CAMPOS ENGENHARIA LTDA', data: '04/08/2026', valor: 7000, sinal: 1, contra: '' };

  it('a nota de serviço prestado lançada na conta de entradas sai do "A mais" e vira "Operação incorreta"', () => {
    const r = conferir([linha('100', 500), prestada]);
    expect(r.aMais).toEqual([]);
    expect(r.operacaoIncorreta.map(l => l.txt)).toEqual([prestada.txt]);
    expect(r.operacoesDaConta).toEqual(['Entrada']);
    expect(semPendencias(r)).toBe(false);
    expect(soPendenciasQuePassam(r)).toBe(false);
    const t = totaisVerificacao(r);
    expect(t.operacaoIncorreta).toBe(7000);
    expect(t.semExplicacao).toBeCloseTo(0);
  });
  it('a coluna Operação: a linha da própria conta é Entrada; a nota faltando também', () => {
    const r = conferir([prestada]);
    expect(r.linhas.map(l => l.operacao)).toEqual(['Prestado']);
    expect(linhasFaltando(r).map(l => l.operacao)).toEqual(['Entrada']);
    expect(conferir([linha('100', 500)]).linhas[0].operacao).toBe('Entrada');
  });
  it('o mesmo número de outro participante, com outro valor: não é a nota, continua "A mais"', () => {
    const r = conferir([linha('100', 500), { txt: 'conf NF 777 - 99.888.777/0001-66 - FULANO DE TAL', data: '05/07/2026', valor: 12, sinal: 1, contra: '' }]);
    expect(r.operacaoIncorreta).toEqual([]);
    expect(r.aMais.length).toBe(1);
  });
});
