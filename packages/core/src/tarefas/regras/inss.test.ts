import { describe, expect, it } from 'vitest';
import { conferirInss, grupoDoHistorico, grupoDoItem, guiasDasLinhas, linhasDasPaginas } from './inss';
import { lerRazao } from './razao';

// as linhas reais dos comprovantes de arrecadação da 292 (a guia de 01/2026 passa de uma página; o COFINS fica de fora)
const PAGINAS = [
  ['Comprovante de Arrecadação', 'Período Apuração Data de Vencimento Número do Documento', '31/01/2026 25/02/2026 07162605497476525',
    '2172 COFINS - Contribuição para financiamento da segurid. social 8.444,68 - - 8.444,68', '01 - COFINS - FATURAMENTO/PJ EM GERAL',
    'Banco Data de Arrecadação', '756 - BANCO COOPERATIVO SICOOB S/A 25/02/2026'],
  ['Período Apuração Data de Vencimento Número do Documento', '31/01/2026 20/02/2026 07162604466462800', 'Código Descrição Principal Multa Juros Total',
    '1082 Contrib Previd Descontada de Segurados 452,70 - - 452,70', '01 - CP SEGURADOS - EMPREGADOS/AVULSO',
    '1099 Contrib Prev Descontada de Segurado Contribuinte Individual 178,31 - - 178,31', '01 - CP SEGURADOS - CONTRIBUINTES INDIVIDUAIS - 11%',
    '1138 Contribuição Previdenciária Empregador/Empresa 1.168,15 - - 1.168,15', '01 - CP PATRONAL - EMPREGADOS/AVULSOS',
    '1138 Contribuição Previdenciária Empregador/Empresa 324,20 - - 324,20', '04 - CP PATRONAL - CONTRIBUINTES INDIVIDUAIS',
    '1141 Contribuição Adicional Risco Ambiental/Aposent Especial 97,26 - - 97,26', '01 - CP PATRONAL - ADICIONAL GILRAT',
    '1646 Contrib Previd Risco Ambiental/Aposentadoria Especial 87,61 - - 87,61', '01 - CP PATRONAL - GILRAT AJUSTADO',
    '1646 Contrib Previd Risco Ambiental/Aposentadoria Especial 22,50 - - 22,50', '03 - CP PATRONAL - GILRAT - AQUIS PROD RUR PF POR PJ',
    '1656 Contribuição Aquisição Produção Rural PF por PJ/PF 270,00 - - 270,00', '01 - CP PATRONAL - AQUIS PRODUÇÃO RURAL PF POR PJ',
    '1170 Contribuição Terceiros - Salário Educação 146,01 - - 146,01', '01 - CP TERCEIROS - SALÁRIO EDUCAÇÃO',
    '1176 Contribuição Terceiros - Incra 11,68 - - 11,68', '01 - CP TERCEIROS - INCRA',
    '1181 Contribuição Terceiros - Senai 58,40 - - 58,40', '01 - CP TERCEIROS - SENAI',
    'Banco Data de Arrecadação', '756 - BANCO COOPERATIVO SICOOB S/A 20/02/2026'],
  ['31/01/2026 20/02/2026 07162604466462800', 'Composição do Documento de Arrecadação',
    '1184 Contribuição Terceiros - Sesi 87,61 - - 87,61', '01 - CP TERCEIROS - SESI',
    '1200 Cide - Sebrae/Apex/ABDI 35,04 - - 35,04', '01 - CP TERCEIROS - SEBRAE',
    '1213 Contribuição Terceiros - Senar 45,00 - - 45,00', '06 - CP TERCEIROS - SENAR - AQUIS PROD RUR PF POR PJ',
    '2.984,47 0,00 0,00 2.984,47', 'Totais', 'Banco Data de Arrecadação', '756 - BANCO COOPERATIVO SICOOB S/A 20/02/2026'],
  ['31/03/2026 20/04/2026 07162610359753317',
    '1082 Contrib Previd Descontada de Segurados 322,25 - - 322,25', '01 - CP SEGURADOS - EMPREGADOS/AVULSO',
    '1099 Contrib Prev Descontada de Segurado Contribuinte Individual 178,31 - - 178,31', '01 - CP SEGURADOS - CONTRIBUINTES INDIVIDUAIS - 11%',
    '1138 Contribuição Previdenciária Empregador/Empresa 824,20 - - 824,20', '01 - CP PATRONAL - EMPREGADOS/AVULSOS',
    '1138 Contribuição Previdenciária Empregador/Empresa 324,20 - - 324,20', '04 - CP PATRONAL - CONTRIBUINTES INDIVIDUAIS',
    '1141 Contribuição Adicional Risco Ambiental/Aposent Especial 97,26 - - 97,26', '01 - CP PATRONAL - ADICIONAL GILRAT',
    '1646 Contrib Previd Risco Ambiental/Aposentadoria Especial 61,81 - - 61,81', '01 - CP PATRONAL - GILRAT AJUSTADO',
    '1170 Contribuição Terceiros - Salário Educação 103,02 - - 103,02', '01 - CP TERCEIROS - SALÁRIO EDUCAÇÃO',
    '1176 Contribuição Terceiros - Incra 8,24 - - 8,24', '01 - CP TERCEIROS - INCRA',
    '1181 Contribuição Terceiros - Senai 41,21 - - 41,21', '01 - CP TERCEIROS - SENAI',
    '1184 Contribuição Terceiros - Sesi 61,81 - - 61,81', '01 - CP TERCEIROS - SESI',
    '1200 Cide - Sebrae/Apex/ABDI 24,72 - - 24,72', '01 - CP TERCEIROS - SEBRAE',
    'Banco Data de Arrecadação', '756 - BANCO COOPERATIVO SICOOB S/A 20/04/2026'],
];

// o razão do INSS a recolher da 292: a guia de janeiro (pago em 20/02) não foi baixada; março provisionado sem o adicional
const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
const L = (data: string, contra: string, nome: string, valor: number, hist: string, saldo: number) => ['', '', data, '', contra, nome, valor, '', hist, saldo, ''];
const RAZAO = lerRazao([CAB,
  L('11/02/2026', '40007', 'Rescisoes a Pagar', 100, 'Pelo valor de INSS a recolher descontado em rescisão  <02/2026> WILKER', 3084.47),
  L('31/03/2026', '40001', 'Salários a Pagar', 121.57, 'Pelo valor de INSS descontado em folha a recolher  <03/2026> SANDRA', 3206.04),
  L('31/03/2026', '36006', 'Pro Labore a Pagar', 178.31, 'Pelo valor de INSS a recolher descontado s/ retirada pró-labore  <03/2026> MARCOS', 3384.35),
  L('31/03/2026', '40001', 'Salários a Pagar', 200.68, 'Pelo valor de INSS descontado em folha a recolher  <03/2026> KARINA', 3585.03),
  L('31/03/2026', '81002', 'INSS-Encargos da Empresa', 239.01, 'Pelo valor de INSS terceiros a recolher <03/2026>', 3824.04),
  L('31/03/2026', '81002', 'INSS-Encargos da Empresa', 324.2, 'Pelo valor de INSS empresa a recolher <03/2026>', 4148.24),
  L('31/03/2026', '81002', 'INSS-Encargos da Empresa', 886.01, 'Pelo valor de INSS empresa a recolher <03/2026>', 5034.25),
  L('20/04/2026', '10503', 'Banco Sicoob - 01', -2047.03, 'Pagamento de INSS ref 03/2026 conforme DARF.', 2987.22),
]);

describe('as guias do INSS no PDF', () => {
  it('lê só os DARFs previdenciários, junta as páginas da mesma guia e pega a variação de cada código', () => {
    const g = guiasDasLinhas(PAGINAS);
    expect(g.map(x => [x.competencia, x.numero, x.pagaEm, x.itens.length, x.principal])).toEqual([
      ['2026-01', '07162604466462800', '2026-02-20', 14, 2984.47], ['2026-03', '07162610359753317', '2026-04-20', 11, 2047.03],
    ]);
    expect(g[0].itens.find(i => i.codigo === '1213')).toMatchObject({ variacao: '06', descricao: 'CP TERCEIROS - SENAR - AQUIS PROD RUR PF POR PJ', principal: 45 });
  });
  it('os pedaços do pdf.js viram linhas (de cima para baixo, da esquerda para a direita)', () => {
    expect(linhasDasPaginas([[{ texto: '452,70', x: 400, y: 700.2 }, { texto: '1082', x: 40, y: 700 }, { texto: 'Código', x: 40, y: 720 }]])).toEqual([['Código', '1082 452,70']]);
  });
  it('cada código no seu grupo; cada histórico do Alterdata também', () => {
    expect([['1082', '01'], ['1646', '01'], ['1646', '03'], ['1141', '01'], ['1213', '06'], ['1200', '01'], ['2172', '01']].map(([codigo, variacao]) => grupoDoItem({ codigo, variacao })))
      .toEqual(['segurados', 'patronal', 'producao-rural', 'adicional-gilrat', 'producao-rural', 'terceiros', 'outros']);
    expect([
      'Pelo valor de INSS a recolher descontado s/ retirada pró-labore <03/2026> MARCOS', 'Pelo valor do INSS 13º descontado em rescisão <02/2026> WILKER',
      'Pelo valor de INSS terceiros a recolher <03/2026>', 'Pelo valor de INSS empresa a recolher <03/2026>', 'Pagamento de INSS ref 03/2026 conforme DARF.',
    ].map(grupoDoHistorico)).toEqual(['individuais', 'segurados', 'terceiros', 'patronal', null]);
  });
});

describe('a conferência do INSS (razão × guias)', () => {
  const c = conferirInss(RAZAO, guiasDasLinhas(PAGINAS), ['2026-01', '2026-02', '2026-03']);

  it('janeiro fica fora (o razão começa em fevereiro); março: cada grupo bate e o Adicional GILRAT falta', () => {
    expect(c.meses[0].foraDoRazao).toBe(true);
    const mar = c.meses[2];
    expect([mar.provisao, mar.guia?.principal, mar.diferenca, mar.arredondamento]).toEqual([1949.78, 2047.03, 97.25, -0.01]);
    expect(mar.grupos.map(g => [g.grupo, g.razao, g.guia])).toEqual([
      ['segurados', 322.25, 322.25], ['individuais', 178.31, 178.31], ['patronal', 1210.21, 1210.21], ['terceiros', 239.01, 239],
    ]);
    expect(mar.naoProvisionadas.map(v => [v.grupo, v.valor])).toEqual([['adicional-gilrat', 97.26]]);
  });

  it('a guia de janeiro foi paga em 20/02 (dentro do razão) e não tem a baixa; a de março é paga depois do período', () => {
    expect(c.baixas.map(b => [b.guia.competencia, !!b.lancamento])).toEqual([['2026-01', false]]);
  });

  it('os lançamentos sugeridos, com as contas que o razão já usa', () => {
    expect(c.sugestoes.map(s => [s.mes, s.tipo, s.debito, s.credito, s.valor])).toEqual([
      ['2026-03', 'provisao', '81002 INSS-Encargos da Empresa', 'INSS a recolher', 97.26],
      ['2026-03', 'provisao', 'INSS a recolher', '81002 INSS-Encargos da Empresa', 0.01],
      ['2026-01', 'baixa', 'INSS a recolher', '10503 Banco Sicoob - 01', 2984.47],
    ]);
    expect(c.sugestoes[2].historico).toBe('Pagamento de INSS ref 01/2026 conforme DARF.');
  });

  it('o fechamento: o saldo no fim do período, com as sugestões, contra a guia de março (paga depois)', () => {
    // a provisão de 02/2026 (100,00) não tem guia de fevereiro no PDF: sobra como diferença
    expect([c.saldoDoRazao, c.saldoEsperado, c.saldoAjustado, c.antesDoPeriodo]).toEqual([5034.25, 2047.03, 2147.03, -100]);
  });
});
