import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { lerRelatorioPlanilha, lerRelatorioTexto, ordemDoCabecalho, relatorioDosItens, tituloDaLinha } from './arquivos/banco';
import { livroDeImportacao } from './arquivos/gerar';
import { linhasDoCsv } from './arquivos/planilha';
import { linhasDosItens } from './arquivos/pdf';
import { clienteDoHistorico, lerSistema, nfDoHistorico } from './arquivos/sistema';
import { BALANCETES_EXEMPLO, EXEMPLO_RELATORIO, EXEMPLO_SISTEMA_CSV } from './exemplos';
import { balanceteDoDocumento, CONFIG_VAZIA, configDoDocumento, confirmarContas, escolherConta, mesmaConfig, resolverContas, SEM_BALANCETE, sugerirConta } from './regras/balancete';
import { conferirGrupo, conferirTotalGeral, relatorioConferido, temTotalImpresso } from './regras/conferencia';
import { cruzar, mesmoCliente, pendentes, type Decisao } from './regras/cruzamento';
import { fecharPorDia, gerarLancamentos, historicoSemPrefixo, titulosFora } from './regras/lancamentos';
import { chaveNf, dataBR, dinheiro } from './regras/numeros';
import { CONTAS_PADRAO, type RelatorioBanco } from './tipos';

const buf = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

/** O exemplo com o dígito corrigido (CANTINA 980,00 → 930,00), como a pessoa faria na conferência. */
function corrigido(): RelatorioBanco {
  const r = lerRelatorioTexto(EXEMPLO_RELATORIO);
  return { ...r, grupos: r.grupos.map(g => ({ ...g, titulos: g.titulos.map(t => (t.nf === '4557' ? { ...t, valor: 930 } : t)) })) };
}

describe('números', () => {
  it('chave da NF, dinheiro e data', () => {
    expect(chaveNf('004521')).toBe('4521');
    expect(chaveNf('4548/2')).toBe('4548');
    expect(chaveNf('NF 4521')).toBe('4521');
    expect(dinheiro('R$ 1.234,56')).toBe(1234.56);
    expect(dinheiro(10.005)).toBe(10.01);
    expect(dataBR('1/9/26')).toBe('01/09/2026');
    expect(dataBR('2026-09-03')).toBe('03/09/2026');
    expect(dataBR(new Date(2026, 8, 2))).toBe('02/09/2026');
  });
});

describe('relatório do banco em texto', () => {
  it('cabeçalho: ordem das colunas', () => {
    const o = ordemDoCabecalho('Sacado  Nosso Numero  Seu Numero  Vencimento  Valor (R$)  Vlr. Mora  Vlr. Desc. Acresc.  Dt. Liquidacao  Vlr. Cobrado');
    expect(o).toEqual({ dinheiro: ['valor', 'mora', 'desconto', 'cobrado'], datas: ['vencimento', 'liquidacao'], inteiros: ['nosso', 'seu'] });
  });

  it('lê o exemplo: 3 grupos, totais impressos, total geral e a baixa de fora', () => {
    const r = lerRelatorioTexto(EXEMPLO_RELATORIO);
    expect(r.grupos.map(g => g.titulos.length)).toEqual([3, 3, 3]);
    expect(r.ignorados).toBe(1);
    expect(r.avisos).toEqual([]);
    const t = r.grupos[0].titulos[0];
    expect(t).toMatchObject({ sacado: 'MERCADO BOM PRECO LTDA', nossoNumero: '00012345671', nf: '4521', valor: 1250, mora: 12.5, desconto: 0, liquidacao: '01/09/2026', cobrado: 1262.5 });
    expect(r.grupos[0].impresso).toEqual({ valor: 4180.4, mora: 12.5, desconto: 16.61, outros: null, cobrado: 4176.29 });
    expect(r.totalGeral).toEqual({ valor: 8593.22, mora: 21.8, desconto: 46.21, outros: null, cobrado: 8568.81 });
  });

  it('número no nome do sacado não vira a NF', () => {
    const o = ordemDoCabecalho('Sacado  Nosso Numero  Seu Numero  Valor (R$)  Dt. Liquidacao');
    const t = tituloDaLinha('MERCADO 2 IRMAOS  00099  7788  100,00  01/09/2026', o, 1);
    expect(t).toMatchObject({ sacado: 'MERCADO 2 IRMAOS', nossoNumero: '00099', nf: '7788' });
  });

  it('sem cabeçalho: adivinha e avisa', () => {
    const t = tituloDaLinha('JOAO DA SILVA 123456789 555 100,00 2,00 01/09/2026 102,00', null, 1);
    expect(t).toMatchObject({ nossoNumero: '123456789', nf: '555', valor: 100, mora: 2, cobrado: 102 });
    expect(t?.aviso).toBeTruthy();
  });
});

describe('conferência dos grupos', () => {
  it('dígito lido errado: o grupo não bate e a linha incoerente aparece', () => {
    const r = lerRelatorioTexto(EXEMPLO_RELATORIO);
    expect(conferirGrupo(r.grupos[0]).situacao).toBe('ok');
    const g2 = conferirGrupo(r.grupos[1]);
    expect(g2.situacao).toBe('diverge');
    expect(g2.colunas.find(c => c.coluna === 'valor')).toMatchObject({ soma: 2045.33, impresso: 1995.33, diferenca: 50 });
    expect(g2.incoerentes).toEqual([r.grupos[1].titulos[2].id]);
    expect(relatorioConferido(r)).toBe(false);
  });

  it('corrigido: tudo bate, inclusive o total geral', () => {
    const r = corrigido();
    expect(r.grupos.map(g => conferirGrupo(g).situacao)).toEqual(['ok', 'ok', 'ok']);
    expect(conferirTotalGeral(r).ok).toBe(true);
    expect(relatorioConferido(r)).toBe(true);
  });

  it('sem total impresso não passa', () => {
    const r = corrigido();
    const g = { ...r.grupos[0], impresso: { valor: null, mora: null, desconto: null, outros: null, cobrado: null } };
    expect(conferirGrupo(g).situacao).toBe('sem-total');
  });

  it('sem nenhum total impresso, não há o que conferir', () => {
    expect(temTotalImpresso(lerRelatorioTexto(EXEMPLO_RELATORIO))).toBe(true);
    const semTotal = lerRelatorioPlanilha(buf('Sacado;Seu Número;Valor;Dt. Liquidação\nA;1;10,00;01/09/2026\n'), 'b.csv');
    expect(temTotalImpresso(semTotal)).toBe(false);
    expect(temTotalImpresso({ ...semTotal, registrosGeral: 1 })).toBe(true);
  });
});

describe('arquivo do sistema', () => {
  it('lê o CSV do exemplo', () => {
    const s = lerSistema(buf(EXEMPLO_SISTEMA_CSV), 'sistema.csv');
    expect(s).toHaveLength(7);
    expect(s[0]).toMatchObject({ linha: 2, nf: '4521', cliente: 'MERCADO BOM PRECO LTDA', contrapartida: '11201', valor: 1250 });
  });

  it('NF e cliente tirados do histórico', () => {
    expect(nfDoHistorico('Recebimento de clientes NF 4521 - MERCADO X')).toBe('4521');
    expect(nfDoHistorico('Receb. Nota Fiscal nº 88 - Y')).toBe('88');
    expect(clienteDoHistorico('Recebimento de clientes NF 4521 - MERCADO X')).toBe('MERCADO X');
    const s = lerSistema(buf('Contrapartida;Historico;Valor\n11201;Recebimento de clientes NF 77 - ZE;10,00\n'), 's.csv');
    expect(s[0]).toMatchObject({ nf: '77', cliente: 'ZE', valor: 10 });
  });

  it('CSV com aspas', () => {
    expect(linhasDoCsv('a;"b;c";"d ""e"""\n')).toEqual([['a', 'b;c', 'd "e"']]);
  });

  it('sem as colunas: erro claro', () => {
    expect(() => lerSistema(buf('x;y\n1;2\n'), 's.csv')).toThrow(/Contrapartida/);
  });
});

describe('cruzamento', () => {
  const r = corrigido();
  const titulos = r.grupos.flatMap(g => g.titulos);
  const sistema = lerSistema(buf(EXEMPLO_SISTEMA_CSV), 'sistema.csv');
  const cr = cruzar(titulos, sistema);
  const por = (nf: string) => cr.filter(c => titulos.find(t => t.id === c.tituloId)?.nf === nf).map(c => c.situacao);

  it('situações do exemplo', () => {
    expect(por('4521')).toEqual(['ok']);
    expect(por('4540')).toEqual(['ok']); // "RESTAURANTE SABOR CASEIRO" × "... LTDA"
    expect(por('4548')).toEqual(['dividido', 'dividido']);
    expect(por('4555')).toEqual(['valor-diverge']);
    expect(por('4560')).toEqual(['nao-encontrada']);
  });

  it('mesmo cliente com nome cortado', () => {
    expect(mesmoCliente('PADARIA SAO JORGE', 'PADARIA SÃO JORGE ME')).toBe(true);
    expect(mesmoCliente('MERCADO BOM PRECO', 'ACOUGUE BOI GORDO')).toBe(false);
  });

  it('pendências somem com decisão válida', () => {
    expect(pendentes(cr, {})).toHaveLength(2);
    const id4555 = titulos.find(t => t.nf === '4555')!.id;
    const id4560 = titulos.find(t => t.nf === '4560')!.id;
    const semContrapartida: Record<number, Decisao> = { [id4555]: { tipo: 'confirmar' }, [id4560]: { tipo: 'manual', contrapartida: ' ', historico: '' } };
    expect(pendentes(cr, semContrapartida)).toHaveLength(1);
    expect(pendentes(cr, { [id4555]: { tipo: 'confirmar' }, [id4560]: { tipo: 'excluir' } })).toHaveLength(0);
  });
});

describe('lançamentos e fechamento', () => {
  const r = corrigido();
  const titulos = r.grupos.flatMap(g => g.titulos);
  const cr = cruzar(titulos, lerSistema(buf(EXEMPLO_SISTEMA_CSV), 'sistema.csv'));
  const id = (nf: string) => titulos.find(t => t.nf === nf)!.id;

  it('histórico sem o prefixo', () => {
    expect(historicoSemPrefixo('Recebimento de clientes NF 4521 - X')).toBe('NF 4521 - X');
    expect(historicoSemPrefixo('RECEBIMENTO DE CLIENTES - NF 1')).toBe('NF 1');
    expect(historicoSemPrefixo('Outro texto')).toBe('Outro texto');
  });

  it('principal cheio + mora + desconto separados', () => {
    const d: Record<number, Decisao> = { [id('4555')]: { tipo: 'confirmar' }, [id('4560')]: { tipo: 'manual', contrapartida: '11299', historico: 'NF 4560 - EMPORIO VERDE' } };
    const l = gerarLancamentos(titulos, cr, d, CONTAS_PADRAO);
    const da = (nf: string) => l.filter(x => x.documento === nf).map(x => [x.tipo, x.debito, x.credito, x.codHistorico, x.historico, x.valor, x.data]);
    expect(da('4521')).toEqual([
      ['principal', '10503', '11201', '246', 'NF 4521 - MERCADO BOM PRECO LTDA', 1250, '01/09/2026'],
      ['mora', '10503', '97304', '59648', '4521 - MERCADO BOM PRECO LTDA', 12.5, '01/09/2026'],
    ]);
    expect(da('4533')).toEqual([
      ['principal', '10503', '11201', '246', 'NF 4533 - PADARIA SAO JORGE ME', 830.4, '01/09/2026'],
      ['desconto', '85001', '10503', '256', '4533 - PADARIA SAO JORGE ME', 16.61, '01/09/2026'],
    ]);
    // duas parcelas, cada uma no seu dia e com o seu valor
    expect(da('4548').map(x => [x[5], x[6]])).toEqual([[615.33, '02/09/2026'], [615.34, '03/09/2026']]);
    expect(da('4560')[0].slice(1, 5)).toEqual(['10503', '11299', '246', 'NF 4560 - EMPORIO VERDE']);
    // fecha dia a dia com o total cobrado impresso
    const f = fecharPorDia(r.grupos, l, titulosFora(titulos, cr, d), CONTAS_PADRAO);
    expect(f.map(x => [x.data, x.liquido, x.esperado, x.fonte, x.situacao])).toEqual([
      ['01/09/2026', 4176.29, 4176.29, 'impresso', 'ok'],
      ['02/09/2026', 2004.63, 2004.63, 'impresso', 'ok'],
      ['03/09/2026', 2387.89, 2387.89, 'impresso', 'ok'],
    ]);
  });

  it('título excluído: a diferença do dia fica explicada', () => {
    const d: Record<number, Decisao> = { [id('4555')]: { tipo: 'confirmar' }, [id('4560')]: { tipo: 'excluir' } };
    const l = gerarLancamentos(titulos, cr, d, CONTAS_PADRAO);
    const f = fecharPorDia(r.grupos, l, titulosFora(titulos, cr, d), CONTAS_PADRAO);
    expect(f[2]).toMatchObject({ fora: 322.15, diferenca: -322.15, situacao: 'explicada' });
  });

  it('arquivo .xls: cabeçalho de 8 colunas, valor e documento numéricos', () => {
    const l = gerarLancamentos(titulos, cr, { [id('4555')]: { tipo: 'confirmar' }, [id('4560')]: { tipo: 'excluir' } }, CONTAS_PADRAO);
    const wb = XLSX.read(XLSX.write(livroDeImportacao(l), { bookType: 'biff8', type: 'array' }), { type: 'array' });
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });
    expect(linhas[0]).toEqual(['LANC AUTOMÁTICO', 'DATA', 'DÉBITO', 'CRÉDITO', 'COD HISTÓRICO', 'HISTÓRICO', 'VALOR', 'DOCUMENTO']);
    expect(linhas[1].slice(2)).toEqual([10503, 11201, 246, 'NF 4521 - MERCADO BOM PRECO LTDA', 1250, 4521]);
    expect(typeof linhas[1][1]).toBe('number'); // data de verdade (serial do Excel)
  });
});

describe('planilha do banco', () => {
  it('lê .xlsx com cabeçalho e total do grupo; sem total, agrupa por dia', () => {
    const aoa = [
      ['Relatório de liquidação'],
      ['Sacado', 'Nosso Número', 'Seu Número', 'Valor (R$)', 'Vlr. Mora', 'Vlr. Desc.', 'Dt. Liquidação', 'Vlr. Cobrado'],
      ['CLIENTE A', '001', '10', 100, 1, 0, new Date(2026, 8, 1), 101],
      ['CLIENTE B', '002', '11', 50, 0, 5, '01/09/2026', 45],
      ['Total de Valores do grupo', null, null, 150, 1, 5, null, 146],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'P');
    const r = lerRelatorioPlanilha(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), 'banco.xlsx');
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].impresso).toEqual({ valor: 150, mora: 1, desconto: 5, outros: null, cobrado: 146 });
    expect(conferirGrupo(r.grupos[0]).situacao).toBe('ok');

    const semTotal = lerRelatorioPlanilha(buf('Sacado;Seu Número;Valor;Dt. Liquidação\nA;1;10,00;01/09/2026\nB;2;20,00;02/09/2026\n'), 'b.csv');
    expect(semTotal.grupos.map(g => g.titulos.length)).toEqual([1, 1]);
    expect(semTotal.avisos[0]).toMatch(/por dia/);
  });
});

describe('PDF', () => {
  it('remonta as linhas pela altura e separa as colunas', () => {
    expect(linhasDosItens([
      { texto: '100,00', x: 300, y: 100, largura: 30 },
      { texto: 'CLIENTE', x: 10, y: 101, largura: 40 },
      { texto: 'A', x: 52, y: 100, largura: 5 },
      { texto: 'Total', x: 10, y: 120, largura: 20 },
    ])).toEqual(['CLIENTE A  100,00', 'Total']);
  });
});

describe('PDF do Sicoob (leitura por posição)', () => {
  // Coordenadas iguais às do "Relatório - Títulos por Período" real (página girada: cada coluna é um
  // bloco de texto). Nomes inventados.
  const it_ = (texto: string, x: number, y: number, largura: number) => ({ texto, x, y, largura });
  const cabecalho = (y: number, liq = 'Dt. Liquid.', cobr = 'Vlr. Cobrado') => [
    it_('Sacado', 86, y, 28), it_('Nosso Número', 181, y, 57), it_('Seu Número', 263, y, 47), it_('Dt. Previsão Crédito', 329, y, 76),
    it_('Vencimento', 423, y, 45), it_('Dt. Limite', 492, y - 5, 36), it_('Pgto', 502, y + 5, 18), it_('Valor (R$)', 539, y, 38),
    it_('Vlr. Mora Vlr. Desc. ', 581, y, 75), it_('Vlr. Outros', 657, y - 5, 41), it_('Acresc.', 663, y + 5, 29),
    it_(liq, 709, y, 39), it_(cobr, 761, y, 48),
  ];
  const linha = (y: number, nome: string[], nosso: string, seu: string, valor: string, mora: string, liq: string, cobrado: string) => [
    ...nome.map((n, i) => it_(n, 31, y - (nome.length > 1 ? 5 : 0) + i * 9, n.length * 5)),
    it_(nosso, 215, y, 29), it_(seu, 294, y, 31), it_(liq, 347, y, 40), it_(liq, 426, y, 40),
    it_(valor, 547, y, 31), it_(mora, 595, y, 20), it_('0,00', 636, y, 16), it_('0,00', 683, y, 16),
    it_(liq, 708, y, 40), it_(cobrado, 781, y, 31),
  ];
  const topo = [it_('Cedente:', 28, 67, 43), it_('640581 - EMPRESA EXEMPLO LTDA', 127, 68, 295), it_('01/08/2026', 372, 84, 50), it_('Liquidação e baixa', 127, 84, 83)];
  const rodape = (p: number) => [it_('Página ' + p + 'de: 2', 661, 579, 54), it_('Gerado em:', 28, 579, 42), it_('02/09/2026 08:51:13', 103, 579, 73)];
  const pag1 = [
    ...topo, it_('58-LIQUIDAÇÃO - VIA COMPENSAÇÃO', 28, 114, 186), ...cabecalho(136),
    ...linha(161, ['CLIENTE UM'], '10542-4', '9848/2/3', '2.493,55', '69,83', '04/08/2026', '2.563,38'),
    ...linha(189, ['MERCADINHO DOIS DE', 'TAIOBEIRAS LTDA'], '10573-2', '9862/2/2', '1.004,82', '0,00', '05/08/2026', '1.004,82'),
    ...rodape(1),
  ];
  const pag2 = [
    ...topo, it_('58-LIQUIDAÇÃO - VIA COMPENSAÇÃO', 28, 114, 186), ...cabecalho(136),
    ...linha(161, ['CLIENTE TRES'], '10580-4', '9868/2/2', '1.025,66', '0,00', '17/08/2026', '1.025,66'),
    it_('4.593,86', 764, 205, 50), it_('Total de Valores do grupo:', 583, 205, 118),
    it_('3', 803, 220, 11), it_('Total de Registros do grupo:', 575, 220, 126),
    it_('82-BAIXA - PEDIDO CEDENTE', 28, 250, 143), ...cabecalho(272, 'Dt. Baixa', 'Vlr. Baixado'),
    ...linha(297, ['CLIENTE BAIXADO'], '10507-6', '9827/1/1', '344,30', '0,00', '06/08/2026', '344,30'),
    it_('344,30', 775, 330, 39), it_('Total de Valores do grupo:', 583, 330, 118), it_('1', 808, 345, 6), it_('Total de Registros do grupo:', 575, 345, 126),
    it_('Total de Valores Baixados:', 573, 376, 128), it_('344,30', 775, 380, 39),
    it_('Total de Valores Liquidados:', 564, 420, 137), it_('4.593,86', 764, 424, 50),
    it_('Total de Registros Liquidados:', 554, 435, 147), it_('3', 797, 439, 17),
    ...rodape(2),
  ];

  it('lê os títulos pelas colunas, junta o nome em duas linhas e deixa a baixa de fora', () => {
    const r = relatorioDosItens([pag1, pag2])!;
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].rotulo).toBe('58-LIQUIDAÇÃO - VIA COMPENSAÇÃO');
    expect(r.grupos[0].titulos.map(t => [t.sacado, t.nossoNumero, t.nf, t.valor, t.mora, t.outros, t.liquidacao, t.cobrado])).toEqual([
      ['CLIENTE UM', '10542-4', '9848/2/3', 2493.55, 69.83, 0, '04/08/2026', 2563.38],
      ['MERCADINHO DOIS DE TAIOBEIRAS LTDA', '10573-2', '9862/2/2', 1004.82, 0, 0, '05/08/2026', 1004.82],
      ['CLIENTE TRES', '10580-4', '9868/2/2', 1025.66, 0, 0, '17/08/2026', 1025.66],
    ]);
    expect(r.grupos[0].impresso.cobrado).toBe(4593.86);
    expect(r.grupos[0].registros).toBe(3);
    expect(r.ignorados).toBe(1);
    expect(r.totalGeral.cobrado).toBe(4593.86);
    expect(r.registrosGeral).toBe(3);
    expect(conferirGrupo(r.grupos[0]).situacao).toBe('ok');
    expect(relatorioConferido(r)).toBe(true);
  });

  it('linha faltando: a quantidade de registros não bate', () => {
    const semUma = pag1.filter(i => !(i.y >= 184 && i.y <= 198 && i.x < 700) && i.texto !== '9862/2/2');
    const g = conferirGrupo(relatorioDosItens([semUma, pag2])!.grupos[0]);
    expect(g.registros).toEqual({ impresso: 3, lidos: 2 });
    expect(g.situacao).toBe('diverge');
  });

  it('sem cabeçalho de tabela: devolve null (quem chama lê como texto)', () => {
    expect(relatorioDosItens([[it_('qualquer coisa', 10, 10, 50)]])).toBeNull();
  });
});

describe('contas pelo balancete', () => {
  const comercio = BALANCETES_EXEMPLO['EXEMPLO COMERCIO DE ALIMENTOS LTDA'];
  const medicos = BALANCETES_EXEMPLO['EXEMPLO SERVICOS MEDICOS LTDA'];

  it('lê o balancete do documento da Conferência; sem ele, o plano que ficou guardado', () => {
    const doc = { contas: [{ codigo: '10503', nome: 'BANCO SICOOB', grupo: 'Ativo', dc: 'D', valor: 0 }], balanceteAssinaturaTs: '2026-09-02T13:10:00.000Z' };
    expect(balanceteDoDocumento(doc)).toMatchObject({ origem: 'balancete', contas: [{ codigo: '10503', nome: 'BANCO SICOOB', grupo: 'Ativo' }] });
    expect(balanceteDoDocumento({ contas: [], balanceteAssinatura: { 10503: 'banco sicoob c movimento' } })).toMatchObject({ origem: 'plano', contas: [{ codigo: '10503', nome: 'BANCO SICOOB C MOVIMENTO' }] });
    expect(balanceteDoDocumento(null)).toBe(SEM_BALANCETE);
    expect(balanceteDoDocumento({ nome: 'X' }).origem).toBe('nenhum');
  });

  it('sugere pelo nome, sem sintética, aplicação, juros passivos ou descontos obtidos', () => {
    expect(sugerirConta('banco', comercio.contas)?.codigo).toBe('10503');
    expect(sugerirConta('juros', comercio.contas)?.codigo).toBe('97304');
    expect(sugerirConta('desconto', comercio.contas)?.codigo).toBe('85001');
    expect(sugerirConta('juros', medicos.contas)?.codigo).toBe('31120');
    expect(sugerirConta('desconto', medicos.contas)).toBeNull();
  });

  it('salva vale; sugerida quando não há; padrão sem balancete; falta escolher bloqueia', () => {
    expect(resolverContas(comercio, CONFIG_VAZIA).contas).toEqual(CONTAS_PADRAO);
    const cfg = escolherConta(CONFIG_VAZIA, 'banco', '10502', comercio);
    expect(cfg).toEqual({ contas: { banco: '10502' }, nomes: { banco: 'BANCO DO BRASIL C/ MOVIMENTO' } });
    expect(resolverContas(comercio, cfg).detalhe.banco).toMatchObject({ codigo: '10502', origem: 'salva', bloqueia: false });
    expect(resolverContas(SEM_BALANCETE, CONFIG_VAZIA).detalhe.banco).toMatchObject({ codigo: CONTAS_PADRAO.banco, origem: 'padrao' });
    expect(resolverContas(medicos, CONFIG_VAZIA).detalhe.desconto).toMatchObject({ codigo: '', origem: 'falta', bloqueia: true });
    const hist = escolherConta(CONFIG_VAZIA, 'histJuros', '123', comercio);
    expect(resolverContas(comercio, hist).contas.histJuros).toBe('123');
  });

  it('balancete atualizado: a conta salva que sumiu bloqueia, a que mudou de nome avisa', () => {
    const cfg = escolherConta(CONFIG_VAZIA, 'banco', '10503', comercio);
    const sumiu = { ...comercio, contas: comercio.contas.filter(c => c.codigo !== '10503') };
    expect(resolverContas(sumiu, cfg).detalhe.banco).toMatchObject({ origem: 'salva', bloqueia: true });
    const renomeada = { ...comercio, contas: comercio.contas.map(c => (c.codigo === '10503' ? { ...c, nome: 'SICOOB CREDICOOP' } : c)) };
    const r = resolverContas(renomeada, cfg);
    expect(r.detalhe.banco).toMatchObject({ nome: 'SICOOB CREDICOOP', bloqueia: false });
    expect(r.detalhe.banco.aviso).toMatch(/mudou de nome/i);
    // baixar confirma: o nome novo fica guardado e o aviso some
    expect(resolverContas(renomeada, confirmarContas(cfg, r)).detalhe.banco.aviso).toBeUndefined();
  });

  it('confirmar salva as sugeridas; o documento guardado é conferido', () => {
    const c = confirmarContas(CONFIG_VAZIA, resolverContas(comercio, CONFIG_VAZIA));
    expect(c.contas).toEqual({ banco: '10503', juros: '97304', desconto: '85001' });
    expect(mesmaConfig(c, configDoDocumento({ ...c, atualizadoEm: 'x', lixo: 1 }))).toBe(true);
    expect(configDoDocumento({ contas: { banco: ' ', juros: 5 } }).contas).toEqual({ juros: '5' });
  });
});
