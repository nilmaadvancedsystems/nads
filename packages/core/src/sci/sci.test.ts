// nads → SCI: lê a planilha de importação do nads (a de verdade, gerada pelo creditor/arquivos/gerar.ts), troca as contas
// pelo de/para e escreve a planilha do SCI (Importar + Conferir). Dados fictícios.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { planilhaDeImportacao } from '../extratudo/creditor/arquivos/gerar';
import {
  COLUNAS_DO_SCI, centavos, dataIso, documentoComMascara, lancamentosParaOSci, lerDePara, lerPlanilhaDoNads,
  classificacaoNormal, conferirComOBalancete, deParaPeloPlano, lerBalanceteDoSci, naturezaDaConta, saldosInvertidos, valorDoBalancete, juntarDePara, mapaDoDePara, planilhaDoDePara, planoDoSci, resumoDoDePara,
  chaveDoLancamento, chavesDaPlanilha, empresaDoLote, exclusaoPeloLote, lerLoteDoMinimum, anoDaPlanilha, loteDaOrigem, loteDaSequencia, loteDoMes, mesPrincipal, MAX_LOTES_POR_ANO, nomeDaPlanilhaSci, planilhaDoSci, planilhaDoSciDaTela, resumoDoSci, TAMANHO_DA_BASE_DO_LOTE, TAMANHO_DO_LOTE,
} from './index';

const CNPJ = '11222333000181';

const doNads = planilhaDeImportacao([
  { automatico: '', data: '05/11/2026', debito: '2950', credito: '1201', valor: 1500, codHistorico: '116', historico: 'PAGTO  ALUGUEL\nNOVEMBRO', documento: '123' },
  { automatico: '', data: '10/11/2026', debito: '2101', credito: '1201', valor: 830.4, codHistorico: '', historico: 'PAGTO NF 456', documento: '' },
  { automatico: '', data: '30/11/2026', debito: '1201', credito: '7777', valor: 12.35, codHistorico: '117', historico: 'RENDIMENTO', documento: '' },
]);

function xlsx(aoa: (string | number)[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'A');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

function abas(bytes: Uint8Array): Record<string, unknown[][]> {
  const wb = XLSX.read(bytes, { type: 'array', raw: true });
  return Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: '' })]));
}

describe('a leitura', () => {
  it('lê a planilha de importação do nads, pulando as 4 linhas vazias', () => {
    const l = lerPlanilhaDoNads(doNads, 'lancatudo_10_bb_2026-11.xls');
    expect(l).toHaveLength(3);
    expect(l[0]).toEqual({ data: '2026-11-05', debito: '2950', credito: '1201', valor: 150000, codHistorico: '116', complemento: 'PAGTO  ALUGUEL\nNOVEMBRO', documento: '123', origem: 'lancatudo_10_bb_2026-11.xls' });
    expect(l[1].valor).toBe(83040);
    expect(l[1].codHistorico).toBe('');
  });

  it('entende data e valor nos jeitos do Excel e do texto', () => {
    expect(dataIso(46331)).toBe('2026-11-05');
    expect(dataIso('5/11/2026')).toBe('2026-11-05');
    expect(dataIso('2026-11-05')).toBe('2026-11-05');
    expect(dataIso('ontem')).toBe('');
    expect(centavos(830.4)).toBe(83040);
    expect(centavos('1.500,00')).toBe(150000);
    expect(centavos('1500.5')).toBe(150050);
    expect(centavos('')).toBeNaN();
  });

  it('lê o de/para pulando os títulos', () => {
    const m = lerDePara(xlsx([['Conta no nads', 'Conta no SCI', 'Nome'], [2950, 41001, 'ALUGUEL'], ['1201', '11202', 'BANCO EXEMPLO'], [2101, 21101, 'FORNECEDORES'], ['', '', '']]));
    expect(m.size).toBe(3);
    expect(m.get('2950')).toEqual({ codigo: '41001', nome: 'ALUGUEL' });
  });
});

describe('os lançamentos do SCI', () => {
  const linhas = lerPlanilhaDoNads(doNads, 'lancatudo.xls');
  const dePara = lerDePara(xlsx([[2950, 41001, 'ALUGUEL'], [1201, 11202, 'BANCO EXEMPLO'], [2101, 21101, 'FORNECEDORES']]));

  it('troca as contas, põe o lote do mês, o CNPJ com máscara e aponta o que impede a importação', () => {
    const s = lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ, dePara });
    expect(s[0]).toMatchObject({ debito: '41001', credito: '11202', nomeD: 'ALUGUEL', nomeC: 'BANCO EXEMPLO', valor: 150000, historico: '116', complemento: 'PAGTO ALUGUEL NOVEMBRO', lote: 'NADS2611', cnpjEmpresa: '11.222.333/0001-81', problemas: [] });
    expect(s[1].problemas).toEqual(['sem histórico']);
    expect(s[2].problemas).toEqual(['a conta 7777 não tem par no SCI']);
  });

  it('o histórico padrão completa os que vieram sem código; sem de/para as contas vão como vieram', () => {
    const s = lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ, historicoPadrao: '116', lote: 'LANC2611' });
    expect(s.map(l => l.problemas)).toEqual([[], [], []]);
    expect(s[1]).toMatchObject({ debito: '2101', historico: '116', lote: 'LANC2611' });
  });

  // o CNPJ inválido não impede mais (27/11/2026: ele não vai na planilha; "Sim, tira")
  it('recusa mesma conta nos dois lados e linha sem valor; o CNPJ inválido não impede', () => {
    const s = lancamentosParaOSci([{ data: '2026-11-01', debito: '5', credito: '5', valor: 0, codHistorico: '1', complemento: '', documento: '', origem: 'x' }], { cnpjEmpresa: '11222333000100' });
    expect(s[0].problemas).toEqual(['débito e crédito na mesma conta', 'sem valor']);
  });

  it('resume por origem e soma só os prontos', () => {
    const r = resumoDoSci(lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ, dePara }));
    expect(r).toMatchObject({ total: 3, prontos: 1, comProblema: 2, valorPronto: 150000, meses: ['2026-11'] });
    expect(r.porOrigem).toEqual([{ origem: 'lancatudo.xls', linhas: 3, comProblema: 2 }]);
  });
});

describe('a planilha do SCI', () => {
  // 26/11/2026: "Leva como regra nesses arquivos exportados da sci, eu quero ele 100% pronto, não quero editar. Então remova:
  // esse total e os dados da coluna lote, deixa vazia!"
  it('Importar: títulos e os prontos, sem o Total e com o Lote vazio; Conferir: os com problema e o motivo', () => {
    const s = lancamentosParaOSci(lerPlanilhaDoNads(doNads, 'lancatudo.xls'), { cnpjEmpresa: CNPJ, historicoPadrao: '116' });
    s[2].problemas.push('teste');
    const a = abas(planilhaDoSci(s));
    expect(Object.keys(a)).toEqual(['Importar', 'Conferir']);
    expect(a.Importar[0]).toEqual([...COLUNAS_DO_SCI]);
    // só as 11 colunas do gerador (25/11/2026: "Nome da conta D? que isso nao ta no layout")
    // a coluna I vazia, sem título e sem dado (27/11/2026: "Coluna CNPJ filial, a coluna I e vazia, nao eh pra ter nada! Nem cabecalho")
    expect(a.Importar[1]).toEqual([46331, 2950, 1201, 1500, 116, 'PAGTO ALUGUEL NOVEMBRO', '123', '', '', '', '']);
    const ws = XLSX.read(planilhaDoSci(s), { type: 'array' }).Sheets.Importar;
    expect(ws.I1).toBeUndefined();
    expect(ws.I2).toBeUndefined();
    expect(ws.H1.v).toBe('Lote');
    expect(ws.J1.v).toBe('Participante a débito');
    expect(a.Importar[0]).toHaveLength(11);
    expect(a.Importar[2].slice(0, 5)).toEqual([46336, 2101, 1201, 830.4, 116]);
    expect(a.Importar).toHaveLength(3);
    expect(a.Importar.flat()).not.toContain('Total');
    expect(a.Importar.slice(1).map(r => r[7])).toEqual(['', '']);
    expect(a.Conferir[0].slice(11)).toEqual(['Nome da conta D', 'Nome da conta C', 'Origem', 'Motivo']);
    expect(a.Conferir[1][14]).toBe('teste');
  });

  // 27/11/2026: "ao exportar os arquivos, voce vai colocar na coluna lote, um codigo propio … que dentre desses numeros tenha o
  // codigo da empresa"; "vai ser um lote por planilha"
  // 27/11/2026: cada linha leva [lote]001, [lote]002… ("Buscar só o lote filtra todos os lançamentos do lote; o código inteiro
  // filtra um"); "a codificacao faz como quiser, nao tem problema, vc sabendo identificar depois"
  // a regra final (27/11/2026): "Vai ser, empresa, lote, ano os parametros"; sem o código da empresa no lote
  it('o lote do minimum: M + o número da sequência (6) e a chave de 3 algarismos em cada lançamento', () => {
    expect(loteDaSequencia(1)).toBe('M000001');
    expect(loteDaSequencia(583)).toBe('M000583');
    expect(loteDaSequencia(MAX_LOTES_POR_ANO)).toBe('M999999');
    expect(loteDaSequencia(1)).toHaveLength(TAMANHO_DA_BASE_DO_LOTE);
    expect(() => loteDaSequencia(0)).toThrow();
    expect(() => loteDaSequencia(MAX_LOTES_POR_ANO + 1)).toThrow();
    expect(chaveDoLancamento('M000001', 1)).toBe('M000001001');
    expect(lerLoteDoMinimum('M000012007')).toEqual({ empresa: null, base: 'M000012', lancamento: 7 });
    expect(lerLoteDoMinimum('M000012')).toEqual({ empresa: null, base: 'M000012', lancamento: null });
    expect(lerLoteDoMinimum('M00001')).toBeNull();
    expect(exclusaoPeloLote('M000012007', 583)).toEqual({ lote: 'M000012', chave: 'M000012007' });
    expect(exclusaoPeloLote('M000012', 590)).toEqual({ lote: 'M000012', chave: null });
    expect(empresaDoLote('M000012007')).toBeNull();
    // o ano: o dos prontos; dois anos na mesma planilha aparecem em anos
    const pronto = (data: string) => ({ data, problemas: [] as string[] });
    expect(anoDaPlanilha([pronto('2026-11-05'), pronto('2026-01-02'), { data: '2025-12-31', problemas: ['x'] }])).toEqual({ ano: 2026, anos: [2026] });
    expect(anoDaPlanilha([pronto('2025-12-31'), pronto('2026-01-02')]).anos).toEqual([2025, 2026]);
    expect(anoDaPlanilha([], new Date(2027, 0, 1))).toEqual({ ano: 2027, anos: [] });
    // o formato de antes (M + empresa + letras) continua sendo lido, para excluir o que já foi importado
    expect(chaveDoLancamento('M583KQT', 1)).toBe('M583KQT001');
    expect(chaveDoLancamento('M583KQT', 999)).toHaveLength(TAMANHO_DO_LOTE);
    expect(lerLoteDoMinimum('m583kqt012')).toEqual({ empresa: 583, base: 'M583KQT', lancamento: 12 });
    expect(lerLoteDoMinimum('M583KQT')).toEqual({ empresa: 583, base: 'M583KQT', lancamento: null });
    expect(empresaDoLote('M7ABCDE001')).toBe(7);
    expect(empresaDoLote('NADS2611')).toBeNull();
    expect(empresaDoLote('M583KQ001')).toBeNull();
    // o que dá para excluir no SCI: a chave e a base; o primeiro formato só o lote; de outra empresa ou de fora, nada
    expect(exclusaoPeloLote('m583kqt012', 583)).toEqual({ lote: 'M583KQT', chave: 'M583KQT012' });
    expect(exclusaoPeloLote('M583KQT', 583)).toEqual({ lote: 'M583KQT', chave: null });
    expect(exclusaoPeloLote('M00583BR6W', 583)).toEqual({ lote: 'M00583BR6W', chave: null });
    expect(exclusaoPeloLote('M583KQT012', 584)).toBeNull();
    expect(exclusaoPeloLote('M00584BR6W', 583)).toBeNull();
    expect(exclusaoPeloLote('NADS2611', 583)).toBeNull();
    expect(exclusaoPeloLote('', 583)).toBeNull();
    const s = lancamentosParaOSci(lerPlanilhaDoNads(doNads, 'lancatudo.xls'), { cnpjEmpresa: CNPJ, historicoPadrao: '116' });
    s[1].problemas.push('teste');
    expect(chavesDaPlanilha(s, 'M583KQT')).toEqual(['M583KQT001', '', 'M583KQT002']);
    expect(chavesDaPlanilha(s, 'M000004')).toEqual(['M000004001', '', 'M000004002']);
    const a = abas(planilhaDoSci(s, 'M583KQT'));
    expect(a.Importar.slice(1).map(r => r[7])).toEqual(['M583KQT001', 'M583KQT002']);
    expect(a.Conferir[1][7]).toBe('M583KQT');
    expect(nomeDaPlanilhaSci(CNPJ, '2026-11', 'minimum', 'M583KQT')).toBe('sci_11222333000181_2026-11_minimum_M583KQT.xlsx');
    // mais de 999 prontos não cabe na chave
    const muitos = Array.from({ length: 1000 }, () => s[0]);
    expect(() => planilhaDoSci(muitos, 'M583KQT')).toThrow(/vai até 999/);
  });

  it('sem problema não tem a aba Conferir', () => {
    const s = lancamentosParaOSci(lerPlanilhaDoNads(doNads, 'x'), { cnpjEmpresa: CNPJ, historicoPadrao: '116' });
    expect(Object.keys(abas(planilhaDoSci(s)))).toEqual(['Importar']);
  });

  it('o botão das telas: da planilha do Alterdata para a do SCI, com a coluna Lote vazia', () => {
    const r = planilhaDoSciDaTela(doNads, 'creditor', { cnpjEmpresa: CNPJ, historicoPadrao: '116' });
    expect(r.nome).toBe('sci_11222333000181_2026-11_creditor.xlsx');
    expect(r.resumo).toMatchObject({ total: 3, prontos: 3 });
    expect(abas(r.bytes).Importar[1][7]).toBe('');
    expect(loteDaOrigem('honorários', '2026-11')).toBe('HONO2611');
    expect(loteDaOrigem('', '2026-11')).toBe('NADS2611');
  });

  it('nome, lote e mês', () => {
    expect(nomeDaPlanilhaSci('11.222.333/0001-81', '2026-11')).toBe('sci_11222333000181_2026-11.xlsx');
    expect(loteDoMes('2026-11')).toBe('NADS2611');
    expect(mesPrincipal([{ data: '2026-10-31' }, { data: '2026-11-01' }, { data: '2026-11-02' }])).toBe('2026-11');
    expect(documentoComMascara('12345678909')).toBe('123.456.789-09');
  });
});

describe('o de/para pelo plano padrão do SCI (90113)', () => {
  const plano = planoDoSci('90113');
  // um plano do nads fictício, no jeito do Alterdata (a classificação sem os zeros da esquerda)
  const doNads = [
    { codigo: '1', nome: 'ATIVO', classificacao: '1', sintetica: true, ordem: 0 },
    { codigo: '100', nome: 'CAIXA', classificacao: '1.1.1.01.001', ordem: 1 },
    { codigo: '101', nome: 'BANCO DO BRASIL', classificacao: '1.1.1.02.001', ordem: 2 },
    { codigo: '300', nome: 'PRO LABORE', classificacao: '9.9.9.99.999', ordem: 3 },
    { codigo: '301', nome: 'ALUGUEL DE IMOVEL DA FILIAL', classificacao: '1.1.1.02.002', ordem: 4 },
    { codigo: '302', nome: 'CONTA QUE NAO EXISTE', classificacao: '', ordem: 5 },
  ];
  const pares = deParaPeloPlano(doNads, plano);

  it('casa pela classificação (sem zeros) com o nome parecido, depois pelo nome; o resto fica a conferir ou sem par', () => {
    expect(classificacaoNormal('01.1.1.02.001')).toBe('1.1.1.2.1');
    expect(pares.map(p => [p.codigo, p.como, p.sci?.codigo ?? p.sugestao?.codigo ?? null])).toEqual([
      ['100', 'classificacao', '5'],
      ['101', 'classificacao', '7'],
      ['300', 'nome', '457'],
      ['301', 'conferir', '8'],
      ['302', 'semPar', null],
    ]);
    expect(resumoDoDePara(pares)).toEqual({ classificacao: 2, nome: 1, conferir: 1, semPar: 1 });
  });

  it('o de/para só leva o que casou; a planilha volta pela leitura de sempre, sem a sugestão', () => {
    const mapa = mapaDoDePara(pares);
    expect([...mapa.keys()]).toEqual(['100', '101', '300']);
    const lido = lerDePara(planilhaDoDePara(pares));
    expect(lido.get('101')).toEqual({ codigo: '7', nome: 'Banco do Brasil S/A' });
    expect(lido.has('301')).toBe(false);
    expect(juntarDePara(mapa, new Map([['301', { codigo: '9', nome: 'conferido' }]])).get('301')?.codigo).toBe('9');
  });

  it('com o plano, a planilha aponta a conta que não existe, a sintética e a que pede participante', () => {
    const linhas = [
      { data: '2026-11-05', debito: '457', credito: '7', valor: 100, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
      { data: '2026-11-05', debito: '16', credito: '01.1.1.02.001', valor: 100, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
      { data: '2026-11-05', debito: '6', credito: '99999', valor: 100, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
    ];
    const s = lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ, planoSci: plano });
    expect(s[0]).toMatchObject({ problemas: [], nomeD: 'Pró-Labore', nomeC: 'Banco do Brasil S/A' });
    expect(s[1].problemas).toEqual(['a conta de débito 16 pede o cliente (participante)']);
    expect(s[2].problemas).toEqual(['a conta 6 (BANCOS CONTA MOVIMENTO) não recebe lançamento no SCI', 'a conta 99999 não existe no plano 90113 do SCI']);
  });
});

describe('o balancete do SCI de volta (o formato real, com dados fictícios)', () => {
  // como o SCI exporta: Windows-1252, ";", sem aspas, sem D/C (o sinal natural do grupo; ao contrário, entre parênteses)
  const win = (s: string) => new Uint8Array(Buffer.from(s, 'latin1'));
  const csv = [
    'BALANCETE DE 01/10/2026 A 31/10/2026;;;;;;',
    'EMPRESA: 999 - EMPRESA EXEMPLO LTDA;MONTES CLAROS/MG -CNPJ:11.222.333/0001-81',
    '',
    '',
    'CONTA;CLASSIFICAÇÃO;NOME DA CONTA CONTÁBIL;SALDO ANTERIOR;DÉBITO;CRÉDITO;SALDO ATUAL',
    '',
    '1;01;ATIVO;1.000,00;2.330,40;1.500,00;1.830,40',
    '5;01.1.1.01.001;Caixa;1.000,00;0,00;1.500,00;(500,00)',
    '7;01.1.1.02.001;Banco do Brasil S/A;0,00;2.330,40;0,00;2.330,40',
    '250;01.2.3.01.002;(-) Depreciação acumulada;0,00;0,00;100,00;(100,00)',
    '140;02;PASSIVO;0,00;830,40;0,00;(830,40)',
    '148;02.1.1.01.001;Fornecedores;0,00;830,40;0,00;(830,40)',
    '272;03.1.2;DEDUÇÕES DAS RECEITAS C/VENDAS E SERVIÇO;(100,00);100,00;0,00;(200,00)',
    '284;03.1.2.02.008;Simples Nacional sobre vendas e serviços;(100,00);100,00;0,00;(200,00)',
    '457;04.2.1.01.002;Pró-Labore;0,00;1.500,00;0,00;1.500,00',
  ].join('\r\n') + '\r\n';

  it('lê o cabeçalho (empresa, CNPJ, período), a CONTA como código e o sinal natural', () => {
    const r = lerBalanceteDoSci(win(csv), 'Balancete.csv');
    expect(r.erro).toBeNull();
    const b = r.balancete!;
    expect(b).toMatchObject({ empresa: 'EMPRESA EXEMPLO LTDA', cnpj: '11.222.333/0001-81', inicio: '2026-10-01', fim: '2026-10-31' });
    expect(b.contas).toHaveLength(9);
    // + = devedor, − = credor: o caixa ficou credor; o fornecedor, entre parênteses no grupo 02, ficou devedor
    expect(b.contas.find(c => c.codigo === '5')).toMatchObject({ nome: 'Caixa', analitica: true, anterior: 100000, debito: 0, credito: 150000, atual: -50000 });
    expect(b.contas.find(c => c.codigo === '148')).toMatchObject({ atual: 83040 });
    expect(b.contas.find(c => c.codigo === '1')?.analitica).toBe(false);
  });

  it('aponta o saldo contrário à natureza, menos as redutoras (depreciação, deduções da receita)', () => {
    const b = lerBalanceteDoSci(win(csv)).balancete!;
    expect(saldosInvertidos(b).map(c => c.codigo)).toEqual(['5', '148']);
    expect(naturezaDaConta('03.1.1')).toBe('C');
  });

  it('aceita também D/C no valor ou na coluna ao lado (outros exportadores)', () => {
    const outro = [
      '"Classificacao","Codigo","Descricao","Saldo Anterior","","Debito","Credito","Saldo Atual",""',
      '"01.1.1.01.001","5","Caixa","1.000,00","D","0,00","1.500,00","500,00","C"',
      '"02.1.1.01.001","148","Fornecedores","10,00D","","0,00","0,00","10,00D",""',
    ].join('\n');
    const b = lerBalanceteDoSci(new TextEncoder().encode(outro), 'b.csv').balancete!;
    expect(b.contas.map(c => [c.codigo, c.anterior, c.atual])).toEqual([['5', 100000, -50000], ['148', 1000, 1000]]);
    expect(valorDoBalancete('(1.234,56)')).toBe(-123456);
  });

  it('confere o que o nads mandou com o movimento do SCI', () => {
    const b = lerBalanceteDoSci(win(csv)).balancete!;
    const linhas = [
      { data: '2026-10-05', debito: '457', credito: '5', valor: 150000, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
      { data: '2026-10-10', debito: '148', credito: '7', valor: 83040, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
      { data: '2026-10-11', debito: '7', credito: '296', valor: 1000, codHistorico: '1', complemento: '', documento: '', origem: 'x' },
    ];
    const r = conferirComOBalancete(lancamentosParaOSci(linhas, { cnpjEmpresa: CNPJ }), b, planoDoSci('90113'));
    const por = Object.fromEntries(r.map(c => [c.codigo, c.situacao]));
    // o 7 recebeu 2.330,40 a débito no SCI e o nads mandou 10,00 a débito e 830,40 a crédito: faltou o crédito
    expect(por).toEqual({ '5': 'bate', '7': 'faltou', '148': 'bate', '457': 'bate', '296': 'fora do balancete' });
  });

  it('pede a classificação quando o balancete veio sem ela, e diz quando nem é balancete', () => {
    const semCodigos = 'BALANCETE DE 01/10/2026 A 31/10/2026;;;;\r\nNOME DA CONTA CONTÁBIL;SALDO ANTERIOR;DÉBITO;CRÉDITO;SALDO ATUAL\r\nCaixa;1,00;0,00;0,00;1,00\r\n';
    expect(lerBalanceteDoSci(win(semCodigos), 'b.csv').erro).toMatch(/Imprimir conta/);
    expect(lerBalanceteDoSci(win('a;b;c\n1;2;3'), 'x.csv').erro).toMatch(/títulos/);
  });
});
